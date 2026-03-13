"use client";

import { useState, useRef, useEffect } from "react";
import { useStore } from "@/lib/store";
import PixelAvatar, { getVisuals } from "@/components/PixelAvatar";
import type { Agent } from "@/lib/types";

// ─── Tabs ────────────────────────────────────────────────────────────────────

type Tab = "info" | "chat" | "assign";

// ─── Panel ───────────────────────────────────────────────────────────────────

export default function AgentPanel({
  agent,
  onClose,
}: {
  agent: Agent;
  onClose: () => void;
}) {
  const store = useStore();
  const v = getVisuals(agent.name);
  const isIdle = (agent.status === "idle" || agent.status === "offline") && !agent.currentTask;
  const isBusy = (agent.status === "online" || agent.status === "busy") && !!agent.currentTask;

  const [tab, setTab] = useState<Tab>(isBusy ? "chat" : "info");
  const [chatInput, setChatInput] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskPriority, setTaskPriority] = useState<"low" | "medium" | "high" | "critical">("medium");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const messages = store.chatMessages[agent.id] ?? [];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    store.sendMessage(agent.id, chatInput.trim());
    setChatInput("");
  };

  const handleAssignTask = () => {
    if (!taskTitle.trim()) return;
    store.assignTask(agent.id, taskTitle.trim(), taskDesc.trim() || undefined, taskPriority);
    setTaskTitle("");
    setTaskDesc("");
    setTaskPriority("medium");
    setTab("chat");
  };

  // Get tasks assigned to this agent
  const agentTasks = store.tasks.filter((t) => t.assignee === agent.name);

  return (
    <div
      className="fixed right-0 top-0 bottom-0 z-[200] flex flex-col"
      style={{
        width: 380,
        background: "#0f1015",
        borderLeft: `2px solid ${v.color}25`,
        boxShadow: `-4px 0 20px rgba(0,0,0,0.5)`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-4 px-5 py-4 flex-shrink-0"
        style={{ borderBottom: `1px solid ${v.color}15` }}
      >
        <div
          className="rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            width: 56,
            height: 56,
            background: `linear-gradient(135deg, ${v.color}20, ${v.color}08)`,
            border: `1px solid ${v.color}30`,
          }}
        >
          <PixelAvatar name={agent.name} size={44} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[16px] font-bold text-[var(--text-primary)]">{agent.name}</span>
            <span style={{ fontSize: 16 }}>{v.emoji}</span>
          </div>
          <p className="text-[12px] text-[var(--text-muted)]">{agent.role}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <div
              className="rounded-full"
              style={{
                width: 6,
                height: 6,
                background: agent.status === "online" ? "#22c55e" : agent.status === "busy" ? "#f59e0b" : agent.status === "idle" ? "#3b82f6" : "#6b7280",
                boxShadow: agent.status === "online" ? "0 0 4px #22c55e" : agent.status === "busy" ? "0 0 4px #f59e0b" : "none",
              }}
            />
            <span className="text-[11px] capitalize text-[var(--text-secondary)]">{agent.status}</span>
            {agent.currentTask && (
              <span className="text-[11px] text-[var(--text-muted)]"> — {agent.currentTask}</span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-[var(--text-muted)]" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex px-5 pt-3 gap-1 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {(["info", "chat", ...(isIdle ? ["assign" as Tab] : [])] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-3 py-2 text-[12px] font-medium capitalize transition-all rounded-t-md"
            style={
              tab === t
                ? { color: v.color, borderBottom: `2px solid ${v.color}`, background: `${v.color}08` }
                : { color: "var(--text-muted)", borderBottom: "2px solid transparent" }
            }
          >
            {t === "assign" ? "Assign Task" : t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* ── Info Tab ── */}
        {tab === "info" && (
          <div className="p-5 space-y-4">
            {/* Details */}
            <div className="space-y-3">
              <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-medium">Details</h3>
              {[
                ["Model", agent.model.includes("opus") ? "Opus 4.6" : agent.model.includes("sonnet") ? "Sonnet 4.6" : "Haiku 4.5"],
                ["Health", agent.health],
                ["Session", agent.sessionId ?? "None"],
                ["Last Seen", new Date(agent.lastSeen).toLocaleTimeString()],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[12px] text-[var(--text-muted)]">{label}</span>
                  <span className="text-[12px] text-[var(--text-primary)]">{value}</span>
                </div>
              ))}
            </div>

            {/* Tasks */}
            <div className="space-y-2">
              <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-medium">
                Tasks ({agentTasks.length})
              </h3>
              {agentTasks.length === 0 ? (
                <p className="text-[12px] text-[var(--text-muted)] italic">No tasks assigned</p>
              ) : (
                agentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-lg p-3"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          background: task.priority === "critical" ? "#ef4444" : task.priority === "high" ? "#f59e0b" : task.priority === "medium" ? "#3b82f6" : "#6b7280",
                        }}
                      />
                      <span className="text-[12px] font-medium text-[var(--text-primary)]">{task.title}</span>
                    </div>
                    <div className="flex items-center gap-2 ml-3.5">
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded capitalize"
                        style={{
                          background: task.status === "in_progress" ? "rgba(59,130,246,0.15)" : task.status === "done" ? "rgba(34,197,94,0.15)" : task.status === "review" ? "rgba(168,85,247,0.15)" : "rgba(107,114,128,0.15)",
                          color: task.status === "in_progress" ? "#60a5fa" : task.status === "done" ? "#4ade80" : task.status === "review" ? "#c084fc" : "#9ca3af",
                        }}
                      >
                        {task.status.replace("_", " ")}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] capitalize">{task.priority}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Chat Tab ── */}
        {tab === "chat" && (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <span style={{ fontSize: 32 }}>{v.emoji}</span>
                  <p className="text-[12px] text-[var(--text-muted)] mt-2">
                    Start a conversation with {agent.name}
                  </p>
                </div>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className="max-w-[80%] rounded-xl px-3 py-2"
                    style={
                      msg.role === "user"
                        ? { background: `${v.color}20`, border: `1px solid ${v.color}30` }
                        : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }
                    }
                  >
                    <p className="text-[12px] text-[var(--text-primary)] leading-relaxed">{msg.content}</p>
                    <p className="text-[9px] text-[var(--text-muted)] mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          </div>
        )}

        {/* ── Assign Task Tab ── */}
        {tab === "assign" && (
          <div className="p-5 space-y-4">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-medium block mb-2">
                Task Title
              </label>
              <input
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="What should they work on?"
                className="w-full rounded-lg px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                onKeyDown={(e) => e.key === "Enter" && handleAssignTask()}
              />
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-medium block mb-2">
                Description (optional)
              </label>
              <textarea
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                placeholder="More details..."
                rows={3}
                className="w-full rounded-lg px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none resize-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              />
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-medium block mb-2">
                Priority
              </label>
              <div className="flex gap-2">
                {(["low", "medium", "high", "critical"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setTaskPriority(p)}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-medium capitalize transition-all"
                    style={
                      taskPriority === p
                        ? {
                            background: p === "critical" ? "rgba(239,68,68,0.15)" : p === "high" ? "rgba(245,158,11,0.15)" : p === "medium" ? "rgba(59,130,246,0.15)" : "rgba(107,114,128,0.15)",
                            color: p === "critical" ? "#f87171" : p === "high" ? "#fbbf24" : p === "medium" ? "#60a5fa" : "#9ca3af",
                            border: `1px solid ${p === "critical" ? "rgba(239,68,68,0.3)" : p === "high" ? "rgba(245,158,11,0.3)" : p === "medium" ? "rgba(59,130,246,0.3)" : "rgba(107,114,128,0.3)"}`,
                          }
                        : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "var(--text-muted)" }
                    }
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleAssignTask}
              disabled={!taskTitle.trim()}
              className="w-full py-2.5 rounded-lg text-[13px] font-semibold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: `linear-gradient(135deg, ${v.color}, ${v.color}cc)` }}
            >
              Assign to {agent.name}
            </button>
          </div>
        )}
      </div>

      {/* Chat input (always visible when on chat tab) */}
      {tab === "chat" && (
        <div
          className="flex-shrink-0 p-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={`Message ${agent.name}...`}
              className="flex-1 rounded-lg px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
            />
            <button
              onClick={handleSendChat}
              disabled={!chatInput.trim()}
              className="px-3 rounded-lg transition-all disabled:opacity-30"
              style={{ background: `${v.color}20`, border: `1px solid ${v.color}30` }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 8l12-5-5 12-2-5-5-2z" fill={v.color} />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
