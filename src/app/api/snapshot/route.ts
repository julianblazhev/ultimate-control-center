// ═══════════════════════════════════════════════════════════════
// API Route — GET /api/snapshot
// Aggregates all gateway data into a single response for the UI.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { openclawExec } from "@/lib/gateway";
import { transformAgents, transformCronJobs, transformGatewayStatus, transformSessions } from "@/lib/transformers";
import type { Agent, Session, CronJob, GatewayStatus } from "@/lib/types";

export interface Snapshot {
  agents: Agent[];
  sessions: Session[];
  cronJobs: CronJob[];
  gateway: GatewayStatus;
  errors: string[];
}

export async function GET(): Promise<NextResponse<{ data: Snapshot; timestamp: string }>> {
  const errors: string[] = [];

  // Fetch all data sources in parallel — each one independent
  const [agentsResult, sessionsResult, cronResult, gatewayResult, statusResult] = await Promise.allSettled([
    openclawExec<unknown[]>(["agents", "list"]),
    openclawExec<unknown>(["sessions"]),
    openclawExec<unknown>(["cron", "list"]),
    openclawExec<unknown>(["gateway", "status"]),
    openclawExec<unknown>(["status"]),
  ]);

  // Agents
  let agents: Agent[] = [];
  if (agentsResult.status === "fulfilled") {
    try {
      agents = transformAgents(agentsResult.value as Parameters<typeof transformAgents>[0]);
    } catch (e) { errors.push(`agents transform: ${e instanceof Error ? e.message : "unknown"}`); }
  } else {
    errors.push(`agents: ${agentsResult.reason}`);
  }

  // Sessions
  let sessions: Session[] = [];
  if (sessionsResult.status === "fulfilled") {
    try {
      sessions = transformSessions(sessionsResult.value as Parameters<typeof transformSessions>[0]);
    } catch (e) { errors.push(`sessions transform: ${e instanceof Error ? e.message : "unknown"}`); }
  } else {
    errors.push(`sessions: ${sessionsResult.reason}`);
  }

  // Cron
  let cronJobs: CronJob[] = [];
  if (cronResult.status === "fulfilled") {
    try {
      cronJobs = transformCronJobs(cronResult.value as Parameters<typeof transformCronJobs>[0]);
    } catch (e) { errors.push(`cron transform: ${e instanceof Error ? e.message : "unknown"}`); }
  } else {
    errors.push(`cron: ${cronResult.reason}`);
  }

  // Gateway status
  let gateway: GatewayStatus = { status: "offline", version: "unknown", uptime: 0, activeSessions: 0, totalSessions: 0, cronJobs: 0 };
  if (gatewayResult.status === "fulfilled") {
    try {
      const statusRaw = statusResult.status === "fulfilled" ? statusResult.value : undefined;
      gateway = transformGatewayStatus(
        gatewayResult.value as Parameters<typeof transformGatewayStatus>[0],
        statusRaw as Parameters<typeof transformGatewayStatus>[1],
      );
      gateway.cronJobs = cronJobs.length;
      gateway.activeSessions = sessions.filter(s => s.status === "active").length || agents.length;
      gateway.totalSessions = sessions.length || agents.length;
    } catch (e) { errors.push(`gateway transform: ${e instanceof Error ? e.message : "unknown"}`); }
  } else {
    errors.push(`gateway: ${gatewayResult.reason}`);
  }

  const data: Snapshot = { agents, sessions, cronJobs, gateway, errors };
  return NextResponse.json({ data, timestamp: new Date().toISOString() });
}
