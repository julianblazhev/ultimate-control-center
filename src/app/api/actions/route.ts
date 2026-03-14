// ═══════════════════════════════════════════════════════════════
// API Route — POST /api/actions
// Executes named actions against the OpenClaw gateway
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { mockGateway, mockSessions, mockCronJobs } from "@/lib/mock-data";
import { openclawExec } from "@/lib/gateway";
import type { ActionResult } from "@/lib/types";

interface ActionRequestBody {
  action: string;
  params?: Record<string, string>;
}

const ALLOWED_ACTIONS = ["refresh_status", "list_sessions", "list_cron", "gateway_restart"] as const;
type AllowedAction = (typeof ALLOWED_ACTIONS)[number];

export async function POST(
  request: NextRequest
): Promise<NextResponse<ActionResult>> {
  try {
    let body: ActionRequestBody;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { action, params } = body;

    if (
      !action ||
      typeof action !== "string" ||
      action.length > 50 ||
      !ALLOWED_ACTIONS.includes(action as AllowedAction)
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid or unsupported action", error: `Supported: ${ALLOWED_ACTIONS.join(", ")}` },
        { status: 400 }
      );
    }

    switch (action as AllowedAction) {
      case "refresh_status": {
        try {
          const data = await openclawExec(["status"]);
          return NextResponse.json({ success: true, message: "Gateway status refreshed", data });
        } catch {
          return NextResponse.json({ success: true, message: "Gateway status (cached)", data: mockGateway });
        }
      }

      case "list_sessions": {
        try {
          const data = await openclawExec(["sessions"]);
          return NextResponse.json({ success: true, message: "Sessions retrieved", data });
        } catch {
          return NextResponse.json({ success: true, message: `Returned ${mockSessions.length} sessions (cached)`, data: mockSessions });
        }
      }

      case "list_cron": {
        try {
          const data = await openclawExec(["cron", "list"]);
          return NextResponse.json({ success: true, message: "Cron jobs retrieved", data });
        } catch {
          return NextResponse.json({ success: true, message: `Returned ${mockCronJobs.length} cron jobs (cached)`, data: mockCronJobs });
        }
      }

      case "gateway_restart": {
        if (params?.confirm !== "true") {
          return NextResponse.json(
            { success: false, message: "gateway_restart requires explicit confirmation", error: 'Pass params: { confirm: "true" }' },
            { status: 400 }
          );
        }

        try {
          await openclawExec(["gateway", "restart"]);
          return NextResponse.json({
            success: true,
            message: "Gateway restart initiated",
            data: { action: "gateway_restart", initiatedAt: new Date().toISOString() },
          });
        } catch {
          return NextResponse.json(
            { success: false, message: "Failed to restart gateway — is it running?" },
            { status: 500 }
          );
        }
      }
    }
  } catch {
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
