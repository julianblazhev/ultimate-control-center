"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useStore } from "@/lib/store";
import AgentPanel from "@/components/AgentPanel";
import PixelAvatar from "@/components/PixelAvatar";

// -- Types --

interface Pos {
  x: number;
  y: number;
}

interface OfficeAgent {
  id: string;
  name: string;
  emoji: string;
  color: string;
  skinColor: string;
  hairColor: string;
  shirtColor: string;
  status: "online" | "busy" | "idle" | "offline";
  task?: string;
  pos: Pos;
  target: Pos;
  path: Pos[];
  home: Pos;
  deskIndex: number;
  behavior: "working" | "roaming" | "traveling" | "lingering";
  lingerUntil: number;
  facing: "down" | "up" | "left" | "right";
  walkFrame: number;
}

// -- Constants --

const TILE = 40;
const COLS = 24;
const ROWS = 16;
const MAP_W = COLS * TILE;
const MAP_H = ROWS * TILE;

// Wall/floor colors
const WALL_COLOR = "#2a2d3a";
const WALL_TRIM = "#353849";
const FLOOR_A = "#1e2028";
const FLOOR_B = "#1a1c24";
const CARPET_A = "#1f2438";
const CARPET_B = "#1b2034";

const AGENT_DEFS: {
  id: string;
  name: string;
  emoji: string;
  color: string;
  skinColor: string;
  hairColor: string;
  shirtColor: string;
  home: Pos;
}[] = [
  { id: "henry", name: "Henry", emoji: "\uD83D\uDC51", color: "#8b5cf6", skinColor: "#f0c8a0", hairColor: "#4a3728", shirtColor: "#8b5cf6", home: { x: 12, y: 4 } },
  { id: "alex", name: "Alex", emoji: "\uD83D\uDC7E", color: "#6366f1", skinColor: "#d4a574", hairColor: "#1a1a2e", shirtColor: "#6366f1", home: { x: 4, y: 4 } },
  { id: "scout", name: "Scout", emoji: "\uD83D\uDD2D", color: "#94a3b8", skinColor: "#f0c8a0", hairColor: "#8b6c47", shirtColor: "#64748b", home: { x: 18, y: 4 } },
  { id: "quill", name: "Quill", emoji: "\u270D\uFE0F", color: "#eab308", skinColor: "#c68642", hairColor: "#2d1b00", shirtColor: "#ca8a04", home: { x: 4, y: 9 } },
  { id: "echo", name: "Echo", emoji: "\uD83D\uDCE3", color: "#64748b", skinColor: "#f0c8a0", hairColor: "#3d2b1f", shirtColor: "#475569", home: { x: 8, y: 9 } },
  { id: "violet", name: "Violet", emoji: "\uD83D\uDC9C", color: "#a855f7", skinColor: "#e8b88a", hairColor: "#6b21a8", shirtColor: "#9333ea", home: { x: 12, y: 9 } },
  { id: "codex", name: "Codex", emoji: "\uD83D\uDCBB", color: "#f97316", skinColor: "#f0c8a0", hairColor: "#1c1c1c", shirtColor: "#ea580c", home: { x: 18, y: 9 } },
  { id: "charlie", name: "Charlie", emoji: "\u2699\uFE0F", color: "#22c55e", skinColor: "#d4a574", hairColor: "#2d1b00", shirtColor: "#16a34a", home: { x: 6, y: 13 } },
  { id: "ralph", name: "Ralph", emoji: "\uD83D\uDD28", color: "#64748b", skinColor: "#f0c8a0", hairColor: "#5c4033", shirtColor: "#57534e", home: { x: 10, y: 13 } },
  { id: "pixel", name: "Pixel", emoji: "\uD83C\uDFA8", color: "#ec4899", skinColor: "#e8b88a", hairColor: "#ec4899", shirtColor: "#db2777", home: { x: 16, y: 13 } },
];

// Workstation positions (desk + chair + monitor combos)
const WORKSTATIONS: { x: number; y: number; facing: "down" | "up" }[] = [
  // Row 1 - top row facing down
  { x: 3, y: 3, facing: "down" },
  { x: 7, y: 3, facing: "down" },
  { x: 11, y: 3, facing: "down" },
  { x: 15, y: 3, facing: "down" },
  { x: 19, y: 3, facing: "down" },
  // Row 2
  { x: 3, y: 8, facing: "down" },
  { x: 7, y: 8, facing: "down" },
  { x: 11, y: 8, facing: "down" },
  { x: 15, y: 8, facing: "down" },
  { x: 19, y: 8, facing: "down" },
];

// Decorative furniture
const BOOKSHELVES: Pos[] = [{ x: 1, y: 1 }, { x: 2, y: 1 }];
const PLANTS: Pos[] = [{ x: 0, y: 6 }, { x: 23, y: 6 }, { x: 0, y: 12 }, { x: 23, y: 12 }];
const WINDOWS: { x: number; y: number; w: number }[] = [
  { x: 4, y: 0, w: 3 },
  { x: 9, y: 0, w: 3 },
  { x: 14, y: 0, w: 3 },
  { x: 19, y: 0, w: 3 },
];
const WHITEBOARD = { x: 22, y: 1, w: 2, h: 2 };
const COFFEE_MACHINE = { x: 21, y: 14 };
const WATER_COOLER = { x: 22, y: 14 };
const CONF_TABLE = { x: 5, y: 12, w: 3, h: 2 };

