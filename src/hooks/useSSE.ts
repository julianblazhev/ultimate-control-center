"use client";

// ═══════════════════════════════════════════════════════════════
// useSSE — React hook for Server-Sent Events
// Connects to /api/events/stream and dispatches events to handlers
// Auto-reconnects on disconnect with backoff
// ═══════════════════════════════════════════════════════════════

import { useEffect, useRef, useCallback, useState } from "react";

interface SSEEvent {
  type: string;
  data: unknown;
  timestamp: string;
}

type EventHandler = (event: SSEEvent) => void;

export function useSSE(onEvent: EventHandler) {
  const [connected, setConnected] = useState(false);
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  const connect = useCallback(() => {
    const es = new EventSource("/api/events/stream");

    es.onopen = () => setConnected(true);

    es.onmessage = (msg) => {
      try {
        const event: SSEEvent = JSON.parse(msg.data);
        handlerRef.current(event);
      } catch {
        // Ignore parse errors (e.g. ping)
      }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      // Reconnect after 5 seconds
      setTimeout(connect, 5000);
    };

    return es;
  }, []);

  useEffect(() => {
    const es = connect();
    return () => {
      es.close();
      setConnected(false);
    };
  }, [connect]);

  return { connected };
}
