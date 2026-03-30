"use client";

import { useState, useCallback } from "react";
import { useStore } from "@/lib/store";
import type { GatewayStatus, ActionResult } from "@/lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  return parts.length > 0 ? parts.join(" ") : "< 1m";
}

// ─── Gateway Status Card ──────────────────────────────────────────────────────

interface GatewayCardProps {
  gateway: GatewayStatus;
}

function GatewayCard({ gateway }: GatewayCardProps) {
  const statusConfig: Record<
    GatewayStatus["status"],
    { dot: string; label: string; text: string }
  > = {
    online: {
      dot: "bg-green-400 shadow-green-400/60",
      label: "Online",
      text: "text-green-400",
    },
    degraded: {
      dot: "bg-amber-400 shadow-amber-400/60",
      label: "Degraded",
      text: "text-amber-400",
    },
    offline: {
      dot: "bg-red-400 shadow-red-400/60",
      label: "Offline",
      text: "text-red-400",
    },
  };

  const sc = statusConfig[gateway.status];
  const memUsage = gateway.memoryUsage ?? 0;
  const memColor =
    memUsage > 80
      ? "from-red-500 to-rose-400"
      : memUsage > 60
      ? "from-amber-500 to-yellow-400"
      : "from-blue-500 to-cyan-400";

  return (
    <div
      className="rounded-xl p-5 mb-6"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Animated status dot */}
          <div className="relative flex items-center justify-center">
            <div
              className={`w-3 h-3 rounded-full shadow-md ${sc.dot} animate-pulse`}
            />
          </div>
          <div>
            <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">
              Gateway
            </h2>
            <span className={`text-[12px] font-semibold ${sc.text}`}>
              {sc.label}
            </span>
          </div>
        </div>
        <span
          className="text-[11px] font-mono px-2 py-1 rounded"
          style={{
            background: "rgba(59,130,246,0.1)",
            border: "1px solid rgba(59,130,246,0.2)",
          }}
        >
          <span className="text-blue-400">v{gateway.version}</span>
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-4 sm:grid-cols-3">
        {/* Uptime */}
        <div
          className="rounded-lg p-3"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <p className="text-[10px] uppercase tracking-wider mb-1 text-[var(--text-muted)]">
            Uptime
          </p>
          <p className="text-[14px] font-semibold text-[var(--text-primary)]">
            {formatUptime(gateway.uptime)}
          </p>
        </div>

        {/* Active Sessions */}
        <div
          className="rounded-lg p-3"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <p className="text-[10px] uppercase tracking-wider mb-1 text-[var(--text-muted)]">
            Sessions
          </p>
          <p className="text-[14px] font-semibold text-green-400">
            {gateway.activeSessions}
          </p>
        </div>

        {/* Cron Jobs */}
        <div
          className="rounded-lg p-3"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <p className="text-[10px] uppercase tracking-wider mb-1 text-[var(--text-muted)]">
            Cron Jobs
          </p>
          <p className="text-[14px] font-semibold text-[var(--text-primary)]">
            {gateway.cronJobs}
          </p>
        </div>
      </div>

      {/* Memory usage bar */}
      {gateway.memoryUsage !== undefined && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
              Memory Usage
            </span>
            <span
              className="text-[12px] font-semibold tabular-nums"
              style={{
                color:
                  memUsage > 80
                    ? "var(--accent-red)"
                    : memUsage > 60
                    ? "var(--accent-amber)"
                    : "var(--accent-blue)",
              }}
            >
              {memUsage}%
            </span>
          </div>
          <div
            className="w-full h-2 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <div
              className={`h-full rounded-full bg-gradient-to-r ${memColor} transition-all duration-700`}
              style={{ width: `${memUsage}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Confirmation Modal ────────────────────────────────────────────────────────

interface ConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({ onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm mx-4 p-6 rounded-xl shadow-2xl"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(239,68,68,0.35)",
          boxShadow: "0 0 40px rgba(239,68,68,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Warning icon */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0"
            style={{
              background: "rgba(239,68,68,0.15)",
              border: "1px solid rgba(239,68,68,0.3)",
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-red-400"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
              Restart Gateway?
            </h3>
            <p className="text-[11px] text-red-400">
              Dangerous action -- requires confirmation
            </p>
          </div>
        </div>

        <p className="text-[13px] leading-relaxed mb-5 text-[var(--text-secondary)]">
          Restarting the gateway will{" "}
          <span className="font-semibold text-[var(--text-primary)]">
            terminate all active sessions
          </span>{" "}
          and interrupt any running tasks. This action cannot be undone.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg text-[13px] font-semibold transition-all duration-150 hover:brightness-110 text-[var(--text-secondary)]"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-all duration-150 hover:brightness-110 active:scale-95"
            style={{
              background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
              border: "1px solid rgba(239,68,68,0.4)",
              boxShadow: "0 0 16px rgba(239,68,68,0.3)",
            }}
          >
            Confirm Restart
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Result Panel ─────────────────────────────────────────────────────────────

interface ResultPanelProps {
  result: ActionResult;
  onDismiss: () => void;
}

function ResultPanel({ result, onDismiss }: ResultPanelProps) {
  return (
    <div
      className="mt-4 rounded-xl p-4 relative"
      style={{
        background: result.success
          ? "rgba(34,197,94,0.06)"
          : "rgba(239,68,68,0.06)",
        border: `1px solid ${
          result.success ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"
        }`,
      }}
    >
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 w-5 h-5 flex items-center justify-center rounded text-[var(--text-muted)] opacity-50 hover:opacity-100 transition-opacity"
        aria-label="Dismiss result"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Status row */}
      <div className="flex items-center gap-2 mb-2">
        {result.success ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-green-400 flex-shrink-0"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        ) : (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-red-400 flex-shrink-0"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        )}
        <span
          className="text-[12px] font-semibold"
          style={{
            color: result.success ? "var(--accent-green)" : "var(--accent-red)",
          }}
        >
          {result.success ? "Success" : "Error"}
        </span>
      </div>

      <p className="text-[12px] mb-2 text-[var(--text-primary)]">
        {result.message}
      </p>

      {result.data !== undefined && (
        <pre
          className="text-[10px] font-mono rounded p-3 overflow-x-auto max-h-48 text-[var(--text-secondary)]"
          style={{
            background: "rgba(0,0,0,0.3)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {JSON.stringify(result.data, null, 2)}
        </pre>
      )}

      {result.error && !result.success && (
        <p className="text-[11px] mt-1 text-red-400">{result.error}</p>
      )}
    </div>
  );
}

// ─── Action card definitions ──────────────────────────────────────────────────

interface ActionDef {
  id: string;
  title: string;
  description: string;
  actionName: string;
  dangerous: boolean;
  icon: React.ReactNode;
}

const ACTION_ICON_REFRESH = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

const ACTION_ICON_SESSIONS = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
    <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
    <line x1="6" y1="6" x2="6.01" y2="6" />
    <line x1="6" y1="18" x2="6.01" y2="18" />
  </svg>
);

const ACTION_ICON_CRON = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const ACTION_ICON_RESTART = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const ACTIONS: ActionDef[] = [
  {
    id: "refresh_status",
    title: "Refresh Status",
    description: "Re-fetch the current gateway status and health metrics",
    actionName: "refresh_status",
    dangerous: false,
    icon: ACTION_ICON_REFRESH,
  },
  {
    id: "list_sessions",
    title: "List Sessions",
    description: "Retrieve all active and recent sessions from the gateway",
    actionName: "list_sessions",
    dangerous: false,
    icon: ACTION_ICON_SESSIONS,
  },
  {
    id: "list_cron",
    title: "List Cron Jobs",
    description: "Show all scheduled cron jobs and their current status",
    actionName: "list_cron",
    dangerous: false,
    icon: ACTION_ICON_CRON,
  },
  {
    id: "gateway_restart",
    title: "Gateway Restart",
    description:
      "Restart the gateway -- terminates all active sessions",
    actionName: "gateway_restart",
    dangerous: true,
    icon: ACTION_ICON_RESTART,
  },
];

// ─── Action Card ──────────────────────────────────────────────────────────────

interface ActionCardProps {
  action: ActionDef;
  loading: boolean;
  onTrigger: (action: ActionDef) => void;
}

function ActionCard({ action, loading, onTrigger }: ActionCardProps) {
  const isDangerous = action.dangerous;

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3 transition-all duration-200 hover:brightness-110"
      style={{
        background: isDangerous
          ? "rgba(239,68,68,0.04)"
          : "rgba(255,255,255,0.03)",
        border: isDangerous
          ? "1px solid rgba(239,68,68,0.2)"
          : "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Icon + title */}
      <div className="flex items-start gap-3">
        <div
          className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0"
          style={{
            background: isDangerous
              ? "rgba(239,68,68,0.12)"
              : "rgba(59,130,246,0.1)",
            border: `1px solid ${
              isDangerous ? "rgba(239,68,68,0.2)" : "rgba(59,130,246,0.2)"
            }`,
            color: isDangerous ? "var(--accent-red)" : "var(--accent-blue)",
          }}
        >
          {action.icon}
        </div>
        <div className="min-w-0">
          <h3
            className={`text-[13px] font-semibold ${
              isDangerous
                ? "text-red-400"
                : "text-[var(--text-primary)]"
            }`}
          >
            {action.title}
          </h3>
          <p className="text-[11px] leading-relaxed mt-0.5 text-[var(--text-muted)]">
            {action.description}
          </p>
        </div>
      </div>

      {/* Action button */}
      <button
        onClick={() => onTrigger(action)}
        disabled={loading}
        className="w-full py-2 rounded-lg text-[12px] font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98]"
        style={
          isDangerous
            ? {
                background:
                  "linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(220,38,38,0.15) 100%)",
                border: "1px solid rgba(239,68,68,0.35)",
                color: "var(--accent-red)",
                boxShadow: loading
                  ? "none"
                  : "0 0 12px rgba(239,68,68,0.1)",
              }
            : {
                background: "rgba(59,130,246,0.1)",
                border: "1px solid rgba(59,130,246,0.25)",
                color: "var(--accent-blue)",
              }
        }
      >
        {loading ? (
          <>
            {/* Spinner */}
            <svg
              className="animate-spin"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Running...
          </>
        ) : (
          <>
            {isDangerous && (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            )}
            {action.title}
          </>
        )}
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SystemPage() {
  const store = useStore();
  const gateway: GatewayStatus = store.gateway;
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingRestartAction, setPendingRestartAction] =
    useState<ActionDef | null>(null);

  const executeAction = useCallback(
    async (action: ActionDef, confirmed = false) => {
      setLoadingAction(action.id);
      setResult(null);

      try {
        const body: { action: string; params?: Record<string, string> } = {
          action: action.actionName,
        };
        if (action.dangerous && confirmed) {
          body.params = { confirm: "true" };
        }

        const res = await fetch("/api/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data: ActionResult = await res.json();
        setResult(data);
      } catch (err) {
        setResult({
          success: false,
          message: "Failed to reach the server",
          error: err instanceof Error ? err.message : "Network error",
        });
      } finally {
        setLoadingAction(null);
      }
    },
    []
  );

  const handleTrigger = useCallback(
    (action: ActionDef) => {
      if (action.dangerous) {
        setPendingRestartAction(action);
        setShowConfirm(true);
        return;
      }
      executeAction(action);
    },
    [executeAction]
  );

  const handleConfirmRestart = useCallback(() => {
    setShowConfirm(false);
    if (pendingRestartAction) {
      executeAction(pendingRestartAction, true);
      setPendingRestartAction(null);
    }
  }, [pendingRestartAction, executeAction]);

  const handleCancelRestart = useCallback(() => {
    setShowConfirm(false);
    setPendingRestartAction(null);
  }, []);

  return (
    <>
      {/* Confirmation Modal */}
      {showConfirm && (
        <ConfirmModal
          onConfirm={handleConfirmRestart}
          onCancel={handleCancelRestart}
        />
      )}

      <div
        style={{
          marginLeft: "-24px",
          marginRight: "-24px",
          marginTop: "-24px",
          marginBottom: "-24px",
          padding: "24px",
        }}
      >
        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0"
            style={{
              background: "rgba(59,130,246,0.1)",
              border: "1px solid rgba(59,130,246,0.2)",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-blue-400"
            >
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
              <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
              <line x1="6" y1="6" x2="6.01" y2="6" />
              <line x1="6" y1="18" x2="6.01" y2="18" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
              System
            </h1>
            <p className="text-[12px] text-[var(--text-muted)]">
              Gateway status and operational controls
            </p>
          </div>
        </div>

        {/* Gateway Status */}
        <GatewayCard gateway={gateway} />

        {/* Quick Actions */}
        <div className="mb-4">
          <h2 className="text-[14px] font-semibold mb-1 text-[var(--text-primary)]">
            Quick Actions
          </h2>
          <p className="text-[12px] mb-4 text-[var(--text-muted)]">
            Trigger gateway operations -- results appear below after each action
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {ACTIONS.map((action) => (
              <ActionCard
                key={action.id}
                action={action}
                loading={loadingAction === action.id}
                onTrigger={handleTrigger}
              />
            ))}
          </div>
        </div>

        {/* Result Panel */}
        {result && (
          <ResultPanel result={result} onDismiss={() => setResult(null)} />
        )}
      </div>
    </>
  );
}
