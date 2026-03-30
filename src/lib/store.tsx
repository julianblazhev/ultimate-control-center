"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import type { Agent, Task, ChatMessage, ActivityEvent, Session, CronJob, GatewayStatus } from "./types";

// ─── Store Shape ─────────────────────────────────────────────────────────────

interface Store {
  // Data
  agents: Agent[];
  tasks: Task[];
  sessions: Session[];
  cronJobs: CronJob[];
  gateway: GatewayStatus;
  activity: ActivityEvent[];
  chatMessages: Record<string, ChatMessage[]>;

  // Loading / error
  loading: boolean;
  error: string | null;
  lastFetched: string | null;

  // Actions
  refresh: () => Promise<void>;
  createTask: (title: string, description?: string, priority?: Task["priority"], status?: Task["status"], assignee?: string, project?: string) => void;
  assignTask: (agentId: string, title: string, description?: string, priority?: Task["priority"], project?: string) => void;
  sendMessage: (agentId: string, content: string) => void;
  updateTaskStatus: (taskId: string, status: Task["status"]) => void;
  updateAgentStatus: (agentId: string, status: Agent["status"], task?: string) => void;
  addActivity: (message: string, type?: ActivityEvent["type"], severity?: ActivityEvent["severity"]) => void;
}

const EMPTY_GATEWAY: GatewayStatus = { status: "offline", version: "unknown", uptime: 0, activeSessions: 0, totalSessions: 0, cronJobs: 0 };

