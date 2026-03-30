"use client";

import { useState } from "react";
import type { Project } from "@/lib/types";
import PixelAvatar, { getVisuals } from "@/components/PixelAvatar";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffH = Math.floor(diffMs / 3600000);
  if (diffH < 1) return "just now";
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD} days ago`;
}

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  active: { bg: "rgba(34,197,94,0.12)", text: "text-green-400" },
  completed: { bg: "rgba(59,130,246,0.12)", text: "text-blue-400" },
  paused: { bg: "rgba(251,191,36,0.12)", text: "text-amber-400" },
  planning: { bg: "rgba(168,85,247,0.12)", text: "text-purple-400" },
};

const PRIORITY_STYLE: Record<string, { bg: string; text: string }> = {
  high: { bg: "rgba(251,191,36,0.15)", text: "text-amber-400" },
  medium: { bg: "rgba(96,165,250,0.15)", text: "text-blue-400" },
  low: { bg: "rgba(148,163,184,0.15)", text: "text-gray-400" },
};

function getProjectPriority(progress: number): string {
  if (progress >= 70) return "high";
  if (progress >= 30) return "medium";
  return "low";
}

export default function ProjectsPage() {
  const [projects] = useState<Project[]>([]);
  const loading = false;

  const totalProjects = projects.length;
  const activeCount = projects.filter((p) => p.status === "active").length;
  const planningCount = projects.filter((p) => p.status === "planning").length;

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-[calc(100vh-56px)]"
      style={{ marginLeft: "-24px", marginRight: "-24px", marginTop: "-24px", marginBottom: "-24px", padding: "24px" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(34,197,94,0.15)" }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-green-400">
            <path d="M2 5a2 2 0 012-2h5l2 2h5a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V5z" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Projects</h1>
          <p className="text-[13px] text-[var(--text-muted)]">
            {totalProjects} total &middot; {activeCount} active &middot; {planningCount} planning
          </p>
        </div>
      </div>

      {/* Project cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">
        {projects.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
            <p className="text-[14px] text-[var(--text-muted)]">No projects found</p>
            <p className="text-[12px] text-[var(--text-muted)] mt-1">Projects will appear here when available from the gateway</p>
          </div>
        )}
        {projects.map((project) => {
          const statusStyle = STATUS_STYLE[project.status] ?? STATUS_STYLE.active;
          const priority = getProjectPriority(project.progress);
          const priorityStyle = PRIORITY_STYLE[priority];
          const progressColor =
            project.progress >= 70
              ? "#22c55e"
              : project.progress >= 30
              ? "#06b6d4"
              : "#64748b";

          return (
            <div
              key={project.id}
              className="rounded-xl p-5 flex flex-col gap-3 transition-all hover:brightness-110"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {/* Title + status */}
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-[15px] font-semibold text-[var(--text-primary)] leading-snug">
                  {project.name}
                </h2>
                <span
                  className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full flex-shrink-0 ${statusStyle.text}`}
                  style={{ background: statusStyle.bg }}
                >
                  {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                </span>
              </div>

              {/* Description */}
              <p className="text-[12px] text-[var(--text-muted)] leading-relaxed line-clamp-2">
                {project.description}
              </p>

              {/* Progress bar */}
              <div className="flex items-center gap-3">
                <span className="text-[12px] font-medium text-[var(--text-secondary)] w-8">
                  {project.progress}%
                </span>
                <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div
                    className="h-1.5 rounded-full transition-all"
                    style={{ width: `${project.progress}%`, background: progressColor }}
                  />
                </div>
                <span className="text-[11px] text-[var(--text-muted)]">
                  {project.completedTasks}/{project.taskCount}
                </span>
              </div>

              {/* Bottom row: owner + priority */}
              <div className="flex items-center justify-between mt-auto pt-1">
                <div className="flex items-center gap-2">
                  <div
                    className="rounded-md flex items-center justify-center"
                    style={{
                      width: 26,
                      height: 26,
                      background: `${getVisuals(project.owner).color}15`,
                      border: `1px solid ${getVisuals(project.owner).color}25`,
                    }}
                  >
                    <PixelAvatar name={project.owner} size={20} />
                  </div>
                  <span className="text-[12px] text-[var(--text-secondary)]">{project.owner}</span>
                </div>
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${priorityStyle.text}`}
                  style={{ background: priorityStyle.bg }}
                >
                  {priority}
                </span>
              </div>

              {/* Timestamp */}
              <p className="text-[10px] text-[var(--text-muted)]">
                {relativeTime(project.updatedAt)} by {project.owner}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
