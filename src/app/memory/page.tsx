"use client";

import { useState, useMemo, useEffect } from "react";
import type { MemoryEntry } from "@/lib/types";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function getDayName(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { weekday: "long" });
}

function estimateSize(wordCount: number): string {
  const bytes = wordCount * 6;
  const kb = bytes / 1024;
  return kb >= 1 ? `${kb.toFixed(1)} KB` : `${bytes} B`;
}

function relativeModified(dateStr: string): string {
  const now = new Date("2026-03-13T14:00:00Z").getTime();
  const then = new Date(dateStr + "T12:00:00Z").getTime();
  const diffD = Math.floor((now - then) / 86400000);
  if (diffD === 0) return "Modified today";
  if (diffD === 1) return "Modified yesterday";
  return `Modified ${diffD} days ago`;
}

// Group journal entries by time period relative to "today" (2026-03-13)
function groupJournals(entries: MemoryEntry[]): { label: string; count: number; entries: MemoryEntry[] }[] {
  const today = new Date("2026-03-13T12:00:00Z");
  const todayStr = "2026-03-13";

  const groups: { label: string; entries: MemoryEntry[] }[] = [
    { label: "Today", entries: [] },
    { label: "Yesterday", entries: [] },
    { label: "This Week", entries: [] },
    { label: "Last Week", entries: [] },
    { label: "February 2026", entries: [] },
    { label: "Earlier", entries: [] },
  ];

  // Start of this week (Mon Mar 9)
  const dayOfWeek = today.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisWeekStart = new Date(today);
  thisWeekStart.setUTCDate(today.getUTCDate() - mondayOffset);
  const thisWeekStartStr = thisWeekStart.toISOString().slice(0, 10);

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setUTCDate(thisWeekStart.getUTCDate() - 7);
  const lastWeekStartStr = lastWeekStart.toISOString().slice(0, 10);

  for (const entry of entries) {
    if (entry.date === todayStr) {
      groups[0].entries.push(entry);
    } else if (entry.date === "2026-03-12") {
      groups[1].entries.push(entry);
    } else if (entry.date >= thisWeekStartStr) {
      groups[2].entries.push(entry);
    } else if (entry.date >= lastWeekStartStr) {
      groups[3].entries.push(entry);
    } else if (entry.date >= "2026-02-01") {
      groups[4].entries.push(entry);
    } else {
      groups[5].entries.push(entry);
    }
  }

  return groups
    .filter((g) => g.entries.length > 0)
    .map((g) => ({ ...g, count: g.entries.length }));
}

// ─── Markdown renderer ──────────────────────────────────────────────────────

