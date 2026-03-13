"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { useStore } from "@/lib/store";
import type { Task } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type ColumnId = "backlog" | "in_progress" | "review" | "done";

const COLUMN_META: { id: ColumnId; label: string; dot: string }[] = [
  { id: "backlog", label: "Backlog", dot: "bg-gray-400" },
  { id: "in_progress", label: "In Progress", dot: "bg-blue-400" },
  { id: "review", label: "Review", dot: "bg-purple-400" },
  { id: "done", label: "Done", dot: "bg-green-400" },
];

// ─── Priority dot colors ──────────────────────────────────────────────────────

const PRIORITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-amber-500",
  medium: "bg-blue-400",
  low: "bg-gray-400",
};

// ─── Agent avatar colors (stable by name) ─────────────────────────────────────

const AVATAR_COLORS: Record<string, string> = {
  Henry: "from-violet-500 to-purple-600",
  Alex: "from-indigo-500 to-blue-600",
  Scout: "from-slate-500 to-gray-600",
  Quill: "from-amber-500 to-yellow-600",
  Echo: "from-slate-400 to-gray-500",
  Violet: "from-purple-500 to-violet-600",
  Codex: "from-orange-500 to-amber-600",
  Charlie: "from-green-500 to-emerald-600",
  Ralph: "from-gray-500 to-slate-600",
  Pixel: "from-pink-500 to-rose-600",
};

// ─── Agent color for activity feed ────────────────────────────────────────────

