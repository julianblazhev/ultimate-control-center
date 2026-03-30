"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import PixelAvatar, { getVisuals } from "@/components/PixelAvatar";
import AgentPanel from "@/components/AgentPanel";

// ── helpers ──────────────────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffS = Math.floor(diffMs / 1000);
  if (diffS < 60) return "just now";
  const diffM = Math.floor(diffS / 60);
  if (diffM < 60) return `${diffM}m ago`;
  const diffH = Math.floor(diffM / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

// ── constants ────────────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  critical: { bg: "rgba(239,68,68,0.12)", text: "#f87171", dot: "#ef4444" },
  high:     { bg: "rgba(245,158,11,0.12)", text: "#fbbf24", dot: "#f59e0b" },
  medium:   { bg: "rgba(59,130,246,0.12)", text: "#60a5fa", dot: "#3b82f6" },
  low:      { bg: "rgba(107,114,128,0.12)", text: "#9ca3af", dot: "#6b7280" },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  in_progress: { bg: "rgba(59,130,246,0.12)", text: "#60a5fa" },
  review:      { bg: "rgba(168,85,247,0.12)", text: "#c084fc" },
  backlog:     { bg: "rgba(107,114,128,0.12)", text: "#9ca3af" },
  done:        { bg: "rgba(34,197,94,0.12)", text: "#4ade80" },
};

const SEVERITY_COLORS: Record<string, string> = {
  success: "#4ade80",
  warning: "#fbbf24",
  error:   "#f87171",
  info:    "#60a5fa",
};

