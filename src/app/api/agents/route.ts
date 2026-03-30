// ═══════════════════════════════════════════════════════════════
// API Route — GET /api/agents
// CLI: openclaw agents list --json
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { openclawExec } from "@/lib/gateway";
import { transformAgents } from "@/lib/transformers";
import type { Agent, ApiResponse } from "@/lib/types";

export async function GET(): Promise<NextResponse<ApiResponse<Agent[]>>> {
  try {
    const raw = await openclawExec<unknown[]>(["agents", "list"]);
    const data = transformAgents(raw as Parameters<typeof transformAgents>[0]);
    return NextResponse.json({ data, timestamp: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      { data: [], error: `Gateway error: ${err instanceof Error ? err.message : "unknown"}`, timestamp: new Date().toISOString() },
      { status: 502 },
    );
  }
}