// Carpet zone (central area)
const CARPET = { x: 2, y: 2, w: 20, h: 13 };

// -- Collision Grid --

const BLOCKED = new Set<string>();

// Top wall: y=0 and y=1
for (let x = 0; x < COLS; x++) {
  BLOCKED.add(`${x},0`);
  BLOCKED.add(`${x},1`);
}

// Left/right edges
for (let y = 0; y < ROWS; y++) {
  BLOCKED.add(`0,${y}`);
  BLOCKED.add(`23,${y}`);
}

// Workstation desk tiles (NOT the chair at ws.y+1)
for (const ws of WORKSTATIONS) {
  BLOCKED.add(`${ws.x},${ws.y}`);
}

// Conference table: x=5..7, y=12..13
for (let x = 5; x <= 7; x++) {
  for (let y = 12; y <= 13; y++) {
    BLOCKED.add(`${x},${y}`);
  }
}

// Bookshelves: (1,1), (2,1), (1,2), (2,2)
BLOCKED.add("1,1");
BLOCKED.add("2,1");
BLOCKED.add("1,2");
BLOCKED.add("2,2");

// Plants
BLOCKED.add("0,6");
BLOCKED.add("23,6");
BLOCKED.add("0,12");
BLOCKED.add("23,12");

// Coffee machine
BLOCKED.add("21,14");

// Water cooler
BLOCKED.add("22,14");

// Whiteboard wall
BLOCKED.add("22,1");
BLOCKED.add("23,1");
BLOCKED.add("22,2");
BLOCKED.add("23,2");

// -- A* Pathfinding --

function findPath(from: Pos, to: Pos): Pos[] {
  const startKey = `${Math.round(from.x)},${Math.round(from.y)}`;
  const endKey = `${Math.round(to.x)},${Math.round(to.y)}`;
  const sx = Math.round(from.x);
  const sy = Math.round(from.y);
  const ex = Math.round(to.x);
  const ey = Math.round(to.y);

  if (startKey === endKey) return [];
  if (BLOCKED.has(endKey)) return [];

  interface Node {
    x: number;
    y: number;
    g: number;
    f: number;
    parent: Node | null;
  }

  const open: Node[] = [{ x: sx, y: sy, g: 0, f: Math.abs(ex - sx) + Math.abs(ey - sy), parent: null }];
  const closed = new Set<string>();

  const dirs = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ];

  while (open.length > 0) {
    // Find node with lowest f
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i;
    }
    const current = open[bestIdx];
    open.splice(bestIdx, 1);

    const key = `${current.x},${current.y}`;
    if (key === endKey) {
      // Reconstruct path (skip start node)
      const path: Pos[] = [];
      let node: Node | null = current;
      while (node) {
        path.push({ x: node.x, y: node.y });
        node = node.parent;
      }
      path.reverse();
      // Remove the starting position
      path.shift();
      return path;
    }

    if (closed.has(key)) continue;
    closed.add(key);

    for (const dir of dirs) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;
      const nKey = `${nx},${ny}`;

      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
      if (BLOCKED.has(nKey)) continue;
      if (closed.has(nKey)) continue;

      const g = current.g + 1;
      const h = Math.abs(ex - nx) + Math.abs(ey - ny);
      const f = g + h;

      // Check if already in open with better g
      const existing = open.find((n) => n.x === nx && n.y === ny);
      if (existing) {
        if (g < existing.g) {
          existing.g = g;
          existing.f = f;
          existing.parent = current;
        }
        continue;
      }

      open.push({ x: nx, y: ny, g, f, parent: current });
    }
  }

  return []; // No path found
}

// Social spots idle agents roam to
const SOCIAL_SPOTS: Pos[] = [
  { x: 20, y: 14 }, { x: 20, y: 13 },
  { x: 21, y: 13 }, { x: 22, y: 13 },
  { x: 4, y: 11 }, { x: 4, y: 14 }, { x: 8, y: 11 }, { x: 8, y: 14 },
  { x: 6, y: 11 }, { x: 6, y: 14 },
  { x: 1, y: 6 }, { x: 22, y: 6 },
  { x: 1, y: 12 }, { x: 22, y: 11 },
  { x: 10, y: 6 }, { x: 14, y: 6 },
  { x: 12, y: 11 }, { x: 16, y: 11 },
  { x: 20, y: 3 }, { x: 20, y: 2 },
  { x: 3, y: 3 }, { x: 2, y: 3 },
].filter((spot) => !BLOCKED.has(`${spot.x},${spot.y}`));

// -- Helpers --

function inCarpet(x: number, y: number): boolean {
  return (
    x >= CARPET.x &&
    x < CARPET.x + CARPET.w &&
    y >= CARPET.y &&
    y < CARPET.y + CARPET.h
  );
}

function pickRandomSocialSpot(): Pos {
  return SOCIAL_SPOTS[Math.floor(Math.random() * SOCIAL_SPOTS.length)];
}

function getDeskSeatPos(deskIndex: number): Pos {
  const ws = WORKSTATIONS[deskIndex];
  if (!ws) return { x: 5, y: 5 };
  // Seat is one tile below the desk (in the chair)
  return { x: ws.x, y: ws.y + 1 };
}

// -- Components --

