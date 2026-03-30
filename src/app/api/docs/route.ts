// ═══════════════════════════════════════════════════════════════
// API Route — GET /api/docs
// CLI: openclaw docs list --json | openclaw docs read <id> --json
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { openclawExec } from "@/lib/gateway";
import type { DocEntry, ApiResponse } from "@/lib/types";

const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse<DocEntry | DocEntry[]>>> {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get("id");

    if (id) {
      if (!ID_PATTERN.test(id) || id.length > 50) {
        return NextResponse.json(
          { data: [] as DocEntry[], error: "Invalid document ID format", timestamp: new Date().toISOString() },
          { status: 400 }
        );
      }

      const data = await openclawExec<DocEntry>(["docs", "read", id]);
      return NextResponse.json({ data, timestamp: new Date().toISOString() });
    }

    const data = await openclawExec<DocEntry[]>(["docs", "list"]);
    return NextResponse.json({ data, timestamp: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      { data: [], error: `Gateway error: ${err instanceof Error ? err.message : "unknown"}`, timestamp: new Date().toISOString() },
      { status: 502 },
    );
  }
}
