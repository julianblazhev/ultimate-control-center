// ═══════════════════════════════════════════════════════════════
// API Route — GET /api/tasks | POST /api/tasks
// CLI: openclaw tasks list|create|update --json
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { openclawExec } from "@/lib/gateway";
import type { Task, ApiResponse } from "@/lib/types";

// ── Validation ───────────────────────────────────────────────

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;
const VALID_STATUSES: Task["status"][] = ["backlog", "in_progress", "review", "done"];
const VALID_PRIORITIES: Task["priority"][] = ["low", "medium", "high", "critical"];
const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function sanitizeString(s: unknown, maxLen: number): string | undefined {
  if (typeof s !== "string") return undefined;
  return s.trim().slice(0, maxLen);
}

// ── GET ──────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse<ApiResponse<Task[]>>> {
  try {
    const data = await openclawExec<Task[]>(["tasks", "list"]);
    return NextResponse.json({ data, timestamp: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      { data: [], error: `Gateway error: ${err instanceof Error ? err.message : "unknown"}`, timestamp: new Date().toISOString() },
      { status: 502 },
    );
  }
}

// ── POST ─────────────────────────────────────────────────────

type CreateTaskBody = Omit<Task, "id" | "createdAt" | "updatedAt"> & {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
};

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<Task>>> {
  try {
    let body: CreateTaskBody;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { data: {} as Task, error: "Invalid JSON body", timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const { id, ...fields } = body;

    const title = sanitizeString(fields.title, MAX_TITLE_LENGTH);
    if (!title) {
      return NextResponse.json(
        { data: {} as Task, error: "Missing or invalid field: title", timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const description = sanitizeString(fields.description, MAX_DESCRIPTION_LENGTH);
    const status = VALID_STATUSES.includes(fields.status) ? fields.status : "backlog";
    const priority = VALID_PRIORITIES.includes(fields.priority) ? fields.priority : "medium";
    const assignee = sanitizeString(fields.assignee, 50);
    const project = sanitizeString(fields.project, 100);
    const now = new Date().toISOString();

    if (id) {
      if (typeof id !== "string" || !ID_PATTERN.test(id) || id.length > 50) {
        return NextResponse.json(
          { data: {} as Task, error: "Invalid task ID format", timestamp: now },
          { status: 400 }
        );
      }

      const updated = await openclawExec<Task>(["tasks", "update", id, "--data", JSON.stringify({ title, description, status, priority, assignee, project })]);
      return NextResponse.json({ data: updated, timestamp: now }, { status: 200 });
    } else {
      const created = await openclawExec<Task>(["tasks", "create", "--data", JSON.stringify({ title, description, status, priority, assignee, project })]);
      return NextResponse.json({ data: created, timestamp: now }, { status: 201 });
    }
  } catch (err) {
    return NextResponse.json(
      { data: {} as Task, error: `Gateway error: ${err instanceof Error ? err.message : "unknown"}`, timestamp: new Date().toISOString() },
      { status: 502 }
    );
  }
}