function Floor() {
  const tiles = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const isCarpet = inCarpet(x, y);
      const isDark = (x + y) % 2 === 0;
      const bg = isCarpet
        ? isDark
          ? CARPET_A
          : CARPET_B
        : isDark
        ? FLOOR_A
        : FLOOR_B;

      tiles.push(
        <div
          key={`${x}-${y}`}
          className="absolute"
          style={{
            left: x * TILE,
            top: y * TILE,
            width: TILE,
            height: TILE,
            background: bg,
          }}
        />
      );
    }
  }
  return <>{tiles}</>;
}

function Walls() {
  return (
    <>
      {/* Top wall */}
      <div
        className="absolute"
        style={{
          left: 0,
          top: 0,
          width: MAP_W,
          height: TILE + 8,
          background: `linear-gradient(to bottom, ${WALL_COLOR}, ${WALL_TRIM})`,
          borderBottom: "3px solid #444866",
        }}
      />
      {/* Baseboard stripe */}
      <div
        className="absolute"
        style={{
          left: 0,
          top: TILE + 8,
          width: MAP_W,
          height: 3,
          background: "#555a72",
        }}
      />
      {/* Left wall strip */}
      <div
        className="absolute"
        style={{
          left: 0,
          top: 0,
          width: 6,
          height: MAP_H,
          background: WALL_TRIM,
          borderRight: "2px solid #444866",
        }}
      />
      {/* Right wall strip */}
      <div
        className="absolute"
        style={{
          left: MAP_W - 6,
          top: 0,
          width: 6,
          height: MAP_H,
          background: WALL_TRIM,
          borderLeft: "2px solid #444866",
        }}
      />
    </>
  );
}

function WindowPane({ x, y, w }: { x: number; y: number; w: number }) {
  return (
    <div
      className="absolute"
      style={{
        left: x * TILE + 4,
        top: y * TILE + 6,
        width: w * TILE - 8,
        height: TILE - 4,
        background: "linear-gradient(180deg, #1a2a4a 0%, #0f1b35 40%, #162544 100%)",
        border: "2px solid #555a72",
        borderRadius: 2,
        boxShadow: "inset 0 0 15px rgba(100,180,255,0.08), 0 0 8px rgba(100,180,255,0.04)",
      }}
    >
      {/* Window divider */}
      <div
        className="absolute"
        style={{
          left: "50%",
          top: 0,
          width: 2,
          height: "100%",
          background: "#555a72",
          transform: "translateX(-1px)",
        }}
      />
      {/* Horizontal divider */}
      <div
        className="absolute"
        style={{
          left: 0,
          top: "50%",
          width: "100%",
          height: 2,
          background: "#555a72",
          transform: "translateY(-1px)",
        }}
      />
      {/* Stars / ambient light dots */}
      <div className="absolute" style={{ left: "20%", top: "25%", width: 2, height: 2, borderRadius: "50%", background: "rgba(200,220,255,0.4)" }} />
      <div className="absolute" style={{ left: "70%", top: "35%", width: 1, height: 1, borderRadius: "50%", background: "rgba(200,220,255,0.3)" }} />
      <div className="absolute" style={{ left: "40%", top: "65%", width: 2, height: 2, borderRadius: "50%", background: "rgba(200,220,255,0.25)" }} />
    </div>
  );
}

