// ═══════════════════════════════════════════════════════════════
// Middleware — auth + setup redirect
// 1. If not configured → redirect to /setup
// 2. If configured → validate session cookie on all routes
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "mc_session";

// Routes that don't require authentication
const PUBLIC_PATHS = ["/setup", "/api/setup", "/login", "/api/auth"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow static assets
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  const dashboardSecret = process.env.DASHBOARD_SECRET || "";
  const isConfigured = !!(dashboardSecret && process.env.ORG_NAME);

  // ── Not configured: redirect to setup ───────────────────────
  if (!isConfigured) {
    if (isPublicPath(pathname)) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  // ── Auto-login mode: skip auth entirely ─────────────────────
  // When AUTO_LOGIN=true, the dashboard trusts the network layer (e.g.
  // Cloudflare Zero Trust) for authentication and automatically sets
  // the session cookie so clients never see a login screen.
  const autoLogin = process.env.AUTO_LOGIN === "true";

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(COOKIE_NAME);
  const isAuthed = sessionCookie?.value === dashboardSecret;

  if (!isAuthed) {
    if (autoLogin) {
      // Auto-set the session cookie and let the request through
      const response = NextResponse.next();
      response.cookies.set(COOKIE_NAME, dashboardSecret, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
      return response;
    }

    // API routes get 401, page routes get redirected to login
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
