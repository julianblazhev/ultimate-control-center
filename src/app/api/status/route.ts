// ═══════════════════════════════════════════════════════════════
// API Route — GET /api/status
// CLI: openclaw gateway status --json + openclaw status --json
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { mockGateway } from "@/lib/mock-data";
import { openclawExec } from "@/lib/gateway";
import { transformGatewayStatus } from "@/lib/transformers";
import type { GatewayStatus, ApiResponse } from "@/lib/types";

export async function GET(): Promise<NextResponse<ApiResponse<GatewayStatus>>> {
  try {
    // Fetch gateway service status and heartbeat status in parallel
    const [gwRaw, statusRaw] = await Promise.all([
      openclawExec<unknown>(["gateway", "status"]),
      openclawExec<unknown>(["status"]).catch(() => undefined),
    ]);

    // Also get cron count
    let cronCount = 0;
    try {
      const cronRaw = await openclawExec<{ jobs?: unknown[] }>(["cron", "list"]);
      cronCount = cronRaw.jobs?.length || 0;
    } catch { /* ignore */ }

    const data = transformGatewayStatus(
      gwRaw as Parameters<typeof transformGatewayStatus>[0],
      statusRaw as Parameters<typeof transformGatewayStatus>[1],
    );
    data.cronJobs = cronCount;

    return NextResponse.json({ data, timestamp: new Date().toISOString() });
  } catch {
    return NextResponse.json({
      data: mockGateway,
      timestamp: new Date().toISOString(),
    });
  }
}