function Workstation({ x, y }: { x: number; y: number; facing: string }) {
  const deskTop = y * TILE + 2;
  const deskLeft = x * TILE - 6;
  const deskW = TILE + 12;
  const deskH = TILE - 6;

  return (
    <div className="absolute" style={{ left: 0, top: 0, zIndex: y + 1 }}>
      {/* Desk surface */}
      <div
        className="absolute"
        style={{
          left: deskLeft,
          top: deskTop,
          width: deskW,
          height: deskH,
          background: "linear-gradient(180deg, #5a4a3a 0%, #4a3c2e 100%)",
          border: "1px solid #6b5a48",
          borderRadius: 2,
          boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
        }}
      />
      {/* Desk front edge (depth) */}
      <div
        className="absolute"
        style={{
          left: deskLeft,
          top: deskTop + deskH,
          width: deskW,
          height: 6,
          background: "#3d3025",
          borderRadius: "0 0 2px 2px",
          borderLeft: "1px solid #4a3c2e",
          borderRight: "1px solid #4a3c2e",
          borderBottom: "1px solid #4a3c2e",
        }}
      />
      {/* Desk legs */}
      <div className="absolute" style={{ left: deskLeft + 3, top: deskTop + deskH + 6, width: 3, height: 8, background: "#3d3025" }} />
      <div className="absolute" style={{ left: deskLeft + deskW - 6, top: deskTop + deskH + 6, width: 3, height: 8, background: "#3d3025" }} />

      {/* Monitor */}
      <div
        className="absolute"
        style={{
          left: x * TILE + 4,
          top: deskTop + 2,
          width: TILE - 8,
          height: TILE * 0.5,
          background: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
          border: "2px solid #334155",
          borderRadius: 2,
          boxShadow: "0 0 10px rgba(59,130,246,0.15), inset 0 0 20px rgba(59,130,246,0.05)",
        }}
      >
        {/* Screen content glow */}
        <div
          className="absolute inset-1 rounded-sm"
          style={{
            background: "linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(139,92,246,0.08) 100%)",
          }}
        />
        {/* Code lines */}
        <div className="absolute" style={{ left: 4, top: 3, width: "40%", height: 1.5, background: "rgba(96,165,250,0.3)", borderRadius: 1 }} />
        <div className="absolute" style={{ left: 4, top: 7, width: "60%", height: 1.5, background: "rgba(134,239,172,0.2)", borderRadius: 1 }} />
        <div className="absolute" style={{ left: 4, top: 11, width: "35%", height: 1.5, background: "rgba(251,191,36,0.2)", borderRadius: 1 }} />
      </div>
      {/* Monitor stand */}
      <div
        className="absolute"
        style={{
          left: x * TILE + TILE / 2 - 4,
          top: deskTop + TILE * 0.5 + 2,
          width: 8,
          height: 4,
          background: "#334155",
          borderRadius: 1,
        }}
      />
      {/* Monitor base */}
      <div
        className="absolute"
        style={{
          left: x * TILE + TILE / 2 - 8,
          top: deskTop + TILE * 0.5 + 5,
          width: 16,
          height: 3,
          background: "#334155",
          borderRadius: 1,
        }}
      />

      {/* Keyboard */}
      <div
        className="absolute"
        style={{
          left: x * TILE + 6,
          top: deskTop + deskH - 8,
          width: TILE - 12,
          height: 5,
          background: "#475569",
          borderRadius: 1,
          border: "1px solid #64748b",
        }}
      />

      {/* Chair */}
      <div
        className="absolute"
        style={{
          left: x * TILE + 6,
          top: (y + 1) * TILE + 10,
          width: TILE - 12,
          height: TILE - 16,
          background: "linear-gradient(180deg, #374151 0%, #1f2937 100%)",
          borderRadius: "4px 4px 2px 2px",
          border: "1px solid #4b5563",
          boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
          zIndex: y + 5,
        }}
      />
      {/* Chair wheels */}
      <div className="absolute" style={{ left: x * TILE + 8, top: (y + 1) * TILE + TILE - 4, width: 4, height: 4, borderRadius: "50%", background: "#1f2937", border: "1px solid #374151", zIndex: y + 5 }} />
      <div className="absolute" style={{ left: x * TILE + TILE - 12, top: (y + 1) * TILE + TILE - 4, width: 4, height: 4, borderRadius: "50%", background: "#1f2937", border: "1px solid #374151", zIndex: y + 5 }} />
    </div>
  );
}

