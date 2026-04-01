// ═══════════════════════════════════════════════════════════════
// OpenClaw Gateway WebSocket RPC Client
// Persistent connection with auto-reconnect, Ed25519 device auth
// Compatible with OpenClaw gateway protocol v3
// ═══════════════════════════════════════════════════════════════

import WebSocket from "ws";
import { randomUUID } from "crypto";
import { getConfig } from "../config";
import {
  loadOrCreateDeviceIdentity,
  publicKeyRawBase64url,
  signPayload,
  buildDeviceAuthPayload,
} from "./device-identity";

const PROTOCOL_VERSION = 3;
const CONNECT_TIMEOUT_MS = 10_000;
const RECONNECT_INTERVAL_MS = 10_000;
const RPC_TIMEOUT_MS = 15_000;
const OPERATOR_SCOPES = ["operator.read", "operator.admin", "operator.approvals", "operator.pairing"];

type EventHandler = (event: string, payload: unknown) => void;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class OpenClawClient {
  private ws: WebSocket | null = null;
  private connected = false;
  private connecting = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pending = new Map<string, PendingRequest>();
  private eventHandlers: EventHandler[] = [];
  private url: string;
  private token: string | null;

  constructor(url: string, token?: string | null) {
    this.url = url;
    this.token = token || null;
  }

  // ── Public API ─────────────────────────────────────────────

  async connect(): Promise<void> {
    if (this.connected || this.connecting) return;
    this.connecting = true;

    try {
      console.log(`[gateway] Connecting to ${this.url} (token: ${this.token ? "yes" : "no"})...`);
      await this._doConnect();
      console.log("[gateway] Connected successfully");
    } catch (err) {
      console.error("[gateway] Connection failed:", err instanceof Error ? err.message : err);
      throw err;
    } finally {
      this.connecting = false;
    }
  }

  async call<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    if (!this.connected) {
      await this.connect();
    }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Gateway not connected");
    }

    const id = randomUUID();
    const message = JSON.stringify({ type: "req", id, method, params });

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`RPC timeout: ${method}`));
      }, RPC_TIMEOUT_MS);

      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
      this.ws!.send(message);
    });
  }

  onEvent(handler: EventHandler): void {
    this.eventHandlers.push(handler);
  }

  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  close(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this._rejectAll("Client closed");
  }

  // ── Connection ─────────────────────────────────────────────

  private _buildOrigin(): string {
    // Derive an http(s) origin from the WebSocket URL for the controlUi origin check
    try {
      const parsed = new URL(this.url);
      const scheme = parsed.protocol === "wss:" ? "https" : "http";
      const host = parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
      return `${scheme}://${host}`;
    } catch {
      return "http://localhost";
    }
  }

  private async _doConnect(): Promise<void> {
    const wsUrl = this.token
      ? `${this.url}?token=${encodeURIComponent(this.token)}`
      : this.url;

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Gateway connection timeout"));
        ws.close();
      }, CONNECT_TIMEOUT_MS);

      const origin = this._buildOrigin();
      const ws = new WebSocket(wsUrl, { handshakeTimeout: CONNECT_TIMEOUT_MS, origin });
      this.ws = ws;
      let firstMessage = true;

      ws.on("open", () => {
        // Wait for potential challenge message before sending connect
      });

      ws.on("message", async (raw) => {
        const data = JSON.parse(raw.toString());

        // Handle connect challenge on first message
        if (firstMessage) {
          firstMessage = false;
          let nonce: string | null = null;
          if (data.type === "event" && data.event === "connect.challenge") {
            nonce = data.payload?.nonce || null;
          }
          try {
            await this._sendConnect(ws, nonce);
            clearTimeout(timeout);
            this.connected = true;
            resolve();
          } catch (err) {
            clearTimeout(timeout);
            reject(err);
          }
          return;
        }

        this._handleMessage(data);
      });

      ws.on("error", (err) => {
        clearTimeout(timeout);
        if (!this.connected) {
          reject(err);
        }
      });

      ws.on("close", () => {
        this.connected = false;
        this._rejectAll("Connection closed");
        this._scheduleReconnect();
      });

      // If no message arrives within 2s, send connect without challenge
      setTimeout(() => {
        if (firstMessage && ws.readyState === WebSocket.OPEN) {
          firstMessage = false;
          this._sendConnect(ws, null)
            .then(() => {
              clearTimeout(timeout);
              this.connected = true;
              resolve();
            })
            .catch((err) => {
              clearTimeout(timeout);
              reject(err);
            });
        }
      }, 2000);
    });
  }

  private async _sendConnect(ws: WebSocket, nonce: string | null): Promise<void> {
    const role = "operator";
    const scopes = [...OPERATOR_SCOPES];
    const clientId = "openclaw-control-ui";
    const clientMode = "webchat";

    const connectId = randomUUID();
    const params: Record<string, unknown> = {
      minProtocol: PROTOCOL_VERSION,
      maxProtocol: PROTOCOL_VERSION,
      role,
      scopes,
      client: { id: clientId, version: "1.0.0", platform: "node", mode: clientMode },
    };

    // Token-only auth (preferred in Docker / managed deployments)
    if (this.token) {
      params.auth = { token: this.token };
    }

    // Only add device identity when no token is available (local dev)
    if (!this.token) {
      try {
        const identity = loadOrCreateDeviceIdentity();
        const signedAtMs = Date.now();
        const authPayload = buildDeviceAuthPayload({
          deviceId: identity.deviceId,
          clientId,
          clientMode,
          role,
          scopes,
          signedAtMs,
          token: null,
          nonce,
        });

        params.device = {
          id: identity.deviceId,
          publicKey: publicKeyRawBase64url(identity.publicKeyPem),
          signature: signPayload(identity.privateKeyPem, authPayload),
          signedAt: signedAtMs,
          ...(nonce ? { nonce } : {}),
        };
      } catch (err) {
        console.error("[gateway] Device identity failed, connecting without:", err instanceof Error ? err.message : err);
      }
    }

    const msg = JSON.stringify({ type: "req", id: connectId, method: "connect", params });
    ws.send(msg);

    // Wait for connect response
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Connect handshake timeout")), 5000);

      const handler = (raw: WebSocket.RawData) => {
        const data = JSON.parse(raw.toString());
        if (data.id === connectId) {
          clearTimeout(timer);
          ws.removeListener("message", handler);
          if (data.ok === false || data.error) {
            const reason = data.error?.message || JSON.stringify(data.error) || "Connect rejected";
            console.error("[gateway] Connect rejected:", reason);
            reject(new Error(reason));
          } else {
            resolve();
          }
        }
      };
      ws.on("message", handler);
    });
  }

  // ── Message Handling ───────────────────────────────────────

  private _handleMessage(data: { type?: string; id?: string; event?: string; ok?: boolean; error?: { message?: string }; payload?: unknown; result?: unknown }): void {
    // RPC response
    if (data.id && this.pending.has(data.id)) {
      const req = this.pending.get(data.id)!;
      this.pending.delete(data.id);
      clearTimeout(req.timer);

      if (data.ok === false || data.error) {
        req.reject(new Error(data.error?.message || "Gateway error"));
      } else {
        req.resolve(data.payload ?? data.result ?? null);
      }
      return;
    }

    // Gateway event
    if (data.type === "event" && data.event) {
      for (const handler of this.eventHandlers) {
        try {
          handler(data.event, data.payload);
        } catch {
          // Ignore handler errors
        }
      }
    }
  }

  private _rejectAll(reason: string): void {
    for (const [id, req] of this.pending) {
      clearTimeout(req.timer);
      req.reject(new Error(reason));
      this.pending.delete(id);
    }
  }

  private _scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
      } catch {
        // Will retry via close handler
      }
    }, RECONNECT_INTERVAL_MS);
  }
}

// ── Singleton ──────────────────────────────────────────────────

let _client: OpenClawClient | null = null;

export function getOpenClawClient(): OpenClawClient {
  if (!_client) {
    const { gatewayUrl, gatewayToken } = getConfig();
    const url = gatewayUrl || "ws://127.0.0.1:18789";
    _client = new OpenClawClient(url, gatewayToken);
  }
  return _client;
}

export function resetClient(): void {
  if (_client) {
    _client.close();
    _client = null;
  }
}
