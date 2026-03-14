// ═══════════════════════════════════════════════════════════════
// API Route — GET /api/cron
// CLI: openclaw cron list --json
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { mockCronJobs } from "@/lib/mock-data";
import { openclawExec } from "@/lib/gateway";
import { transformCronJobs } from "@/lib/transformers";
import type { CronJob, ApiResponse } from "@/lib/types";

export async function GET(): Promise<NextResponse<ApiResponse<CronJob[]>>> {
  try {
    const raw = await openclawExec<unknown>(["cron", "list"]);
    const data = transformCronJobs(raw as Parameters<typeof transformCronJobs>[0]);
    return NextResponse.json({ data, timestamp: new Date().toISOString() });
  } catch {
    return NextResponse.json({
      data: mockCronJobs,
      timestamp: new Date().toISOString(),
    });
  }
}