// ── page ─────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const store = useStore();
  const [panelAgentId, setPanelAgentId] = useState<string | null>(null);
  const panelAgent = panelAgentId ? store.agents.find((a) => a.id === panelAgentId) ?? null : null;

  const onlineCount = store.agents.filter((a) => a.status === "online" || a.status === "busy").length;
  const busyCount = store.agents.filter((a) => (a.status === "online" || a.status === "busy") && a.currentTask).length;
  const idleCount = store.agents.filter((a) => a.status === "idle" || a.status === "offline").length;

  const tasksByStatus = {
    in_progress: store.tasks.filter((t) => t.status === "in_progress"),
    review: store.tasks.filter((t) => t.status === "review"),
    backlog: store.tasks.filter((t) => t.status === "backlog"),
    done: store.tasks.filter((t) => t.status === "done"),
  };

  const activeTasks = [...tasksByStatus.in_progress, ...tasksByStatus.review]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  if (store.loading) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[13px] text-[var(--text-muted)]">Loading gateway data...</p>
        </div>
      </div>
    );
  }

  if (store.error && store.agents.length === 0) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3">
            <span className="text-red-400 text-lg">!</span>
          </div>
          <p className="text-[14px] text-[var(--text-primary)] font-medium mb-1">Gateway Unreachable</p>
          <p className="text-[12px] text-[var(--text-muted)] mb-4">{store.error}</p>
          <button onClick={() => store.refresh()} className="text-[12px] text-blue-400 hover:text-blue-300 transition-colors">↻ Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-[calc(100vh-56px)]"
      style={{ marginLeft: "-24px", marginRight: "-24px", marginTop: "-24px", marginBottom: "-24px", padding: "24px" }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
            Mission Overview
          </h1>
          <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
            Real-time status of your AI workforce
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => store.refresh()} className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">↻ Refresh</button>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${store.gateway.status === "online" ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
            <span className={`text-[11px] font-medium ${store.gateway.status === "online" ? "text-green-400" : "text-red-400"}`}>
              {store.gateway.status === "online" ? `Gateway v${store.gateway.version} · up ${formatUptime(store.gateway.uptime)}` : "Gateway Offline"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Agents Working", value: busyCount, sub: `of ${store.agents.length}`, color: "#f59e0b", icon: "⚡" },
          { label: "Available", value: idleCount, sub: "ready to assign", color: "#22c55e", icon: "✦" },
          { label: "Active Tasks", value: tasksByStatus.in_progress.length + tasksByStatus.review.length, sub: `${tasksByStatus.backlog.length} in backlog`, color: "#818cf8", icon: "◈" },
          { label: "Completed", value: tasksByStatus.done.length, sub: `of ${store.tasks.length} total`, color: "#4ade80", icon: "✓" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl p-4 transition-all hover:brightness-110"
            style={{
              background: `linear-gradient(135deg, ${stat.color}08, ${stat.color}03)`,
              border: `1px solid ${stat.color}18`,
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[14px]" style={{ color: stat.color }}>{stat.icon}</span>
              <span className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider font-medium">{stat.label}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[28px] font-bold" style={{ color: stat.color }}>{stat.value}</span>
              <span className="text-[11px] text-[var(--text-muted)]">{stat.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Team Pulse — All Agents ── */}
      <div
        className="rounded-xl p-4 mb-6"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">Team Pulse</h2>
          <span className="text-[11px] text-[var(--text-muted)]">
            {onlineCount} online &middot; {idleCount} available
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {store.agents.map((agent) => {
            const v = getVisuals(agent.name);
            const isWorking = (agent.status === "online" || agent.status === "busy") && !!agent.currentTask;
            const statusColor = agent.status === "online" ? "#22c55e" : agent.status === "busy" ? "#f59e0b" : agent.status === "idle" ? "#3b82f6" : "#6b7280";

            return (
              <button
                key={agent.id}
                onClick={() => setPanelAgentId(agent.id)}
                className="rounded-lg p-3 text-left transition-all hover:brightness-125 group"
                style={{
                  background: isWorking ? `${v.color}08` : "rgba(255,255,255,0.02)",
                  border: `1px solid ${isWorking ? `${v.color}20` : "rgba(255,255,255,0.05)"}`,
                }}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="relative flex-shrink-0">
                    <div
                      className="rounded-md flex items-center justify-center group-hover:scale-110 transition-transform"
                      style={{
                        width: 36,
                        height: 36,
                        background: `${v.color}12`,
                      }}
                    >
                      <PixelAvatar name={agent.name} size={28} />
                    </div>
                    {/* Status dot */}
                    <div
                      className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                      style={{
                        background: statusColor,
                        borderColor: "#0f1015",
                        boxShadow: isWorking ? `0 0 6px ${statusColor}` : "none",
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="text-[12px] font-semibold text-[var(--text-primary)]">{agent.name}</span>
                      <span className="text-[11px]">{v.emoji}</span>
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] truncate">{agent.role}</p>
                  </div>
                </div>

                {isWorking ? (
                  <div
                    className="rounded-md px-2 py-1.5"
                    style={{ background: `${v.color}08`, border: `1px solid ${v.color}12` }}
                  >
                    <p className="text-[10px] text-[var(--text-secondary)] truncate leading-snug">
                      {agent.currentTask}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md px-2 py-1.5" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <p className="text-[10px] text-[var(--text-muted)] italic">Available</p>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Two-column: Active Work + Activity ── */}
      <div className="flex flex-col lg:flex-row gap-5">

        {/* Left: Active Work */}
        <div className="lg:w-[60%]">
          <div
            className="rounded-xl p-4 h-full"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">Active Work</h2>
              <div className="flex gap-2">
                {(["in_progress", "review", "backlog"] as const).map((s) => {
                  const sc = STATUS_COLORS[s];
                  const count = tasksByStatus[s].length;
                  return (
                    <span
                      key={s}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                      style={{ background: sc.bg, color: sc.text }}
                    >
                      {count} {s.replace("_", " ")}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              {activeTasks.length === 0 && (
                <p className="text-[12px] text-[var(--text-muted)] italic py-4 text-center">No active tasks</p>
              )}
              {activeTasks.map((task) => {
                const pc = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.medium;
                const sc = STATUS_COLORS[task.status] ?? STATUS_COLORS.backlog;
                const assignedAgent = task.assignee ? store.agents.find((a) => a.name === task.assignee) : null;
                const av = assignedAgent ? getVisuals(assignedAgent.name) : null;

                return (
                  <div
                    key={task.id}
                    className="rounded-lg px-3.5 py-3 transition-all hover:brightness-110"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div className="flex items-start gap-3">
                      {/* Priority indicator */}
                      <div className="flex-shrink-0 mt-1">
                        <div className="w-2 h-2 rounded-full" style={{ background: pc.dot }} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                            {task.title}
                          </span>
                          <span
                            className="text-[9px] font-medium px-1.5 py-0.5 rounded capitalize flex-shrink-0"
                            style={{ background: sc.bg, color: sc.text }}
                          >
                            {task.status.replace("_", " ")}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          {assignedAgent && av && (
                            <button
                              onClick={() => setPanelAgentId(assignedAgent.id)}
                              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                            >
                              <div
                                className="rounded flex items-center justify-center"
                                style={{ width: 18, height: 18, background: `${av.color}15` }}
                              >
                                <PixelAvatar name={assignedAgent.name} size={14} />
                              </div>
                              <span className="text-[11px]" style={{ color: av.color }}>{assignedAgent.name}</span>
                            </button>
                          )}
                          {task.project && (
                            <span
                              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                              style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)" }}
                            >
                              {task.project}
                            </span>
                          )}
                          <span className="text-[10px] text-[var(--text-muted)] ml-auto flex-shrink-0">
                            {relativeTime(task.updatedAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Activity + System */}
        <div className="lg:w-[40%] flex flex-col gap-5">

          {/* System Status */}
          <div
            className="rounded-xl p-4"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <h2 className="text-[13px] font-semibold text-[var(--text-primary)] mb-3">System</h2>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { label: "Sessions", value: store.gateway.activeSessions, total: store.gateway.totalSessions },
                { label: "Memory", value: store.gateway.memoryUsage !== undefined ? `${store.gateway.memoryUsage}%` : "N/A", color: (store.gateway.memoryUsage ?? 0) > 80 ? "#f87171" : (store.gateway.memoryUsage ?? 0) > 60 ? "#fbbf24" : "#4ade80" },
                { label: "Cron Jobs", value: store.gateway.cronJobs },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-lg px-3 py-2 text-center"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <p
                    className="text-[16px] font-bold"
                    style={{ color: 'color' in s && s.color ? s.color : "var(--text-primary)" }}
                  >
                    {s.value}
                    {'total' in s && s.total !== undefined && (
                      <span className="text-[11px] text-[var(--text-muted)] font-normal">/{s.total}</span>
                    )}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Memory bar */}
            {store.gateway.memoryUsage !== undefined && (
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-[var(--text-muted)]">Memory</span>
                  <span style={{ color: store.gateway.memoryUsage > 80 ? "#f87171" : store.gateway.memoryUsage > 60 ? "#fbbf24" : "#4ade80" }}>
                    {store.gateway.memoryUsage}%
                  </span>
                </div>
                <div className="w-full rounded-full h-1" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div
                    className="h-1 rounded-full transition-all"
                    style={{
                      width: `${store.gateway.memoryUsage}%`,
                      background: store.gateway.memoryUsage > 80 ? "#f87171" : store.gateway.memoryUsage > 60 ? "#fbbf24" : "#4ade80",
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Activity Feed */}
          <div
            className="rounded-xl p-4 flex-1"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">Activity</h2>
              <span className="text-[11px] text-[var(--text-muted)]">{store.activity.length} events</span>
            </div>

            <div className="space-y-1">
              {store.activity.slice(0, 10).map((event) => {
                const sevColor = SEVERITY_COLORS[event.severity ?? "info"] ?? SEVERITY_COLORS.info;

                return (
                  <div
                    key={event.id}
                    className="flex items-start gap-2.5 px-2.5 py-2 rounded-lg transition-all hover:brightness-110"
                    style={{ background: "rgba(255,255,255,0.02)" }}
                  >
                    <div className="flex-shrink-0 mt-1.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: sevColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] leading-snug text-[var(--text-secondary)]">
                        {event.message}
                      </p>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {relativeTime(event.timestamp)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Agent Panel */}
      {panelAgent && (
        <AgentPanel agent={panelAgent} onClose={() => setPanelAgentId(null)} />
      )}
    </div>
  );
}
