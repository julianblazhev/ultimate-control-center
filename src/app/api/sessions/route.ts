// ═══════════════════════════════════════════════════════════════
// API Route — GET /api/sessions
// RPC: sessions.list → fallback CLI: openclaw sessions --json
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { gatewayCall } from "@/lib/gateway";
import { transformSessions } from "@/lib/transformers";
import type { Session, ApiResponse } from "@/lib/types";

export async function GET(): Promise<NextResponse<ApiResponse<Session[]>>> {
  try {
    const raw = await gatewayCall<unknown>("sessions.list");
    const data = transformSessions(raw as Parameters<typeof transformSessions>[0]);
    return NextResponse.json({ data, timestamp: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      { data: [], error: `Gateway error: ${err instanceof Error ? err.message : "unknown"}`, timestamp: new Date().toISOString() },
      { status: 502 },
    );
  }
}
