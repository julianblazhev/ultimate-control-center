// ═══════════════════════════════════════════════════════════════
// Event Bus — Server-side SSE broadcaster
// Maintains active SSE connections and broadcasts gateway events
// ═══════════════════════════════════════════════════════════════

export interface SSEEvent {
  type: string;
  data: unknown;
  timestamp: string;
}

type SSEWriter = (event: SSEEvent) => void;

const connections = new Set<SSEWriter>();

export function addConnection(writer: SSEWriter): void {
  connections.add(writer);
}

export function removeConnection(writer: SSEWriter): void {
  connections.delete(writer);
}

export function broadcast(event: SSEEvent): void {
  for (const writer of connections) {
    try {
      writer(event);
    } catch {
      connections.delete(writer);
    }
  }
}

export function connectionCount(): number {
  return connections.size;
}
