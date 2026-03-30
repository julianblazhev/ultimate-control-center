"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import type { Routine } from "@/lib/types";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTime(time: string): string {
  if (time === "continuous") return "Continuous";
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

// Stable color per routine name
const ROUTINE_COLORS: Record<string, string> = {
  "Trend Radar": "text-amber-400",
  "Trend Radar Daily Digest": "text-amber-300",
  "Morning Kickoff": "text-blue-300",
  "Scout Morning Research": "text-green-400",
  "Morning Brief": "text-purple-400",
  "Quill Script Writer": "text-cyan-400",
  "Daily Digest": "text-blue-400",
  "Evening Wrap Up": "text-indigo-300",
  "Weekly Newsletter Draft": "text-pink-400",
  "Stock Scarcity Research": "text-amber-300",
};

const ROUTINE_BG: Record<string, string> = {
  "Trend Radar": "rgba(251,191,36,0.08)",
  "Trend Radar Daily Digest": "rgba(251,191,36,0.05)",
  "Morning Kickoff": "rgba(96,165,250,0.06)",
  "Scout Morning Research": "rgba(74,222,128,0.06)",
  "Morning Brief": "rgba(192,132,252,0.06)",
  "Quill Script Writer": "rgba(34,211,238,0.06)",
  "Daily Digest": "rgba(96,165,250,0.06)",
  "Evening Wrap Up": "rgba(165,180,252,0.06)",
  "Weekly Newsletter Draft": "rgba(244,114,182,0.06)",
  "Stock Scarcity Research": "rgba(251,191,36,0.05)",
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Build weekly schedule ──────────────────────────────────────────────────

function buildWeekSchedule(routines: Routine[]) {
  const today = new Date().getDay(); // 0=Sun
  const schedule: Record<number, Routine[]> = {};
  for (let i = 0; i < 7; i++) schedule[i] = [];

  for (const r of routines) {
    if (r.type === "always_running") continue;
    if (r.type === "daily") {
      for (let i = 0; i < 7; i++) schedule[i].push(r);
    } else if (r.type === "weekly") {
      // Put weekly routines on specific days for variety
      if (r.name === "Weekly Newsletter Draft") {
        schedule[3].push(r); // Wed
      } else if (r.name === "Stock Scarcity Research") {
        schedule[1].push(r); // Mon
      } else {
        schedule[today].push(r);
      }
    }
  }

  // Sort each day by time
  for (let i = 0; i < 7; i++) {
    schedule[i].sort((a, b) => {
      const ta = a.time === "continuous" ? "99:99" : a.time;
      const tb = b.time === "continuous" ? "99:99" : b.time;
      return ta.localeCompare(tb);
    });
  }

  return { schedule, today };
}

// ─── Always Running Pill ────────────────────────────────────────────────────

function AlwaysRunningPill({ routine }: { routine: Routine }) {
  const isHighlighted = routine.name === "Trend Radar Scanner";

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
        isHighlighted
          ? "text-amber-300 border border-amber-500/30"
          : "text-[var(--text-secondary)] border border-[var(--border-color)]"
      }`}
      style={{
        background: isHighlighted ? "rgba(251,191,36,0.1)" : "rgba(255,255,255,0.03)",
      }}
    >
      {routine.name}
      <span className="text-[var(--text-muted)]">
        {routine.schedule}
      </span>
    </div>
  );
}

// ─── Routine Card (in weekly grid cell) ─────────────────────────────────────

function RoutineCell({ routine }: { routine: Routine }) {
  const color = ROUTINE_COLORS[routine.name] ?? "text-[var(--text-secondary)]";
  const bg = ROUTINE_BG[routine.name] ?? "rgba(255,255,255,0.03)";

  return (
    <div
      className="rounded-lg px-2.5 py-2 transition-all hover:brightness-110"
      style={{
        background: bg,
        border: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <p className={`text-[11px] font-medium leading-tight truncate ${color}`}>
        {routine.name}
      </p>
      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
        {formatTime(routine.time)}
      </p>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

type ViewMode = "week" | "today";

export default function CalendarPage() {
  const [view, setView] = useState<ViewMode>("week");
  const store = useStore();

  // Routines aren't directly available from CLI — derive from cron jobs or show empty
  const routines: Routine[] = store.cronJobs.map((job) => ({
    id: job.id,
    name: job.name,
    schedule: job.schedule,
    time: job.schedule.startsWith("*/") ? "continuous" : (() => {
      const parts = job.schedule.split(" ");
      if (parts.length >= 2) {
        const minute = parts[0].padStart(2, "0");
        const hour = parts[1] === "*" ? "00" : parts[1].padStart(2, "0");
        return `${hour}:${minute}`;
      }
      return "00:00";
    })(),
    duration: 10,
    type: job.schedule.includes("* * *") ? "daily" as const : job.schedule.startsWith("*/") ? "always_running" as const : "weekly" as const,
    enabled: job.enabled,
    description: job.command,
  }));

  const alwaysRunning = routines.filter((r) => r.type === "always_running");
  const scheduled = routines.filter((r) => r.type !== "always_running");
  const { schedule, today } = buildWeekSchedule(scheduled);

  return (
    <div
      className="flex flex-col min-h-[calc(100vh-56px)]"
      style={{ marginLeft: "-24px", marginRight: "-24px", marginTop: "-24px", marginBottom: "-24px", padding: "24px" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Scheduled Tasks</h1>
          <p className="text-[13px] text-[var(--text-muted)] mt-0.5">Automated routines</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-[var(--border-color)]">
            <button
              onClick={() => setView("week")}
              className={`px-4 py-1.5 text-[12px] font-medium transition-colors ${
                view === "week"
                  ? "bg-white/10 text-white"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setView("today")}
              className={`px-4 py-1.5 text-[12px] font-medium transition-colors ${
                view === "today"
                  ? "bg-white/10 text-white"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              Today
            </button>
          </div>
          <button className="p-1.5 rounded-lg hover:bg-white/5 text-[var(--text-muted)] transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M13.65 7.015A5.5 5.5 0 008 2.5v3L4.5 2.5 8 0v2.5a6.5 6.5 0 016.65 5.515" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M2.35 8.985A5.5 5.5 0 008 13.5v-3l3.5 3L8 16v-2.5A6.5 6.5 0 011.35 8.985" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Always Running section */}
      <div
        className="rounded-xl p-4 mb-5"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-emerald-400">
            <path d="M4 8l2 2 4-4M2 4l2-2M12 4l2-2M8 2v1M8 13v1M3 8H2M14 8h-1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[13px] font-semibold text-[var(--text-primary)]">Always Running</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {alwaysRunning.map((r) => (
            <AlwaysRunningPill key={r.id} routine={r} />
          ))}
        </div>
      </div>

      {/* Weekly Grid / Today view */}
      {view === "week" ? (
        <div
          className="flex-1 rounded-xl overflow-hidden"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="grid grid-cols-7 min-h-[500px]">
            {DAYS.map((day, idx) => {
              const isToday = idx === today;
              const dayRoutines = schedule[idx] ?? [];

              return (
                <div
                  key={day}
                  className="flex flex-col border-r last:border-r-0"
                  style={{ borderColor: "rgba(255,255,255,0.06)" }}
                >
                  {/* Day header */}
                  <div
                    className={`px-3 py-2.5 text-[13px] font-semibold border-b ${
                      isToday ? "text-amber-400" : "text-[var(--text-primary)]"
                    }`}
                    style={{
                      borderColor: "rgba(255,255,255,0.06)",
                      background: isToday ? "rgba(251,191,36,0.05)" : "transparent",
                    }}
                  >
                    {day}
                  </div>

                  {/* Routine cards */}
                  <div className="flex flex-col gap-1.5 p-2 flex-1 overflow-y-auto">
                    {dayRoutines.map((r, i) => (
                      <RoutineCell key={`${r.id}-${idx}-${i}`} routine={r} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Today view — just today's column expanded */
        <div
          className="flex-1 rounded-xl p-4"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <h2 className="text-[14px] font-semibold text-[var(--text-primary)] mb-4">
            {DAYS[today]} — Today
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {(schedule[today] ?? []).map((r, i) => (
              <RoutineCell key={`today-${r.id}-${i}`} routine={r} />
            ))}
          </div>

          {/* Cron jobs below in today view */}
          <div className="mt-8">
            <h3 className="text-[13px] font-semibold text-[var(--text-primary)] mb-3">
              Cron Jobs
            </h3>
            <div className="space-y-1.5">
              {store.cronJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between rounded-lg px-3 py-2"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.04)" }}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        job.status === "active" ? "bg-green-400" : job.status === "paused" ? "bg-amber-400" : "bg-red-400"
                      }`}
                    />
                    <span className="text-[12px] font-medium text-[var(--text-primary)]">{job.name}</span>
                  </div>
                  <code className="text-[10px] font-mono text-cyan-300 bg-white/5 px-2 py-0.5 rounded">
                    {job.schedule}
                  </code>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
