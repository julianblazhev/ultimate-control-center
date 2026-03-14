#!/usr/bin/env node

const { program } = require("commander");
const prompts = require("prompts");
const { execFileSync, spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const os = require("os");

// ── Constants ────────────────────────────────────────────────

const PACKAGE_ROOT = path.resolve(__dirname, "..");
const CONFIG_DIR = path.join(os.homedir(), ".config", "openclaw-mission-control");
const ENV_FILE = path.join(CONFIG_DIR, ".env.local");

// ── Helpers ──────────────────────────────────────────────────

function banner() {
  console.log("");
  console.log("  ╔══════════════════════════════════════╗");
  console.log("  ║   OpenClaw Mission Control  v0.1.0   ║");
  console.log("  ╚══════════════════════════════════════╝");
  console.log("");
}

function success(msg) {
  console.log(`  ✓ ${msg}`);
}

function warn(msg) {
  console.log(`  ⚠ ${msg}`);
}

function info(msg) {
  console.log(`  → ${msg}`);
}

function detectBinary() {
  try {
    const result = execFileSync("which", ["openclaw"], { encoding: "utf-8" }).trim();
    return result || null;
  } catch {
    return null;
  }
}

function detectWorkspace() {
  const candidates = [
    path.join(os.homedir(), ".openclaw", "agents", "main", "workspace"),
    path.join(os.homedir(), ".openclaw", "workspace"),
    path.join(os.homedir(), ".openclaw"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function detectGateway(bin) {
  try {
    const raw = execFileSync(bin, ["gateway", "status", "--json"], {
      encoding: "utf-8",
      timeout: 5000,
    });
    const data = JSON.parse(raw);
    const rt = data.service?.runtime || data.runtime;
    const isRunning = rt?.status === "running" || rt?.state === "active";
    const rpcUrl = data.rpc?.url || data.gateway?.probeUrl || null;
    const port = data.gateway?.port || null;
    return { running: isRunning, rpcUrl, port, raw: data };
  } catch {
    return { running: false, rpcUrl: null, port: null, raw: null };
  }
}

function loadConfig() {
  if (!fs.existsSync(ENV_FILE)) return null;
  const content = fs.readFileSync(ENV_FILE, "utf-8");
  const config = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    config[key] = value;
  }
  return config;
}

function writeConfig(config) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  const dashboardSecret = crypto.randomBytes(32).toString("hex");
  const lines = [
    "# OpenClaw Mission Control Configuration",
    `# Generated on ${new Date().toISOString()}`,
    "",
    `ORG_NAME=${config.orgName || "Mission Control"}`,
    `DASHBOARD_SECRET=${dashboardSecret}`,
    `OPENCLAW_BIN=${config.openclawBin || "openclaw"}`,
    `WORKSPACE_PATH=${config.workspacePath || ""}`,
    `OPENCLAW_GATEWAY_URL=${config.gatewayUrl || ""}`,
    `PORT=${config.port || "3000"}`,
    "",
  ];
  fs.writeFileSync(ENV_FILE, lines.join("\n"), { mode: 0o600 });
}

function spawnNext(command, extraArgs = []) {
  const config = loadConfig();
  if (!config) {
    console.log("");
    warn("No configuration found. Run `mission-control setup` first.");
    console.log("");
    process.exit(1);
  }

  const nextBin = path.join(PACKAGE_ROOT, "node_modules", ".bin", "next");
  const args = [command, ...extraArgs];

  const child = spawn(nextBin, args, {
    cwd: PACKAGE_ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      ...config,
    },
  });

  child.on("exit", (code) => process.exit(code || 0));
  child.on("error", (err) => {
    console.error(`Failed to start: ${err.message}`);
    process.exit(1);
  });
}

// ── Commands ─────────────────────────────────────────────────

program
  .name("mission-control")
  .description("AI operations command center for OpenClaw")
  .version("0.1.0");

program
  .command("setup")
  .description("Configure your Mission Control instance")
  .action(async () => {
    banner();
    info("Let's set up your command center.\n");

    // 1. Detect OpenClaw binary
    const detectedBin = detectBinary();
    if (detectedBin) {
      success(`Found OpenClaw at ${detectedBin}`);
    } else {
      warn("Could not auto-detect OpenClaw binary");
    }

    const { openclawBin } = await prompts({
      type: "text",
      name: "openclawBin",
      message: "Path to openclaw binary",
      initial: detectedBin || "openclaw",
    });

    if (!openclawBin) {
      console.log("\n  Setup cancelled.\n");
      process.exit(0);
    }

    // 2. Detect workspace
    const detectedWorkspace = detectWorkspace();
    if (detectedWorkspace) {
      success(`Found workspace at ${detectedWorkspace}`);
    }

    const { workspacePath } = await prompts({
      type: "text",
      name: "workspacePath",
      message: "OpenClaw workspace path",
      initial: detectedWorkspace || path.join(os.homedir(), ".openclaw"),
    });

    // 3. Detect gateway
    info("Checking gateway...");
    const gateway = detectGateway(openclawBin);
    if (gateway.running && gateway.rpcUrl) {
      success(`Gateway running at ${gateway.rpcUrl}`);
    } else if (gateway.running) {
      success("Gateway is running");
    } else {
      warn("Gateway not detected — dashboard will use demo data");
    }

    const gatewayUrl = gateway.rpcUrl || "";

    // 4. Organization name (white-label)
    console.log("");
    const { orgName } = await prompts({
      type: "text",
      name: "orgName",
      message: "Name your command center",
      initial: "Mission Control",
    });

    // 5. Port
    const { port } = await prompts({
      type: "text",
      name: "port",
      message: "Port",
      initial: "3000",
    });

    // Write config
    writeConfig({ openclawBin, workspacePath, gatewayUrl, orgName, port });

    console.log("");
    success(`Configuration saved to ${ENV_FILE}`);
    console.log("");
    console.log("  Next steps:");
    console.log("  ──────────────────────────────────");
    console.log("  mission-control dev      Start development server");
    console.log("  mission-control start    Start production server");
    console.log("");
  });

program
  .command("dev")
  .description("Start the development server")
  .action(() => {
    banner();
    info("Starting development server...\n");
    spawnNext("dev");
  });

program
  .command("start")
  .description("Start the production server")
  .action(() => {
    banner();
    info("Starting production server...\n");
    spawnNext("start");
  });

program
  .command("build")
  .description("Build for production")
  .action(() => {
    banner();
    info("Building for production...\n");
    spawnNext("build");
  });

program.parse();
