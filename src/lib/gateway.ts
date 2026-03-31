// ═══════════════════════════════════════════════════════════════
// Gateway — OpenClaw RPC client with CLI fallback
// Primary: WebSocket RPC to gateway (fast, real-time capable)
// Fallback: CLI exec via `openclaw` binary (works without gateway)
// ═══════════════════════════════════════════════════════════════

import { execFile as execFileCb } from "child_process";
import { promisify } from "util";
import { getConfig } from "./config";
import { getOpenClawClient } from "./openclaw/client";

const execFile = promisify(execFileCb);

// ── RPC-first gateway call ───────────────────────────────────

export async function gatewayCall<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  const { gatewayUrl } = getConfig();

  // If gateway URL is configured, use WebSocket RPC
  if (gatewayUrl) {
    try {
      const client = getOpenClawClient();
      const result = await client.call<T>(method, params);
      return result;
    } catch (err) {
      console.error(`[gateway] RPC failed for ${method}:`, err instanceof Error ? err.message : err);
      // Fall through to CLI
    }
  }

  // Fallback: map RPC method to CLI command
  return cliCall<T>(method, params);
}

// ── CLI fallback ─────────────────────────────────────────────

const METHOD_TO_CLI: Record<string, string[]> = {
  "health": ["gateway", "status"],
  "status": ["status"],
  "agents.list": ["agents", "list"],
  "sessions.list": ["sessions"],
  "cron.list": ["cron", "list"],
  "cron.status": ["cron", "list"],
};

async function cliCall<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  const cliArgs = METHOD_TO_CLI[method];
  if (!cliArgs) {
    throw new Error(`No CLI mapping for RPC method: ${method}`);
  }

  const args = [...cliArgs];

  // Add params as CLI flags where applicable
  if (params.query && method.startsWith("memory")) {
    args.push("--query", String(params.query));
  }
  if (params.agentId && typeof params.agentId === "string") {
    args.push("--agent", params.agentId);
  }

  return openclawExec<T>(args);
}

// ── Raw CLI execution (kept for specific commands) ───────────

export async function openclawExec<T>(args: string[]): Promise<T> {
  const { openclawBin, gatewayUrl } = getConfig();

  const env = { ...process.env };
  if (gatewayUrl) {
    env.OPENCLAW_GATEWAY_URL = gatewayUrl;
  }

  const { stdout } = await execFile(openclawBin, [...args, "--json"], {
    env: env as NodeJS.ProcessEnv,
    timeout: 10000,
    maxBuffer: 5 * 1024 * 1024,
  });

  return JSON.parse(stdout) as T;
}

export async function openclawExecRaw(args: string[]): Promise<string> {
  const { openclawBin, gatewayUrl } = getConfig();

  const env = { ...process.env };
  if (gatewayUrl) {
    env.OPENCLAW_GATEWAY_URL = gatewayUrl;
  }

  const { stdout } = await execFile(openclawBin, args, {
    env: env as NodeJS.ProcessEnv,
    timeout: 10000,
    maxBuffer: 5 * 1024 * 1024,
  });

  return stdout;
}
