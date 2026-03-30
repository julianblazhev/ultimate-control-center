// ═══════════════════════════════════════════════════════════════
// Event Bridge — Connects gateway WebSocket events to SSE broadcast
// Listens to OpenClaw gateway events and pushes them to all
// connected browser clients via the SSE event bus.
// ═══════════════════════════════════════════════════════════════

import { getOpenClawClient } from "./client";
import { broadcast } from "../events";

let initialized = false;

export function initEventBridge(): void {
  if (initialized) return;
  initialized = true;

  try {
    const client = getOpenClawClient();

    client.onEvent((event, payload) => {
      broadcast({
        type: mapGatewayEvent(event),
        data: payload,
        timestamp: new Date().toISOString(),
      });
    });

    // Attempt initial connection (non-blocking)
    client.connect().catch(() => {
      // Will auto-reconnect
    });
  } catch {
    // Gateway not configured — SSE will still work for local events
  }
}

function mapGatewayEvent(event: string): string {
  // Map OpenClaw gateway events to dashboard event types
  const mapping: Record<string, string> = {
    "agent": "agent_updated",
    "chat": "chat_message",
    "presence": "agent_presence",
    "tick": "heartbeat_tick",
    "heartbeat": "heartbeat",
    "shutdown": "gateway_shutdown",
    "health": "health_updated",
    "cron": "cron_updated",
    "exec.approval.requested": "approval_requested",
    "exec.approval.resolved": "approval_resolved",
    "node.pair.requested": "node_pair_requested",
    "node.pair.resolved": "node_pair_resolved",
  };
  return mapping[event] || `gateway_${event}`;
}
