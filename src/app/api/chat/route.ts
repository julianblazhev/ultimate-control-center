// ═══════════════════════════════════════════════════════════════
// API Route — POST /api/chat
// Send messages to agents via OpenClaw gateway RPC (chat.send)
// Also GET to retrieve chat history for a session
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { getOpenClawClient } from "@/lib/openclaw/client";
import { broadcast } from "@/lib/events";
import type { ApiResponse } from "@/lib/types";

const ID_PATTERN = /^[a-zA-Z0-9:_-]+$/;

// POST /api/chat — send a message to an agent session
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { sessionKey, message } = body;

    if (!sessionKey || typeof sessionKey !== "string" || !ID_PATTERN.test(sessionKey)) {
      return NextResponse.json({ success: false, message: "Invalid sessionKey" }, { status: 400 });
    }
    if (!message || typeof message !== "string" || message.length > 10000) {
      return NextResponse.json({ success: false, message: "Invalid message" }, { status: 400 });
    }

    const client = getOpenClawClient();

    // Ensure session exists
    await client.call("sessions.patch", { key: sessionKey });

    // Send message
    const result = await client.call("chat.send", {
      sessionKey,
      message,
      deliver: true,
      idempotencyKey: `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    });

    // Broadcast to SSE clients
    broadcast({
      type: "chat_sent",
      data: { sessionKey, message, timestamp: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, message: "Message sent", data: result });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: `Chat error: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 502 },
    );
  }
}

// GET /api/chat?sessionKey=xxx — get chat history
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const sessionKey = request.nextUrl.searchParams.get("sessionKey");
    if (!sessionKey || !ID_PATTERN.test(sessionKey)) {
      return NextResponse.json(
        { data: [], error: "Invalid sessionKey", timestamp: new Date().toISOString() },
        { status: 400 },
      );
    }

    const client = getOpenClawClient();
    const history = await client.call("chat.history", { sessionKey });

    return NextResponse.json({ data: history, timestamp: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      { data: [], error: `Chat error: ${err instanceof Error ? err.message : "unknown"}`, timestamp: new Date().toISOString() },
      { status: 502 },
    );
  }
}
