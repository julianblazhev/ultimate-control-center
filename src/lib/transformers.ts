// ═══════════════════════════════════════════════════════════════
// Transformers — convert raw OpenClaw CLI JSON to dashboard types
// Each function takes the raw CLI output and returns our typed data.
// ═══════════════════════════════════════════════════════════════

import type { Agent, CronJob, GatewayStatus, Session, MemoryEntry } from "./types";

// ── Agents ────────────────────────────────────────────────────
// CLI: openclaw agents list --json
// Returns: array of { id, name?, identityName?, identityEmoji?, model, workspace, bindings, isDefault, ... }

interface RawAgent {
  id: string;
  name?: string;
  identityName?: string;
  identityEmoji?: string;
  model?: string;
  workspace?: string;
  bindings?: number;
  isDefault?: boolean;
  routes?: string[];
}

export function transformAgents(raw: RawAgent[]): Agent[] {
  return raw.map((a) => ({
    id: a.id,
    name: a.identityName || a.name || a.id,
    role: a.isDefault ? "Default Agent" : "Agent",
    model: a.model || "unknown",
    status: (a.bindings ?? 0) > 0 ? "online" as const : "idle" as const,
    avatar: a.identityEmoji,
    lastSeen: new Date().toISOString(),
    health: "healthy" as const,
    currentTask: a.isDefault ? "Default routing" : undefined,
  }));
}

// ── Cron Jobs ─────────────────────────────────────────────────
// CLI: openclaw cron list --json
// Returns: { jobs: [{ id, agentId, name, description, enabled, schedule: { kind, expr, tz }, state: { nextRunAtMs, lastRunAtMs, lastRunStatus }, payload, delivery }] }

interface RawCronJob {
  id: string;
  agentId?: string;
  name: string;
  description?: string;
  enabled: boolean;
  schedule?: {
    kind?: string;
    expr?: string;
    tz?: string;
  };
  state?: {
    nextRunAtMs?: number;
    lastRunAtMs?: number;
    lastRunStatus?: string;
  };
  payload?: {
    kind?: string;
    message?: string;
  };
  delivery?: {
    mode?: string;
    channel?: string;
    to?: string;
  };
}

function msToISO(ms?: number): string | undefined {
  if (!ms) return undefined;
  return new Date(ms).toISOString();
}

export function transformCronJobs(raw: { jobs: RawCronJob[] }): CronJob[] {
  return (raw.jobs || []).map((j) => ({
    id: j.id,
    name: j.name,
    schedule: j.schedule?.expr || "unknown",
    command: j.payload?.message || j.description || "",
    enabled: j.enabled,
    lastRun: msToISO(j.state?.lastRunAtMs),
    nextRun: msToISO(j.state?.nextRunAtMs),
    status: !j.enabled
      ? "paused" as const
      : j.state?.lastRunStatus === "ok"
        ? "active" as const
        : j.state?.lastRunStatus === "error"
          ? "error" as const
          : "active" as const,
  }));
}

// ── Gateway Status ────────────────────────────────────────────
// CLI: openclaw gateway status --json
// Returns: { service: { runtime: { status, state, pid, ... }, ... }, rpc?: { url }, gateway?: { port, probeUrl }, ... }

interface RawGatewayStatus {
  service?: {
    runtime?: {
      status?: string;
      state?: string;
      pid?: number;
    };
  };
  runtime?: {
    status?: string;
    state?: string;
    pid?: number;
  };
  rpc?: { url?: string };
  gateway?: { port?: number; probeUrl?: string; version?: string };
  version?: string;
}

// CLI: openclaw status --json
// Returns: { heartbeat: { defaultAgentId, agents: [{ agentId, enabled, every, everyMs }] } }

interface RawStatus {
  heartbeat?: {
    defaultAgentId?: string;
    agents?: Array<{
      agentId: string;
      enabled: boolean;
      every?: string;
      everyMs?: number | null;
    }>;
  };
}

