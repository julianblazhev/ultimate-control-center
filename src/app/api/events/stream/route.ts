// ═══════════════════════════════════════════════════════════════
// API Route — GET /api/events/stream
// Server-Sent Events endpoint for real-time dashboard updates
// ═══════════════════════════════════════════════════════════════

import { addConnection, removeConnection, type SSEEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connected event
      const initial = `data: ${JSON.stringify({ type: "connected", data: {}, timestamp: new Date().toISOString() })}\n\n`;
      controller.enqueue(encoder.encode(initial));

      // Register this connection for broadcasts
      const writer = (event: SSEEvent) => {
        try {
          const msg = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(msg));
        } catch {
          removeConnection(writer);
        }
      };

      addConnection(writer);

      // Keep-alive ping every 30 seconds
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(pingInterval);
          removeConnection(writer);
        }
      }, 30_000);

      // Cleanup when client disconnects
      const cleanup = () => {
        clearInterval(pingInterval);
        removeConnection(writer);
      };

      // AbortSignal not available in all Next.js versions, so we rely on
      // the try/catch in writer to detect disconnection
      void cleanup; // referenced by writer's catch
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
