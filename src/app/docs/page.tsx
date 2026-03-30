"use client";

import { useState, useMemo, useEffect } from "react";
import type { DocEntry } from "@/lib/types";

// -- Helpers --

function formatSize(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  const kb = bytes / 1024;
  return kb >= 1 ? `${kb.toFixed(1)} KB` : `${bytes} B`;
}

function categoryColor(cat: string): { bg: string; text: string; border: string } {
  const map: Record<string, { bg: string; text: string; border: string }> = {
    Journal: { bg: "rgba(239,68,68,0.12)", text: "#f87171", border: "rgba(239,68,68,0.25)" },
    Nova: { bg: "rgba(251,146,60,0.12)", text: "#fb923c", border: "rgba(251,146,60,0.25)" },
    Docs: { bg: "rgba(59,130,246,0.12)", text: "#60a5fa", border: "rgba(59,130,246,0.25)" },
    Newsletters: { bg: "rgba(168,85,247,0.12)", text: "#a78bfa", border: "rgba(168,85,247,0.25)" },
    Content: { bg: "rgba(34,197,94,0.12)", text: "#4ade80", border: "rgba(34,197,94,0.25)" },
    Notes: { bg: "rgba(234,179,8,0.12)", text: "#facc15", border: "rgba(234,179,8,0.25)" },
    "YouTube Scripts": { bg: "rgba(239,68,68,0.12)", text: "#f87171", border: "rgba(239,68,68,0.25)" },
  };
  return map[cat] ?? { bg: "rgba(148,163,184,0.12)", text: "#94a3b8", border: "rgba(148,163,184,0.25)" };
}

function fileTypeColor(ext: string): string {
  const map: Record<string, string> = {
    md: "#60a5fa",
    html: "#f87171",
    pdf: "#fb923c",
    json: "#facc15",
    webm: "#a78bfa",
    mobi: "#4ade80",
    epub: "#2dd4bf",
  };
  return map[ext] ?? "#94a3b8";
}

// -- Main Page --

