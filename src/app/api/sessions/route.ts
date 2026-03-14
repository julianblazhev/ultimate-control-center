// ═══════════════════════════════════════════════════════════════
// API Route — GET /api/sessions
// CLI: openclaw sessions --json (no "list" subcommand)
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { mockSessions } from "@/lib/mock-data";
import { openclawExec } from "@/lib/gateway";
import { transformSessions } from "@/lib/transformers";
import type { Session, ApiResponse } from "@/lib/types";

export async function GET(): Promise<NextResponse<ApiResponse<Session[]>>> {
  try {
    // "sessions list" errors — use "sessions" directly
    const raw = await openclawExec<unknown>(["sessions"]);
    const data = transformSessions(raw as Parameters<typeof transformSessions>[0]);
    return NextResponse.json({ data, timestamp: new Date().toISOString() });
  } catch {
    return NextResponse.json({
      data: mockSessions,
      timestamp: new Date().toISOString(),
    });
  }
}
