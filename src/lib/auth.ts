// ═══════════════════════════════════════════════════════════════
// Auth — simple session-based API authentication
// Validates a session cookie against DASHBOARD_SECRET
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const COOKIE_NAME = "mc_session";

export function getDashboardSecret(): string {
  return process.env.DASHBOARD_SECRET || "";
}

/**
 * Check if the current request is authenticated.
 * Valid if the session cookie matches DASHBOARD_SECRET.
 */
export async function isAuthenticated(request?: NextRequest): Promise<boolean> {
  const secret = getDashboardSecret();

  // No secret configured = auth disabled (first-time setup)
  if (!secret) return true;

  // Check cookie
  if (request) {
    const cookie = request.cookies.get(COOKIE_NAME);
    if (cookie?.value === secret) return true;
  } else {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(COOKIE_NAME);
    if (cookie?.value === secret) return true;
  }

  return false;
}

/**
 * Returns a 401 response for unauthenticated requests.
 */
export function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { error: "Unauthorized" },
    { status: 401 }
  );
}

/**
 * Sets the session cookie on a response.
 */
export function setSessionCookie(response: NextResponse): NextResponse {
  const secret = getDashboardSecret();
  if (!secret) return response;

  response.cookies.set(COOKIE_NAME, secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return response;
}

/**
 * Generate a cryptographically secure random secret.
 */
export function generateSecret(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require("crypto");
  return crypto.randomBytes(32).toString("hex");
}
