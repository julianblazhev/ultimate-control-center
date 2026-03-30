// ═══════════════════════════════════════════════════════════════
// Server-side configuration — reads from environment variables
// Set via `mission-control setup` or manually in .env.local
// ═══════════════════════════════════════════════════════════════

export function getConfig() {
  const orgName = process.env.ORG_NAME || "Mission Control";
  const words = orgName.trim().split(/\s+/);
  const orgInitials = words
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return {
    orgName,
    orgInitials: orgInitials || "MC",
    openclawBin: process.env.OPENCLAW_BIN || "openclaw",
    workspacePath: process.env.WORKSPACE_PATH || "",
    gatewayUrl: process.env.OPENCLAW_GATEWAY_URL || "",
    gatewayToken: process.env.OPENCLAW_GATEWAY_TOKEN || "",
    dashboardSecret: process.env.DASHBOARD_SECRET || "",
    isConfigured: !!(process.env.DASHBOARD_SECRET && process.env.ORG_NAME),
  };
}