function BookshelfUnit({ x, y }: { x: number; y: number }) {
  return (
    <div
      className="absolute"
      style={{
        left: x * TILE + 2,
        top: y * TILE + TILE - 2,
        width: TILE - 4,
        height: TILE + 8,
        background: "linear-gradient(180deg, #5a4a3a 0%, #4a3c2e 100%)",
        border: "1px solid #6b5a48",
        borderRadius: 2,
        zIndex: 2,
      }}
    >
      {/* Shelves */}
      {[0, 1, 2].map((i) => (
        <div key={i}>
          <div
            className="absolute"
            style={{
              left: 2,
              top: 4 + i * 14,
              width: "calc(100% - 4px)",
              height: 2,
              background: "#6b5a48",
            }}
          />
          {/* Books */}
          <div className="absolute flex gap-px" style={{ left: 3, top: 6 + i * 14 - 8 }}>
            {[
              ["#ef4444", 4, 8],
              ["#3b82f6", 3, 9],
              ["#22c55e", 4, 7],
              ["#eab308", 3, 8],
              ["#8b5cf6", 4, 9],
            ].map(([color, w, h], j) => (
              <div
                key={j}
                style={{
                  width: w as number,
                  height: h as number,
                  background: color as string,
                  borderRadius: 0.5,
                  marginTop: (9 - (h as number)),
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PlantPot({ x, y }: { x: number; y: number }) {
  return (
    <div
      className="absolute"
      style={{ left: x * TILE + 4, top: y * TILE + 4, zIndex: y + 5 }}
    >
      {/* Leaves */}
      <div style={{ position: "relative", width: TILE - 8, height: TILE - 14 }}>
        <div
          className="absolute"
          style={{
            left: "50%",
            top: 0,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "radial-gradient(circle, #4ade80 30%, #22c55e 100%)",
            transform: "translateX(-50%)",
            boxShadow: "0 0 8px rgba(34,197,94,0.2)",
          }}
        />
        <div
          className="absolute"
          style={{ left: 2, top: 6, width: 10, height: 10, borderRadius: "50%", background: "radial-gradient(circle, #4ade80 30%, #16a34a 100%)" }}
        />
        <div
          className="absolute"
          style={{ right: 2, top: 6, width: 10, height: 10, borderRadius: "50%", background: "radial-gradient(circle, #86efac 30%, #22c55e 100%)" }}
        />
      </div>
      {/* Pot */}
      <div
        style={{
          width: 16,
          height: 10,
          margin: "-2px auto 0",
          background: "linear-gradient(180deg, #a16207 0%, #854d0e 100%)",
          borderRadius: "2px 2px 4px 4px",
          border: "1px solid #a16207",
        }}
      />
    </div>
  );
}

function WhiteboardEl() {
  return (
    <div
      className="absolute"
      style={{
        left: WHITEBOARD.x * TILE + 2,
        top: WHITEBOARD.y * TILE + TILE - 4,
        width: WHITEBOARD.w * TILE - 4,
        height: WHITEBOARD.h * TILE - 8,
        background: "linear-gradient(180deg, #e8e8e8 0%, #d4d4d4 100%)",
        border: "3px solid #a3a3a3",
        borderRadius: 2,
        boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
        zIndex: 2,
      }}
    >
      {/* Whiteboard content */}
      <div className="absolute" style={{ left: 6, top: 6, width: "60%", height: 2, background: "#3b82f6", borderRadius: 1, opacity: 0.6 }} />
      <div className="absolute" style={{ left: 6, top: 12, width: "80%", height: 2, background: "#ef4444", borderRadius: 1, opacity: 0.5 }} />
      <div className="absolute" style={{ left: 6, top: 18, width: "45%", height: 2, background: "#22c55e", borderRadius: 1, opacity: 0.5 }} />
      <div className="absolute" style={{ left: 6, top: 24, width: "70%", height: 2, background: "#3b82f6", borderRadius: 1, opacity: 0.4 }} />
      {/* Sticky notes */}
      <div className="absolute" style={{ right: 6, top: 6, width: 12, height: 10, background: "#fde047", borderRadius: 1 }} />
      <div className="absolute" style={{ right: 6, top: 20, width: 12, height: 10, background: "#fb923c", borderRadius: 1 }} />
    </div>
  );
}

function CoffeeMachineEl() {
  return (
    <div
      className="absolute"
      style={{
        left: COFFEE_MACHINE.x * TILE + 8,
        top: COFFEE_MACHINE.y * TILE + 4,
        zIndex: COFFEE_MACHINE.y + 5,
      }}
    >
      <div
        style={{
          width: TILE - 16,
          height: TILE - 10,
          background: "linear-gradient(180deg, #374151 0%, #1f2937 100%)",
          borderRadius: 3,
          border: "1px solid #4b5563",
        }}
      >
        <div style={{ width: 6, height: 6, margin: "3px auto", borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 4px rgba(239,68,68,0.4)" }} />
        <div style={{ width: "60%", height: 3, margin: "2px auto", background: "#6b7280", borderRadius: 1 }} />
      </div>
      {/* Cup */}
      <div style={{ width: 8, height: 6, margin: "2px auto 0", background: "#e5e7eb", borderRadius: "0 0 2px 2px", border: "1px solid #d1d5db" }} />
    </div>
  );
}

function WaterCoolerEl() {
  return (
    <div
      className="absolute"
      style={{
        left: WATER_COOLER.x * TILE + 10,
        top: WATER_COOLER.y * TILE + 2,
        zIndex: WATER_COOLER.y + 5,
      }}
    >
      {/* Bottle */}
      <div
        style={{
          width: TILE - 20,
          height: TILE * 0.6,
          background: "linear-gradient(180deg, rgba(147,197,253,0.4) 0%, rgba(96,165,250,0.25) 100%)",
          border: "1px solid rgba(147,197,253,0.3)",
          borderRadius: "6px 6px 2px 2px",
        }}
      />
      {/* Base */}
      <div
        style={{
          width: TILE - 16,
          height: TILE * 0.35,
          margin: "0 -2px",
          background: "linear-gradient(180deg, #e5e7eb 0%, #d1d5db 100%)",
          borderRadius: 2,
          border: "1px solid #d1d5db",
        }}
      />
    </div>
  );
}

function ConfTableEl() {
  return (
    <div
      className="absolute"
      style={{
        left: CONF_TABLE.x * TILE,
        top: CONF_TABLE.y * TILE + 4,
        width: CONF_TABLE.w * TILE,
        height: CONF_TABLE.h * TILE - 8,
        background: "linear-gradient(180deg, #5a4a3a 0%, #4a3c2e 100%)",
        border: "2px solid #6b5a48",
        borderRadius: 8,
        boxShadow: "0 3px 8px rgba(0,0,0,0.4)",
        zIndex: CONF_TABLE.y + 1,
      }}
    >
      {/* Table surface sheen */}
      <div
        className="absolute inset-1 rounded-md"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 50%)",
        }}
      />
    </div>
  );
}

// Carpet border
function CarpetBorder() {
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: CARPET.x * TILE - 1,
        top: CARPET.y * TILE - 1,
        width: CARPET.w * TILE + 2,
        height: CARPET.h * TILE + 2,
        border: "1px solid rgba(99,102,241,0.12)",
        borderRadius: 2,
      }}
    />
  );
}

// Pixel art agent sprite (32px rendered / 16 viewBox)
function AgentSprite({
  agent,
  selected,
  onClick,
}: {
  agent: OfficeAgent;
  selected: boolean;
  onClick: () => void;
}) {
  const isWorking = agent.behavior === "working";
  const isMoving = agent.path.length > 0;

  const spriteSize = 40;

  // Determine animation class
  let animClass = "";
  if (isWorking) {
    animClass = "agent-typing";
  } else if (isMoving) {
    animClass = "agent-walk";
  } else if (agent.behavior === "lingering") {
    animClass = "agent-idle";
  }

  return (
    <div
      className="absolute cursor-pointer"
      style={{
        left: agent.pos.x * TILE + TILE / 2 - 20,
        top: agent.pos.y * TILE + TILE / 2 - 34,
        zIndex: Math.floor(agent.pos.y) + 10,
        opacity: agent.status === "offline" ? 0.35 : 1,
        transition: "opacity 0.3s",
      }}
      onClick={onClick}
    >
      {/* Task tooltip - show above head when working */}
      {agent.task && isWorking && (
        <div
          className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded"
          style={{
            background: "rgba(0,0,0,0.9)",
            border: `1px solid ${agent.color}40`,
            fontSize: 8,
            fontWeight: 500,
            color: "#e2e8f0",
            maxWidth: 130,
            overflow: "hidden",
            textOverflow: "ellipsis",
            zIndex: 100,
            boxShadow: `0 0 6px ${agent.color}20`,
          }}
        >
          <span style={{ color: agent.color, marginRight: 3 }}>&#9654;</span>
          {agent.task}
        </div>
      )}

      {/* Selection ring */}
      {selected && (
        <div
          className="absolute rounded-full animate-pulse"
          style={{
            left: -4,
            top: 2,
            width: spriteSize + 8,
            height: spriteSize + 8,
            border: `2px solid ${agent.color}`,
            boxShadow: `0 0 8px ${agent.color}60`,
          }}
        />
      )}

      {/* Pixel sprite body */}
      <div className={animClass}>
        <PixelAvatar name={agent.name} size={spriteSize} />
      </div>

      {/* Status indicator */}
      <div
        className="absolute"
        style={{
          right: -2,
          top: 2,
          width: 7,
          height: 7,
          borderRadius: "50%",
          background:
            agent.status === "online"
              ? "#22c55e"
              : agent.status === "busy"
              ? "#f59e0b"
              : agent.status === "idle"
              ? "#3b82f6"
              : "#6b7280",
          border: "1.5px solid #0f0f14",
          boxShadow:
            agent.status === "online"
              ? "0 0 5px rgba(34,197,94,0.6)"
              : agent.status === "busy"
              ? "0 0 5px rgba(245,158,11,0.6)"
              : "none",
        }}
      />

      {/* Name label */}
      <div
        className="text-center"
        style={{
          fontSize: 8,
          fontWeight: 700,
          color: "rgba(255,255,255,0.7)",
          textShadow: "0 1px 3px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.6)",
          letterSpacing: "0.03em",
          marginTop: 1,
        }}
      >
        {agent.name}
      </div>
    </div>
  );
}

function AgentStatusCard({
  agent,
  selected,
  onClick,
}: {
  agent: OfficeAgent;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 transition-all text-left"
      style={{
        background: selected
          ? "rgba(255,255,255,0.08)"
          : "rgba(255,255,255,0.03)",
        border: `1px solid ${
          selected ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)"
        }`,
        minWidth: 150,
      }}
    >
      {/* Mini pixel avatar */}
      <div
        className="flex-shrink-0 rounded"
        style={{
          width: 28,
          height: 28,
          background: agent.color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `1px solid ${agent.color}80`,
          boxShadow: `0 0 6px ${agent.color}30`,
        }}
      >
        <span style={{ fontSize: 14 }}>{agent.emoji}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
          {agent.name}
        </div>
        <div className="text-[10px] text-[var(--text-muted)] truncate">
          {agent.task && agent.behavior === "working"
            ? agent.task
            : agent.behavior === "lingering"
            ? "Taking a break"
            : agent.behavior === "roaming"
            ? "Walking around"
            : agent.behavior === "traveling" && (agent.status === "online" || agent.status === "busy")
            ? "Heading to desk"
            : "Available"}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <div
            className="rounded-full"
            style={{
              width: 5,
              height: 5,
              background:
                agent.behavior === "working"
                  ? "#22c55e"
                  : agent.behavior === "roaming" || agent.behavior === "traveling"
                  ? "#3b82f6"
                  : agent.behavior === "lingering"
                  ? "#eab308"
                  : "#6b7280",
            }}
          />
          <span className="text-[9px] text-[var(--text-muted)] capitalize">
            {agent.behavior === "working"
              ? "Working"
              : agent.behavior === "lingering"
              ? "On break"
              : agent.behavior === "roaming" || agent.behavior === "traveling"
              ? "Moving"
              : agent.status}
          </span>
        </div>
      </div>
    </button>
  );
}

// Ambient lighting overlay
function AmbientLighting() {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 50 }}>
      {/* Overhead light pools from windows */}
      {WINDOWS.map((w, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: w.x * TILE + (w.w * TILE) / 2 - 60,
            top: TILE + 10,
            width: 120,
            height: 100,
            background: "radial-gradient(ellipse, rgba(147,197,253,0.04) 0%, transparent 70%)",
          }}
        />
      ))}
      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.3) 100%)",
        }}
      />
    </div>
  );
}

