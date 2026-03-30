// ═══════════════════════════════════════════════════════════════
// API Route — GET /api/status
// RPC: health + status → fallback CLI
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { gatewayCall } from "@/lib/gateway";
import { transformGatewayStatus } from "@/lib/transformers";
import type { GatewayStatus, ApiResponse } from "@/lib/types";

export async function GET(): Promise<NextResponse<ApiResponse<GatewayStatus>>> {
  try {
    const [gwRaw, statusRaw] = await Promise.all([
      gatewayCall<unknown>("health"),
      gatewayCall<unknown>("status").catch(() => undefined),
    ]);

    let cronCount = 0;
    try {
      const cronRaw = await gatewayCall<{ jobs?: unknown[] }>("cron.list");
      cronCount = cronRaw.jobs?.length || 0;
    } catch { /* cron count is best-effort */ }

    const data = transformGatewayStatus(
      gwRaw as Parameters<typeof transformGatewayStatus>[0],
      statusRaw as Parameters<typeof transformGatewayStatus>[1],
    );
    data.cronJobs = cronCount;

    return NextResponse.json({ data, timestamp: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      {
        data: { status: "offline", version: "unknown", uptime: 0, activeSessions: 0, totalSessions: 0, cronJobs: 0 } as GatewayStatus,
        error: `Gateway error: ${err instanceof Error ? err.message : "unknown"}`,
        timestamp: new Date().toISOString(),
      },
      { status: 502 },
    );
  }
}
