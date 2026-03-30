// ═══════════════════════════════════════════════════════════════
// Server initialization — connects gateway event bridge on startup
// Import this from any server-side route to ensure the bridge is live.
// ═══════════════════════════════════════════════════════════════

import { initEventBridge } from "./event-bridge";

// Initialize once when this module is first imported on the server
if (typeof globalThis !== "undefined" && typeof window === "undefined") {
  initEventBridge();
}

export { initEventBridge };