const AGENT_ACTIVITY_COLORS: Record<string, string> = {
  Henry: "text-violet-400",
  Alex: "text-indigo-400",
  Scout: "text-slate-400",
  Quill: "text-amber-400",
  Echo: "text-gray-400",
  Violet: "text-purple-400",
  Codex: "text-orange-400",
  Charlie: "text-green-400",
  Ralph: "text-slate-400",
  Pixel: "text-pink-400",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffS = Math.floor(diffMs / 1000);
  if (diffS < 60) return "just now";
  const diffM = Math.floor(diffS / 60);
  if (diffM < 60) return `${diffM}m ago`;
  const diffH = Math.floor(diffM / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

function getThisWeekCount(tasks: Task[]): number {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return tasks.filter((t) => new Date(t.updatedAt).getTime() >= cutoff).length;
}

// ─── Task Card ────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
  isDragging: boolean;
}

function TaskCard({ task, onDragStart, onDragEnd, isDragging }: TaskCardProps) {
  const avatarGradient = task.assignee
    ? AVATAR_COLORS[task.assignee] ?? "from-gray-500 to-gray-600"
    : "";

  return (
    <div
      className="rounded-xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg active:cursor-grabbing select-none"
      style={{
        opacity: isDragging ? 0.4 : 1,
        cursor: "grab",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "12px",
      }}
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
    >
        {/* Priority dot + title */}
        <div className="flex items-start gap-2 mb-1.5">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${PRIORITY_DOT[task.priority] ?? "bg-gray-400"}`}
          />
          <h3 className="text-[13px] font-medium text-[var(--text-primary)] leading-snug line-clamp-2">
            {task.title}
          </h3>
        </div>

        {/* Description */}
        {task.description && (
          <p className="text-[11px] leading-relaxed text-[var(--text-muted)] mb-3 ml-4 line-clamp-2">
            {task.description}
          </p>
        )}

        {/* Bottom row: avatar + project tag + timestamp */}
        <div className="flex items-center justify-between mt-auto ml-4">
          <div className="flex items-center gap-2">
            {task.assignee && (
              <div
                className={`w-5 h-5 rounded-full bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0`}
              >
                {task.assignee.charAt(0)}
              </div>
            )}
            {task.project && (
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: "var(--text-secondary)",
                }}
              >
                {task.project}
              </span>
            )}
          </div>
          <span className="text-[10px] text-[var(--text-muted)]">
            {relativeTime(task.updatedAt)}
          </span>
        </div>
      </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const store = useStore();
  const tasks = store.tasks;
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnId | null>(null);
  const [filterAssignee, setFilterAssignee] = useState<string | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [newAssignee, setNewAssignee] = useState("");
  const [newProject, setNewProject] = useState("");
  const dragLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allAssignees = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.assignee).filter(Boolean) as string[])),
    [tasks]
  );

  const availableAgents = useMemo(
    () => store.agents.map((a) => ({
      name: a.name,
      busy: (a.status === "busy" || a.status === "online") && !!a.currentTask,
      status: a.status,
    })),
    [store.agents]
  );

  const handleCreateTask = () => {
    if (!newTitle.trim()) return;
    const assignee = newAssignee || undefined;
    const status = assignee ? "in_progress" as const : "backlog" as const;
    store.createTask(newTitle.trim(), newDesc.trim() || undefined, newPriority, status, assignee, newProject.trim() || undefined);
    setNewTitle("");
    setNewDesc("");
    setNewPriority("medium");
    setNewAssignee("");
    setNewProject("");
    setShowNewTask(false);
  };

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const thisWeek = getThisWeekCount(tasks);
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;
  const totalCount = tasks.length;
  const completionPct = tasks.length
    ? Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100)
    : 0;

  // ── Filtered tasks ───────────────────────────────────────────────────────
  const filteredTasks = filterAssignee
    ? tasks.filter((t) => t.assignee === filterAssignee)
    : tasks;

  const tasksByColumn: Record<ColumnId, Task[]> = {
    backlog: filteredTasks.filter((t) => t.status === "backlog"),
    in_progress: filteredTasks.filter((t) => t.status === "in_progress"),
    review: filteredTasks.filter((t) => t.status === "review"),
    done: filteredTasks.filter((t) => t.status === "done"),
  };

  // ── DnD ──────────────────────────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(taskId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setDragOverColumn(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, columnId: ColumnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragLeaveTimer.current) {
      clearTimeout(dragLeaveTimer.current);
      dragLeaveTimer.current = null;
    }
    setDragOverColumn(columnId);
  }, []);

  const handleDragLeave = useCallback(() => {
    dragLeaveTimer.current = setTimeout(() => setDragOverColumn(null), 50);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetColumn: ColumnId) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;
    store.updateTaskStatus(taskId, targetColumn);
    setDraggingId(null);
    setDragOverColumn(null);
  }, [store]);

  // ── Activity feed (last 8 events) ────────────────────────────────────────
  const recentActivity = store.activity.slice(0, 8);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex gap-0 min-h-[calc(100vh-56px)]" style={{ marginLeft: "-24px", marginRight: "-24px", marginTop: "-24px", marginBottom: "-24px" }}>
      {/* Main content */}
      <div className="flex-1 p-6 overflow-auto">
        {/* KPI Strip */}
        <div className="flex items-baseline gap-6 mb-5 flex-wrap">
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-[var(--text-primary)]">{thisWeek}</span>
            <span className="text-[13px] text-[var(--text-muted)]">This week</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-[var(--text-primary)]">{inProgressCount}</span>
            <span className="text-[13px] text-[var(--text-muted)]">In progress</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-[var(--text-primary)]">{totalCount}</span>
            <span className="text-[13px] text-[var(--text-muted)]">Total</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-[var(--text-primary)]">{completionPct}%</span>
            <span className="text-[13px] text-[var(--text-muted)]">Completion</span>
          </div>
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <button
            onClick={() => setShowNewTask(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] font-medium text-white transition-colors hover:brightness-110"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
          >
            <span className="text-base leading-none">+</span>
            New task
          </button>

          {/* Agent filter pills */}
          {allAssignees.map((name) => (
            <button
              key={name}
              onClick={() => setFilterAssignee(filterAssignee === name ? null : name)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                filterAssignee === name
                  ? "bg-white/10 text-white border border-white/20"
                  : "text-[var(--text-secondary)] hover:bg-white/5 border border-transparent"
              }`}
            >
              {name}
            </button>
          ))}

          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] text-[var(--text-secondary)] border border-[var(--border-color)] ml-auto cursor-default"
          >
            All projects
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="opacity-50">
              <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Kanban columns */}
        <div className="grid grid-cols-4 gap-4">
          {COLUMN_META.map((col) => {
            const colTasks = tasksByColumn[col.id];
            const isOver = dragOverColumn === col.id;

            return (
              <div
                key={col.id}
                className="flex flex-col min-h-[400px]"
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                {/* Column header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                    <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                      {col.label}
                    </span>
                    <span className="text-[12px] text-[var(--text-muted)]">{colTasks.length}</span>
                  </div>
                  <button
                    onClick={() => setShowNewTask(true)}
                    className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>

                {/* Cards container */}
                <div
                  className={`flex flex-col gap-3 flex-1 rounded-xl p-1 transition-all ${
                    isOver ? "ring-1 ring-blue-500/30 bg-blue-500/5" : ""
                  }`}
                >
                  {colTasks.length === 0 ? (
                    <div className="flex items-center justify-center flex-1 text-[12px] text-[var(--text-muted)] opacity-60">
                      No tasks
                    </div>
                  ) : (
                    colTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        isDragging={draggingId === task.id}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Activity sidebar */}
      <div
        className="w-[280px] flex-shrink-0 border-l overflow-y-auto p-4"
        style={{ borderColor: "var(--border-color)", background: "rgba(0,0,0,0.15)" }}
      >
        <h2 className="text-[14px] font-semibold text-[var(--text-primary)] mb-4">
          Live Activity
        </h2>

        <div className="space-y-4">
          {recentActivity.map((event) => {
            const agentMatch = store.agents.find((a) =>
              event.message.includes(a.name)
            );
            const agentName = agentMatch?.name ?? "System";
            const nameColor = AGENT_ACTIVITY_COLORS[agentName] ?? "text-[var(--text-secondary)]";

            return (
              <div key={event.id} className="flex gap-2.5">
                <div className="flex-shrink-0 mt-0.5">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-[var(--text-muted)]">
                    <path d="M2 7h3l2-4 2 8 2-4h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`text-[12px] font-semibold ${nameColor}`}>
                    {agentName}
                  </span>
                  {event.timestamp && (
                    <span className="text-[10px] text-[var(--text-muted)] ml-2">
                      {relativeTime(event.timestamp)}
                    </span>
                  )}
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed mt-0.5 line-clamp-2">
                    {event.message}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* New Task Modal */}
      {showNewTask && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowNewTask(false)}
        >
          <div
            className="w-full max-w-md rounded-xl p-6 flex flex-col gap-4"
            style={{ background: "#12131a", border: "1px solid rgba(255,255,255,0.1)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">New Task</h2>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-medium block mb-1.5">Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Task title"
                autoFocus
                className="w-full rounded-lg px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                onKeyDown={(e) => e.key === "Enter" && handleCreateTask()}
              />
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-medium block mb-1.5">Description</label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Optional details..."
                rows={2}
                className="w-full rounded-lg px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none resize-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-medium block mb-1.5">Priority</label>
                <div className="flex gap-1.5">
                  {(["low", "medium", "high", "critical"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setNewPriority(p)}
                      className="flex-1 py-1.5 rounded-lg text-[11px] font-medium capitalize transition-all"
                      style={
                        newPriority === p
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
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-medium block mb-1.5">Assign to</label>
                <select
                  value={newAssignee}
                  onChange={(e) => setNewAssignee(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none appearance-none cursor-pointer"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <option value="">Unassigned (Backlog)</option>
                  {availableAgents.map((a) => (
                    <option key={a.name} value={a.name} disabled={a.busy}>
                      {a.name}{a.busy ? ` (${a.status})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-medium block mb-1.5">Project</label>
                <input
                  type="text"
                  value={newProject}
                  onChange={(e) => setNewProject(e.target.value)}
                  placeholder="e.g. Platform"
                  className="w-full rounded-lg px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-1">
              <button
                onClick={() => setShowNewTask(false)}
                className="flex-1 py-2.5 rounded-lg text-[13px] font-medium transition-all text-[var(--text-secondary)] hover:bg-white/5"
                style={{ border: "1px solid rgba(255,255,255,0.1)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTask}
                disabled={!newTitle.trim()}
                className="flex-1 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110"
                style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
              >
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
