// ═══════════════════════════════════════════════════════════════
// API Route — GET /api/cron
// CLI: openclaw cron list --json
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { openclawExec } from "@/lib/gateway";
import { transformCronJobs } from "@/lib/transformers";
import type { CronJob, ApiResponse } from "@/lib/types";

export async function GET(): Promise<NextResponse<ApiResponse<CronJob[]>>> {
  try {
    const raw = await openclawExec<unknown>(["cron", "list"]);
    const data = transformCronJobs(raw as Parameters<typeof transformCronJobs>[0]);
    return NextResponse.json({ data, timestamp: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      { data: [], error: `Gateway error: ${err instanceof Error ? err.message : "unknown"}`, timestamp: new Date().toISOString() },
      { status: 502 },
    );
  }
}
