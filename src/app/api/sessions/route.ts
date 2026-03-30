// ═══════════════════════════════════════════════════════════════
// API Route — GET /api/sessions
// CLI: openclaw sessions --json (no "list" subcommand)
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { openclawExec } from "@/lib/gateway";
import { transformSessions } from "@/lib/transformers";
import type { Session, ApiResponse } from "@/lib/types";

export async function GET(): Promise<NextResponse<ApiResponse<Session[]>>> {
  try {
    const raw = await openclawExec<unknown>(["sessions"]);
    const data = transformSessions(raw as Parameters<typeof transformSessions>[0]);
    return NextResponse.json({ data, timestamp: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      { data: [], error: `Gateway error: ${err instanceof Error ? err.message : "unknown"}`, timestamp: new Date().toISOString() },
      { status: 502 },
    );
  }
}
