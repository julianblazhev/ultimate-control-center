// ═══════════════════════════════════════════════════════════════
// API Route — POST /api/actions
// Executes named actions against the OpenClaw gateway via RPC
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { gatewayCall } from "@/lib/gateway";
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
        const data = await gatewayCall("status");
        return NextResponse.json({ success: true, message: "Gateway status refreshed", data });
      }

      case "list_sessions": {
        const data = await gatewayCall("sessions.list");
        return NextResponse.json({ success: true, message: "Sessions retrieved", data });
      }

      case "list_cron": {
        const data = await gatewayCall("cron.list");
        return NextResponse.json({ success: true, message: "Cron jobs retrieved", data });
      }

      case "gateway_restart": {
        if (params?.confirm !== "true") {
          return NextResponse.json(
            { success: false, message: "gateway_restart requires explicit confirmation", error: 'Pass params: { confirm: "true" }' },
            { status: 400 }
          );
        }

        await gatewayCall("config.apply", { restart: true });
        return NextResponse.json({
          success: true,
          message: "Gateway restart initiated",
          data: { action: "gateway_restart", initiatedAt: new Date().toISOString() },
        });
      }
    }
  } catch (err) {
    return NextResponse.json(
      { success: false, message: `Gateway error: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 502 }
    );
  }
}