const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function StoreProvider({ children }: { children: ReactNode }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [gateway, setGateway] = useState<GatewayStatus>(EMPTY_GATEWAY);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const fetchedOnce = useRef(false);

  // ── Fetch snapshot from gateway ──
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/snapshot");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const { data, timestamp } = await res.json();
      setAgents(data.agents || []);
      setSessions(data.sessions || []);
      setCronJobs(data.cronJobs || []);
      setGateway(data.gateway || EMPTY_GATEWAY);
      if (data.errors?.length) {
        setError(`Partial data: ${data.errors.join("; ")}`);
      }
      setLastFetched(timestamp);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch gateway data");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount (once)
  useEffect(() => {
    if (fetchedOnce.current) return;
    fetchedOnce.current = true;
    refresh();
  }, [refresh]);

  // ── Mutations (local state only — these don't exist in gateway CLI) ──

  const addActivity = useCallback(
    (message: string, type: ActivityEvent["type"] = "task", severity: ActivityEvent["severity"] = "info") => {
      const event: ActivityEvent = {
        id: `ev-${Date.now()}`,
        type,
        message,
        timestamp: new Date().toISOString(),
        severity,
      };
      setActivity((prev) => [event, ...prev]);
    },
    []
  );

  const createTask = useCallback(
    (title: string, description?: string, priority: Task["priority"] = "medium", status: Task["status"] = "backlog", assignee?: string, project?: string) => {
      const now = new Date().toISOString();

      if (assignee) {
        const agent = agents.find((a) => a.name === assignee);
        if (agent && (agent.status === "busy" || agent.status === "online") && agent.currentTask) {
          const newTask: Task = {
            id: `t-${Date.now()}`, title, description, status: "backlog", priority, assignee, project, tags: [],
            createdAt: now, updatedAt: now,
          };
          setTasks((prev) => [newTask, ...prev]);
          addActivity(`Task "${title}" queued for ${assignee} (currently busy)`, "task", "info");
          return;
        }
      }

      const newTask: Task = {
        id: `t-${Date.now()}`, title, description, status, priority, assignee, project, tags: [],
        createdAt: now, updatedAt: now,
      };
      setTasks((prev) => [newTask, ...prev]);

      if (assignee && status === "in_progress") {
        setAgents((prev) =>
          prev.map((a) =>
            a.name === assignee ? { ...a, status: "busy" as const, currentTask: title, lastSeen: now } : a
          )
        );
      }

      addActivity(`Task "${title}" created${assignee ? ` and assigned to ${assignee}` : ""}`, "task", "info");
    },
    [agents, addActivity]
  );

  const assignTask = useCallback(
    (agentId: string, title: string, description?: string, priority: Task["priority"] = "medium", project?: string) => {
      const agent = agents.find((a) => a.id === agentId);
      if (!agent) return;
      if ((agent.status === "busy" || agent.status === "online") && agent.currentTask) return;

      const now = new Date().toISOString();
      const newTask: Task = {
        id: `t-${Date.now()}`, title, description, status: "in_progress", priority,
        assignee: agent.name, project, tags: [], createdAt: now, updatedAt: now,
      };

      setTasks((prev) => [newTask, ...prev]);
      setAgents((prev) =>
        prev.map((a) => a.id === agentId ? { ...a, status: "busy" as const, currentTask: title, lastSeen: now } : a)
      );

      const msg: ChatMessage = {
        id: `cm-${Date.now()}`, agentId, role: "agent",
        content: `Got it. I'll start working on "${title}" right away.`,
        timestamp: now,
      };
      setChatMessages((prev) => ({ ...prev, [agentId]: [...(prev[agentId] ?? []), msg] }));
      addActivity(`Task "${title}" assigned to ${agent.name}`, "task", "info");
    },
    [agents, addActivity]
  );

  const sendMessage = useCallback(
    (agentId: string, content: string) => {
      const now = new Date().toISOString();
      const agent = agents.find((a) => a.id === agentId);

      const userMsg: ChatMessage = { id: `cm-${Date.now()}`, agentId, role: "user", content, timestamp: now };
      const replies = [
        "Understood. I'll look into that.",
        "On it. I'll have an update for you shortly.",
        "Good question. Let me check and get back to you.",
        "Noted. I'll factor that into my current work.",
        "Thanks for the heads up. Adjusting my approach accordingly.",
      ];
      const agentMsg: ChatMessage = {
        id: `cm-${Date.now() + 1}`, agentId, role: "agent",
        content: replies[Math.floor(Math.random() * replies.length)],
        timestamp: new Date(Date.now() + 1500).toISOString(),
      };

      setChatMessages((prev) => ({ ...prev, [agentId]: [...(prev[agentId] ?? []), userMsg, agentMsg] }));
      if (agent) addActivity(`Message sent to ${agent.name}`, "agent", "info");
    },
    [agents, addActivity]
  );

  const updateTaskStatus = useCallback(
    (taskId: string, status: Task["status"]) => {
      const now = new Date().toISOString();
      let taskTitle = "";
      let taskAssignee = "";

      setTasks((prev) =>
        prev.map((t) => {
          if (t.id === taskId) { taskTitle = t.title; taskAssignee = t.assignee ?? ""; return { ...t, status, updatedAt: now }; }
          return t;
        })
      );

      if (status === "done" && taskAssignee) {
        setAgents((prev) =>
          prev.map((a) =>
            a.name === taskAssignee && a.currentTask === taskTitle
              ? { ...a, status: "idle" as const, currentTask: undefined, lastSeen: now } : a
          )
        );
      }

      if (taskTitle) addActivity(`Task "${taskTitle}" moved to ${status.replace("_", " ")}`, "task", status === "done" ? "success" : "info");
    },
    [addActivity]
  );

  const updateAgentStatus = useCallback(
    (agentId: string, status: Agent["status"], task?: string) => {
      const now = new Date().toISOString();
      setAgents((prev) => prev.map((a) => a.id === agentId ? { ...a, status, currentTask: task, lastSeen: now } : a));
    },
    []
  );

  return (
    <StoreContext.Provider
      value={{
        agents, tasks, sessions, cronJobs, gateway, activity, chatMessages,
        loading, error, lastFetched,
        refresh, createTask, assignTask, sendMessage, updateTaskStatus, updateAgentStatus, addActivity,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}