export function transformGatewayStatus(
  gwRaw: RawGatewayStatus,
  statusRaw?: RawStatus,
): GatewayStatus {
  const rt = gwRaw.service?.runtime || gwRaw.runtime;
  const isRunning = rt?.status === "running" || rt?.state === "active";

  const agents = statusRaw?.heartbeat?.agents || [];
  const enabledAgents = agents.filter((a) => a.enabled);

  return {
    status: isRunning ? "online" : "offline",
    version: gwRaw.gateway?.version || gwRaw.version || "unknown",
    uptime: 0, // not directly available from CLI
    activeSessions: enabledAgents.length,
    totalSessions: agents.length,
    cronJobs: 0, // filled by caller if needed
    memoryUsage: undefined,
  };
}

// ── Sessions ──────────────────────────────────────────────────
// CLI: openclaw sessions --json (no "list" subcommand)
// Format TBD — transform what we get

interface RawSession {
  id?: string;
  sessionId?: string;
  agentId?: string;
  name?: string;
  model?: string;
  status?: string;
  state?: string;
  startedAt?: string;
  createdAt?: string;
  createdAtMs?: number;
  lastActivity?: string;
  updatedAt?: string;
  updatedAtMs?: number;
  messageCount?: number;
  turns?: number;
}

export function transformSessions(raw: RawSession[] | { sessions: RawSession[] }): Session[] {
  const list = Array.isArray(raw) ? raw : (raw.sessions || []);
  return list.map((s, i) => ({
    id: s.id || s.sessionId || `s-${i}`,
    name: s.name || s.agentId || `Session ${i + 1}`,
    model: s.model || "unknown",
    status: mapSessionStatus(s.status || s.state),
    startedAt: s.startedAt || s.createdAt || msToISO(s.createdAtMs) || new Date().toISOString(),
    lastActivity: s.lastActivity || s.updatedAt || msToISO(s.updatedAtMs) || new Date().toISOString(),
    messageCount: s.messageCount || s.turns || 0,
  }));
}

function mapSessionStatus(s?: string): Session["status"] {
  if (!s) return "idle";
  const lower = s.toLowerCase();
  if (lower === "active" || lower === "running") return "active";
  if (lower === "idle" || lower === "paused") return "idle";
  if (lower === "stopped" || lower === "closed" || lower === "ended") return "stopped";
  if (lower === "error" || lower === "failed") return "error";
  return "idle";
}

// ── Memory ────────────────────────────────────────────────────
// CLI: openclaw memory search --query <text> --json
// Format TBD

interface RawMemoryEntry {
  id?: string;
  file?: string;
  path?: string;
  title?: string;
  type?: string;
  kind?: string;
  date?: string;
  createdAt?: string;
  content?: string;
  preview?: string;
  snippet?: string;
  wordCount?: number;
}

export function transformMemory(raw: RawMemoryEntry[] | { entries: RawMemoryEntry[] } | { results: RawMemoryEntry[] }): MemoryEntry[] {
  const list = Array.isArray(raw)
    ? raw
    : ((raw as { entries: RawMemoryEntry[] }).entries || (raw as { results: RawMemoryEntry[] }).results || []);

  return list.map((m, i) => {
    const content = m.content || m.snippet || m.preview || "";
    const words = content.split(/\s+/).filter(Boolean);
    return {
      id: m.id || m.file || `m-${i}`,
      type: mapMemoryType(m.type || m.kind),
      title: m.title || m.file || `Memory ${i + 1}`,
      date: m.date || m.createdAt || new Date().toISOString().slice(0, 10),
      preview: (m.preview || m.snippet || content).slice(0, 200),
      content,
      wordCount: m.wordCount || words.length,
      file: m.file || m.path,
    };
  });
}

function mapMemoryType(t?: string): MemoryEntry["type"] {
  if (!t) return "journal";
  const lower = t.toLowerCase();
  if (lower.includes("long") || lower.includes("permanent") || lower.includes("core")) return "long_term";
  return "journal";
}