function renderContent(content: string): React.ReactNode {
  const lines = content.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("## ")) {
      // Check if it looks like a time entry (e.g., "## 9:00 AM — ...")
      const timeMatch = line.match(/^## (\d{1,2}:\d{2}\s*(?:AM|PM)?\s*—\s*.+)/);
      if (timeMatch) {
        nodes.push(
          <div key={i} className="flex items-center gap-2 mt-5 mb-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400 shrink-0">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span className="text-[14px] font-semibold text-blue-400">
              {timeMatch[1]}
            </span>
          </div>
        );
      } else {
        nodes.push(
          <h2
            key={i}
            className="text-[var(--text-primary)] text-[15px] font-bold mt-5 mb-1.5 pb-1"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            {line.replace("## ", "")}
          </h2>
        );
      }
    } else if (line.startsWith("# ")) {
      nodes.push(
        <h1
          key={i}
          className="text-[var(--text-primary)] text-[18px] font-bold mt-0 mb-3"
        >
          {line.replace("# ", "")}
        </h1>
      );
    } else if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].replace("- ", ""));
        i++;
      }
      nodes.push(
        <ul
          key={`ul-${i}`}
          className="text-[var(--text-secondary)] text-[13px] leading-[1.7] list-disc pl-5 my-1.5 mb-2.5"
        >
          {items.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      );
      continue;
    } else if (/^\d+\.\s/.test(line)) {
      // Numbered list
      const items: { num: string; text: string }[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        const match = lines[i].match(/^(\d+)\.\s(.*)/);
        if (match) items.push({ num: match[1], text: match[2] });
        i++;
      }
      nodes.push(
        <ol key={`ol-${i}`} className="text-[var(--text-secondary)] text-[13px] leading-[1.7] my-1.5 mb-2.5 pl-5">
          {items.map((item, idx) => (
            <li key={idx} className="list-decimal">{item.text}</li>
          ))}
        </ol>
      );
      continue;
    } else if (line.trim() === "") {
      // skip blank lines
    } else {
      // Check for bold labels like "What we discussed:" or "Key findings:"
      const boldMatch = line.match(/^(\*\*(.+?)\*\*|([A-Z][a-z]+(?: [a-z]+)*:))\s*(.*)/);
      if (boldMatch) {
        const label = boldMatch[2] || boldMatch[3];
        const rest = boldMatch[4] || boldMatch[5] || "";
        nodes.push(
          <p key={i} className="text-[13px] leading-[1.7] mb-2">
            <span className="font-semibold text-[var(--text-primary)]">{label}</span>
            {rest && <span className="text-[var(--text-secondary)]"> {rest}</span>}
          </p>
        );
      } else {
        nodes.push(
          <p key={i} className="text-[var(--text-secondary)] text-[13px] leading-[1.7] mb-2">
            {line}
          </p>
        );
      }
    }

    i++;
  }

  return nodes;
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function MemoryPage() {
  const [selectedEntry, setSelectedEntry] = useState<MemoryEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [allMemory, setAllMemory] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/memory")
      .then((r) => r.json())
      .then((res) => setAllMemory(res.data || []))
      .catch(() => setAllMemory([]))
      .finally(() => setLoading(false));
  }, []);

  const longTermEntry = allMemory.find((e) => e.type === "long_term") ?? null;
  const journalEntries = useMemo(() => {
    let entries = allMemory.filter((e) => e.type === "journal");
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.preview.toLowerCase().includes(q) ||
          e.date.includes(q)
      );
    }
    return entries.sort((a, b) => b.date.localeCompare(a.date));
  }, [searchQuery, allMemory]);

  const groupedJournals = useMemo(() => groupJournals(journalEntries), [journalEntries]);
  const journalCount = allMemory.filter((e) => e.type === "journal").length;

  return (
    <div
      className="min-h-[calc(100vh-56px)] flex flex-col"
      style={{
        marginLeft: "-24px",
        marginRight: "-24px",
        marginTop: "-24px",
        marginBottom: "-24px",
        padding: "24px",
      }}
    >
      {/* Two-pane layout — no page header, sidebar-style like reference */}
      <div className="flex gap-0 flex-1 min-h-0 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>

        {/* ── Left Pane ── */}
        <div
          className="w-[320px] shrink-0 flex flex-col overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.02)",
            borderRight: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {/* Search */}
          <div className="p-3 shrink-0">
            <div className="relative">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
              >
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                placeholder="Search memory..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-[12px] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              />
            </div>
          </div>

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto">

            {/* Long-Term Memory item */}
            {longTermEntry && (
              <button
                onClick={() => setSelectedEntry(longTermEntry)}
                className="w-full text-left px-3 py-3 transition-all duration-150 cursor-pointer"
                style={{
                  background: selectedEntry?.id === longTermEntry.id ? "rgba(168,85,247,0.08)" : "transparent",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}
                onMouseEnter={(e) => {
                  if (selectedEntry?.id !== longTermEntry.id) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedEntry?.id !== longTermEntry.id) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "rgba(34,197,94,0.15)" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                        Long-Term Memory
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      {longTermEntry.wordCount.toLocaleString()} words &middot; Updated about 22 hours ago
                    </div>
                  </div>
                </div>
              </button>
            )}

            {/* Daily Journal section header */}
            <div
              className="flex items-center gap-2 px-3 py-2.5 mt-1"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)] shrink-0">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Daily Journal
              </span>
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-[var(--text-muted)]"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                {journalCount} entries
              </span>
            </div>

            {/* Grouped journal entries */}
            {groupedJournals.map((group) => (
              <div key={group.label}>
                {/* Group header */}
                <div className="px-3 py-2 flex items-center gap-2">
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="text-[var(--text-muted)] shrink-0">
                    <path d="M2 3l2 2 2-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-[11px] font-medium text-[var(--text-muted)]">
                    {group.label}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] opacity-60">
                    ({group.count})
                  </span>
                </div>

                {/* Entries in group */}
                {group.entries.map((entry) => {
                  const isSelected = selectedEntry?.id === entry.id;
                  return (
                    <button
                      key={entry.id}
                      onClick={() => setSelectedEntry(entry)}
                      className="w-full text-left pl-7 pr-3 py-2.5 transition-all duration-150 cursor-pointer flex items-start gap-2.5"
                      style={{
                        background: isSelected ? "rgba(59,130,246,0.08)" : "transparent",
                        borderBottom: "1px solid rgba(255,255,255,0.03)",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = "transparent";
                        }
                      }}
                    >
                      {/* Calendar icon */}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)] shrink-0 mt-0.5">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-[13px] font-medium leading-tight"
                          style={{ color: isSelected ? "var(--accent-blue)" : "var(--text-primary)" }}
                        >
                          {formatDateShort(entry.date)}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                          {estimateSize(entry.wordCount)} &middot; {entry.wordCount.toLocaleString()} words
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* ── Right Pane ── */}
        <div
          className="flex-1 flex flex-col overflow-hidden"
          style={{ background: "rgba(255,255,255,0.01)" }}
        >
          {selectedEntry ? (
            <>
              {/* Content header */}
              <div
                className="px-6 py-4 shrink-0 flex items-start justify-between"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{
                      background: selectedEntry.type === "long_term"
                        ? "rgba(168,85,247,0.12)"
                        : "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {selectedEntry.type === "long_term" ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)]">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    )}
                  </div>

                  <div>
                    <h2 className="text-[16px] font-bold text-[var(--text-primary)] leading-tight">
                      {selectedEntry.type === "long_term"
                        ? selectedEntry.title
                        : `${selectedEntry.date} — ${getDayName(selectedEntry.date)}`}
                    </h2>
                    <p className="text-[12px] text-[var(--text-muted)] mt-1">
                      {formatDateFull(selectedEntry.date)} &middot; {estimateSize(selectedEntry.wordCount)} &middot; {selectedEntry.wordCount.toLocaleString()} words
                    </p>
                  </div>
                </div>

                <span className="text-[11px] text-[var(--text-muted)] shrink-0 mt-1">
                  {relativeModified(selectedEntry.date)}
                </span>
              </div>

              {/* Content body */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                {renderContent(selectedEntry.content)}
              </div>
            </>
          ) : (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                className="opacity-25"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
                <path d="M9 21h6" />
                <path d="M10 17v4" />
                <path d="M14 17v4" />
              </svg>
              <div className="text-center">
                <div className="text-[14px] font-semibold mb-1">
                  No entry selected
                </div>
                <div className="text-[12px] text-[var(--text-muted)]">
                  Choose an entry from the list to read its full content.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
