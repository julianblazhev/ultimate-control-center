// ═══════════════════════════════════════════════════════════════
// API Route — GET /api/memory
// CLI: openclaw memory search --query <text> --json
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { mockMemory } from "@/lib/mock-data";
import { openclawExec } from "@/lib/gateway";
import { transformMemory } from "@/lib/transformers";
import type { MemoryEntry, ApiResponse } from "@/lib/types";

const VALID_TYPES: MemoryEntry["type"][] = ["journal", "long_term"];

export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse<MemoryEntry[]>>> {
  try {
    const { searchParams } = request.nextUrl;
    const typeFilter = searchParams.get("type");

    // memory search requires a query — use broad query to list all
    const raw = await openclawExec<unknown>(["memory", "search", "--query", "*"]);
    let data = transformMemory(raw as Parameters<typeof transformMemory>[0]);

    if (typeFilter && VALID_TYPES.includes(typeFilter as MemoryEntry["type"])) {
      data = data.filter((entry) => entry.type === typeFilter);
    }

    return NextResponse.json({ data, timestamp: new Date().toISOString() });
  } catch {
    // Fallback to mock data
    const { searchParams } = request.nextUrl;
    const typeFilter = searchParams.get("type");

    let data: MemoryEntry[] = mockMemory;
    if (typeFilter && VALID_TYPES.includes(typeFilter as MemoryEntry["type"])) {
      data = data.filter((entry) => entry.type === typeFilter);
    }

    return NextResponse.json({
      data,
      timestamp: new Date().toISOString(),
    });
  }
}