// -- Main Page --

export default function OfficePage() {
  const store = useStore();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [panelAgentId, setPanelAgentId] = useState<string | null>(null);

  // Find the store Agent object for the panel
  const panelAgent = panelAgentId ? store.agents.find((a) => a.name.toLowerCase() === panelAgentId) : null;

  const [agents, setAgents] = useState<OfficeAgent[]>(() =>
    AGENT_DEFS.map((def, i) => {
      const mock = store.agents.find(
        (a) => a.name.toLowerCase() === def.name.toLowerCase()
      );
      const status = mock?.status ?? "idle";
      const hasTask = status === "online" || status === "busy";
      const deskSeat = getDeskSeatPos(i);
      const startPos = hasTask ? { ...deskSeat } : { ...def.home };
      const targetPos = hasTask ? { ...deskSeat } : pickRandomSocialSpot();
      const path = hasTask ? [] : findPath(startPos, targetPos);

      return {
        ...def,
        status,
        task: mock?.currentTask,
        deskIndex: i,
        pos: startPos,
        target: targetPos,
        path,
        behavior: hasTask ? "working" as const : "roaming" as const,
        lingerUntil: 0,
        facing: "down" as const,
        walkFrame: 0,
      };
    })
  );

  // Sync store agent changes (status/task) into office agents
  useEffect(() => {
    setAgents((prev) =>
      prev.map((officeAgent) => {
        const storeAgent = store.agents.find(
          (a) => a.name.toLowerCase() === officeAgent.name.toLowerCase()
        );
        if (!storeAgent) return officeAgent;
        if (storeAgent.status !== officeAgent.status || storeAgent.currentTask !== officeAgent.task) {
          return {
            ...officeAgent,
            status: storeAgent.status,
            task: storeAgent.currentTask,
          };
        }
        return officeAgent;
      })
    );
  }, [store.agents]);

  const animFrame = useRef<number>(0);
  const lastTime = useRef<number>(0);

  const moveAgents = useCallback(() => {
    const now = performance.now();
    const delta = now - lastTime.current;
    lastTime.current = now;

    // Cap delta to avoid huge jumps on tab switch
    const clampedDelta = Math.min(delta, 100);
    const moveAmount = clampedDelta * 1.8 / 1000; // tiles to move this frame

    setAgents((prev) =>
      prev.map((agent) => {
        const isOnTask = agent.status === "online" || agent.status === "busy";

        // ── WORKING: Agent has a task → sit at desk ──
        if (isOnTask) {
          const deskSeat = getDeskSeatPos(agent.deskIndex);
          const deskKey = `${deskSeat.x},${deskSeat.y}`;
          const atDesk =
            Math.abs(agent.pos.x - deskSeat.x) < 0.05 &&
            Math.abs(agent.pos.y - deskSeat.y) < 0.05;

          if (atDesk) {
            // Seated at desk — working
            return {
              ...agent,
              behavior: "working" as const,
              pos: { ...deskSeat },
              target: { ...deskSeat },
              path: [],
              facing: "up" as const,
              walkFrame: 0,
            };
          }

          // Need to path to desk
          const targetChanged =
            agent.target.x !== deskSeat.x || agent.target.y !== deskSeat.y;
          let path = agent.path;
          if (targetChanged || path.length === 0) {
            // Only compute path if target changed or no path
            const newPath = findPath(agent.pos, deskSeat);
            if (newPath.length === 0 && !atDesk) {
              // Can't path there (maybe blocked), try direct
              // Snap toward desk anyway
              return {
                ...agent,
                behavior: "traveling" as const,
                target: deskSeat,
                pos: { ...deskSeat },
                path: [],
                facing: "up" as const,
                walkFrame: 0,
              };
            }
            path = newPath;
          }

          // Follow path
          return followPath(agent, path, moveAmount, "traveling", deskSeat);
        }

        // ── IDLE: No task → roam between social spots ──

        // If lingering at a spot, wait
        if (agent.behavior === "lingering") {
          if (now < agent.lingerUntil) return agent;
          // Done lingering, pick a new social spot
          const newSpot = pickRandomSocialSpot();
          const newPath = findPath(agent.pos, newSpot);
          return {
            ...agent,
            behavior: "roaming" as const,
            target: newSpot,
            path: newPath,
          };
        }

        // Check if arrived
        if (agent.path.length === 0) {
          const distToTarget = Math.abs(agent.pos.x - agent.target.x) + Math.abs(agent.pos.y - agent.target.y);
          if (distToTarget < 0.1) {
            // Arrived at social spot — linger for 4-8 seconds
            const lingerDuration = 4000 + Math.random() * 4000;
            return {
              ...agent,
              pos: { ...agent.target },
              behavior: "lingering" as const,
              lingerUntil: now + lingerDuration,
              walkFrame: 0,
              path: [],
            };
          }
          // No path but not at target — recompute
          const newPath = findPath(agent.pos, agent.target);
          if (newPath.length === 0) {
            // Can't reach target, pick a new spot
            const newSpot = pickRandomSocialSpot();
            const altPath = findPath(agent.pos, newSpot);
            return {
              ...agent,
              behavior: "roaming" as const,
              target: newSpot,
              path: altPath,
            };
          }
          return { ...agent, path: newPath };
        }

        // Follow path
        return followPath(agent, agent.path, moveAmount, "roaming", agent.target);
      })
    );

    animFrame.current = requestAnimationFrame(moveAgents);
  }, []);

  useEffect(() => {
    lastTime.current = performance.now();
    animFrame.current = requestAnimationFrame(moveAgents);
    return () => cancelAnimationFrame(animFrame.current);
  }, [moveAgents]);

  const recentActivity = store.activity.slice(0, 5);

  return (
    <div
      className="flex flex-col min-h-[calc(100vh-56px)]"
      style={{
        marginLeft: "-24px",
        marginRight: "-24px",
        marginTop: "-24px",
        marginBottom: "-24px",
      }}
    >
      <div className="flex flex-1 min-h-0">
        {/* Office Map */}
        <div
          className="flex-1 relative overflow-hidden flex items-start justify-center"
          style={{ background: "#0d0e12" }}
        >
          <div
            className="relative"
            style={{
              width: MAP_W,
              height: MAP_H,
              marginTop: 12,
            }}
          >
            {/* Floor */}
            <Floor />

            {/* Carpet border */}
            <CarpetBorder />

            {/* Walls */}
            <Walls />

            {/* Windows */}
            {WINDOWS.map((w, i) => (
              <WindowPane key={i} x={w.x} y={w.y} w={w.w} />
            ))}

            {/* Bookshelves */}
            {BOOKSHELVES.map((b, i) => (
              <BookshelfUnit key={i} x={b.x} y={b.y} />
            ))}

            {/* Whiteboard */}
            <WhiteboardEl />

            {/* Workstations */}
            {WORKSTATIONS.map((ws, i) => (
              <Workstation key={i} x={ws.x} y={ws.y} facing={ws.facing} />
            ))}

            {/* Conference table */}
            <ConfTableEl />

            {/* Plants */}
            {PLANTS.map((p, i) => (
              <PlantPot key={i} x={p.x} y={p.y} />
            ))}

            {/* Coffee & Water */}
            <CoffeeMachineEl />
            <WaterCoolerEl />

            {/* Ambient lighting overlay */}
            <AmbientLighting />

            {/* Agents */}
            {agents.map((agent) => (
              <AgentSprite
                key={agent.id}
                agent={agent}
                selected={selectedAgent === agent.id}
                onClick={() => {
                  setSelectedAgent(selectedAgent === agent.id ? null : agent.id);
                  setPanelAgentId(agent.name.toLowerCase());
                }}
              />
            ))}
          </div>
        </div>

        {/* Right sidebar - Activity */}
        <div
          className="w-[240px] flex-shrink-0 flex flex-col p-4"
          style={{ borderLeft: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider font-medium mb-3">
            Recent Activity
          </div>
          {recentActivity.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
              <p className="text-[11px] text-[var(--text-muted)]">
                No recent activity
              </p>
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto flex-1">
              {recentActivity.map((event) => (
                <div
                  key={event.id}
                  className="rounded-lg p-2.5"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                      style={{
                        background:
                          event.severity === "success"
                            ? "#22c55e"
                            : event.severity === "warning"
                            ? "#f59e0b"
                            : event.severity === "error"
                            ? "#ef4444"
                            : "#3b82f6",
                      }}
                    />
                    <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                      {event.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom agent status bar */}
      <div
        className="flex-shrink-0 overflow-x-auto"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <div className="flex gap-2 p-3 min-w-max">
          {agents.map((agent) => (
            <AgentStatusCard
              key={agent.id}
              agent={agent}
              selected={selectedAgent === agent.id}
              onClick={() => {
                setSelectedAgent(selectedAgent === agent.id ? null : agent.id);
                setPanelAgentId(agent.name.toLowerCase());
              }}
            />
          ))}
        </div>
      </div>

      {/* Agent Detail Panel */}
      {panelAgent && (
        <AgentPanel
          agent={panelAgent}
          onClose={() => {
            setPanelAgentId(null);
            setSelectedAgent(null);
          }}
        />
      )}

      <style>{`
        @keyframes agent-walk {
          0%, 100% { transform: translateY(0); }
          25% { transform: translateY(-2px) rotate(-2deg); }
          50% { transform: translateY(0); }
          75% { transform: translateY(-2px) rotate(2deg); }
        }
        @keyframes agent-idle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-1px); }
        }
        @keyframes agent-typing {
          0%, 100% { transform: translateY(0) scale(1); }
          15% { transform: translateY(-0.5px) scale(1.01); }
          30% { transform: translateY(0) scale(1); }
          45% { transform: translateY(-0.5px) scale(1.01); }
          60% { transform: translateY(0) scale(1); }
        }
        .agent-walk {
          animation: agent-walk 0.5s ease-in-out infinite;
        }
        .agent-idle {
          animation: agent-idle 2.5s ease-in-out infinite;
        }
        .agent-typing {
          animation: agent-typing 1.2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

// -- Movement helper --

function followPath(
  agent: OfficeAgent,
  path: Pos[],
  moveAmount: number,
  behavior: "roaming" | "traveling",
  target: Pos
): OfficeAgent {
  if (path.length === 0) return agent;

  let currentX = agent.pos.x;
  let currentY = agent.pos.y;
  let remaining = moveAmount;
  let currentPath = [...path];
  let facing = agent.facing;

  while (remaining > 0 && currentPath.length > 0) {
    const waypoint = currentPath[0];
    const dx = waypoint.x - currentX;
    const dy = waypoint.y - currentY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.05) {
      // Snap to waypoint and shift path
      currentX = waypoint.x;
      currentY = waypoint.y;
      currentPath.shift();
      continue;
    }

    // Update facing direction
    if (Math.abs(dx) > Math.abs(dy)) {
      facing = dx > 0 ? "right" : "left";
    } else {
      facing = dy > 0 ? "down" : "up";
    }

    if (remaining >= dist) {
      // We can reach this waypoint
      currentX = waypoint.x;
      currentY = waypoint.y;
      remaining -= dist;
      currentPath.shift();
    } else {
      // Move partially toward waypoint
      const ratio = remaining / dist;
      currentX += dx * ratio;
      currentY += dy * ratio;
      remaining = 0;
    }
  }

  return {
    ...agent,
    behavior,
    target,
    pos: { x: currentX, y: currentY },
    path: currentPath,
    facing,
    walkFrame: agent.walkFrame + 1,
  };
}