export default function DocsPage() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [allDocs, setAllDocs] = useState<DocEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/docs")
      .then((r) => r.json())
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : [];
        setAllDocs(data);
      })
      .catch(() => setAllDocs([]))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    allDocs.forEach((d) => { if (d.category) cats.add(d.category); });
    return Array.from(cats);
  }, [allDocs]);

  const fileTypes = useMemo(() => {
    const types = new Set<string>();
    allDocs.forEach((d) => types.add(d.type));
    return Array.from(types);
  }, [allDocs]);

  const filtered = useMemo(() => {
    let docs = allDocs;
    if (activeCategory) {
      docs = docs.filter((d) => d.category === activeCategory);
    }
    if (activeType) {
      docs = docs.filter((d) => d.type === activeType);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      docs = docs.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.path.toLowerCase().includes(q) ||
          d.preview.toLowerCase().includes(q) ||
          (d.category ?? "").toLowerCase().includes(q)
      );
    }
    return docs;
  }, [query, activeCategory, activeType, allDocs]);

  const selectedDoc = allDocs.find((d) => d.id === selectedId) ?? null;

  return (
    <div
      className="min-h-[calc(100vh-56px)] flex"
      style={{
        marginLeft: "-24px",
        marginRight: "-24px",
        marginTop: "-24px",
        marginBottom: "-24px",
      }}
    >
      {/* Left pane */}
      <div
        className="flex flex-col w-[420px] flex-shrink-0"
        style={{ borderRight: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* Search */}
        <div className="p-4 pb-3">
          <div className="relative">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
            >
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search documents..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-[12px] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 transition-all"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Category pills */}
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => {
              const isActive = activeCategory === cat;
              const colors = categoryColor(cat);
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(isActive ? null : cat)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-all"
                  style={{
                    background: isActive ? colors.bg : "rgba(255,255,255,0.04)",
                    border: `1px solid ${isActive ? colors.border : "rgba(255,255,255,0.06)"}`,
                    color: isActive ? colors.text : "var(--text-secondary)",
                  }}
                >
                  {cat === "Nova" ? "\uD83D\uDD25 Nova" : cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* File type pills */}
        <div
          className="px-4 pb-3 flex items-center gap-2"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            className="text-[var(--text-muted)] flex-shrink-0"
          >
            <path d="M3 4h18M5 8h14M7 12h10M9 16h6M11 20h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <div className="flex flex-wrap gap-1.5">
            {fileTypes.map((ext) => {
              const isActive = activeType === ext;
              const color = fileTypeColor(ext);
              return (
                <button
                  key={ext}
                  onClick={() => setActiveType(isActive ? null : ext)}
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-all"
                  style={{
                    background: isActive ? `${color}18` : "rgba(255,255,255,0.04)",
                    border: `1px solid ${isActive ? `${color}40` : "rgba(255,255,255,0.06)"}`,
                    color: isActive ? color : "var(--text-muted)",
                  }}
                >
                  .{ext}
                </button>
              );
            })}
          </div>
        </div>

        {/* Document list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-center px-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[var(--text-muted)]">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5" />
                <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p className="text-[12px] text-[var(--text-muted)]">No documents found</p>
            </div>
          ) : (
            filtered.map((doc) => {
              const isSelected = doc.id === selectedId;
              const colors = categoryColor(doc.category ?? "Other");
              return (
                <button
                  key={doc.id}
                  onClick={() => setSelectedId(doc.id === selectedId ? null : doc.id)}
                  className="w-full text-left px-4 py-3 transition-all flex items-center gap-3"
                  style={{
                    background: isSelected ? "rgba(59,130,246,0.08)" : undefined,
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "transparent";
                  }}
                >
                  {/* File icon */}
                  <div
                    className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-[var(--text-muted)]">
                      <path d="M3 2h7l4 4v8a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2" />
                      <path d="M10 2v4h4" stroke="currentColor" strokeWidth="1.2" />
                    </svg>
                  </div>

                  {/* Name + badge */}
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-[13px] font-medium truncate ${
                        isSelected ? "text-blue-300" : "text-[var(--text-primary)]"
                      }`}
                    >
                      {doc.name}
                    </div>
                    <div className="mt-1">
                      <span
                        className="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide"
                        style={{
                          background: colors.bg,
                          color: colors.text,
                          border: `1px solid ${colors.border}`,
                        }}
                      >
                        {doc.category ?? "Other"}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right pane */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedDoc ? (
          <>
            {/* Header */}
            <div
              className="flex-shrink-0 px-8 py-5"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-[15px] font-semibold text-[var(--text-primary)] truncate">
                  {selectedDoc.name}
                </h2>
                {(() => {
                  const colors = categoryColor(selectedDoc.category ?? "Other");
                  return (
                    <span
                      className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide flex-shrink-0"
                      style={{
                        background: colors.bg,
                        color: colors.text,
                        border: `1px solid ${colors.border}`,
                      }}
                    >
                      {selectedDoc.category ?? "Other"}
                    </span>
                  );
                })()}
              </div>
              <p className="text-[12px] text-[var(--text-muted)]">
                {formatSize(selectedDoc.size)}
                {selectedDoc.wordCount ? ` \u00B7 ${selectedDoc.wordCount.toLocaleString()} words` : ""}
              </p>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto px-8 py-6">
              {selectedDoc.type === "json" ? (
                <pre
                  className="text-[12px] leading-6 text-[var(--text-secondary)] font-mono whitespace-pre-wrap break-words rounded-lg p-4"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {selectedDoc.content ?? selectedDoc.preview}
                </pre>
              ) : selectedDoc.type === "md" || selectedDoc.type === "html" ? (
                <div className="text-[13px] leading-7 text-[var(--text-secondary)]">
                  {(selectedDoc.content ?? selectedDoc.preview).split("\n").map((line, i) => {
                    if (line.startsWith("# ")) {
                      return (
                        <h1 key={i} className="text-[20px] font-bold text-[var(--text-primary)] mb-4 mt-0 first:mt-0">
                          {line.slice(2)}
                        </h1>
                      );
                    }
                    if (line.startsWith("## ")) {
                      return (
                        <h2 key={i} className="text-[16px] font-bold text-[var(--text-primary)] mb-3 mt-6">
                          {line.slice(3)}
                        </h2>
                      );
                    }
                    if (line.startsWith("### ")) {
                      return (
                        <h3 key={i} className="text-[14px] font-semibold text-[var(--text-primary)] mb-2 mt-5">
                          {line.slice(4)}
                        </h3>
                      );
                    }
                    if (line.startsWith("- ") || line.startsWith("* ")) {
                      return (
                        <div key={i} className="flex gap-2 my-0.5 ml-2">
                          <span className="text-[var(--text-muted)] mt-0 flex-shrink-0">-</span>
                          <span>{renderInline(line.slice(2))}</span>
                        </div>
                      );
                    }
                    if (/^\d+\.\s/.test(line)) {
                      const match = line.match(/^(\d+)\.\s(.*)/);
                      return (
                        <div key={i} className="flex gap-2 my-0.5 ml-2">
                          <span className="text-[var(--text-muted)] flex-shrink-0 w-5 text-right">{match?.[1]}.</span>
                          <span>{renderInline(match?.[2] ?? "")}</span>
                        </div>
                      );
                    }
                    if (line === "") return <div key={i} className="h-3" />;
                    return <p key={i} className="my-0.5">{renderInline(line)}</p>;
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <span className="text-[18px] font-bold text-[var(--text-muted)]">.{selectedDoc.type}</span>
                  </div>
                  <p className="text-[13px] text-[var(--text-secondary)]">
                    Binary file — {formatSize(selectedDoc.size)}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Preview not available for .{selectedDoc.type} files
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 16 16" fill="none" className="text-[var(--text-muted)]">
                <path d="M3 2h7l4 4v8a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10 2v4h4M5 9h6M5 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="text-[14px] font-medium text-[var(--text-secondary)]">Select a document to preview</p>
              <p className="text-[12px] text-[var(--text-muted)] mt-1">Choose a file from the list on the left</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Render inline bold text
function renderInline(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-[var(--text-primary)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}
