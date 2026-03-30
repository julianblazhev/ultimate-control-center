// ═══════════════════════════════════════════════════════════════
// Device Identity — Ed25519 keypair for OpenClaw gateway auth
// Compatible with OpenClaw connect protocol v2
// ═══════════════════════════════════════════════════════════════

import crypto from "crypto";
import fs from "fs";
import path from "path";
import os from "os";

export interface DeviceIdentity {
  deviceId: string;
  publicKeyPem: string;
  privateKeyPem: string;
}

const IDENTITY_DIR = path.join(os.homedir(), ".mission-control", "identity");
const IDENTITY_FILE = path.join(IDENTITY_DIR, "device.json");

function deriveDeviceId(publicKeyPem: string): string {
  // Raw Ed25519 public key bytes → SHA-256 hex
  const pubKey = crypto.createPublicKey(publicKeyPem);
  const rawBytes = pubKey.export({ type: "spki", format: "der" });
  return crypto.createHash("sha256").update(rawBytes).digest("hex");
}

function generateIdentity(): DeviceIdentity {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }) as string;
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
  const deviceId = deriveDeviceId(publicKeyPem);
  return { deviceId, publicKeyPem, privateKeyPem };
}

function writeIdentity(identity: DeviceIdentity): void {
  fs.mkdirSync(IDENTITY_DIR, { recursive: true });
  const payload = {
    version: 1,
    deviceId: identity.deviceId,
    publicKeyPem: identity.publicKeyPem,
    privateKeyPem: identity.privateKeyPem,
    createdAtMs: Date.now(),
  };
  fs.writeFileSync(IDENTITY_FILE, JSON.stringify(payload, null, 2) + "\n", { mode: 0o600 });
}

export function loadOrCreateDeviceIdentity(): DeviceIdentity {
  try {
    if (fs.existsSync(IDENTITY_FILE)) {
      const raw = JSON.parse(fs.readFileSync(IDENTITY_FILE, "utf-8"));
      const { publicKeyPem, privateKeyPem } = raw;
      if (publicKeyPem && privateKeyPem) {
        const deviceId = deriveDeviceId(publicKeyPem);
        return { deviceId, publicKeyPem, privateKeyPem };
      }
    }
  } catch {
    // Fall through to regenerate
  }
  const identity = generateIdentity();
  writeIdentity(identity);
  return identity;
}

export function publicKeyRawBase64url(publicKeyPem: string): string {
  const pubKey = crypto.createPublicKey(publicKeyPem);
  const raw = pubKey.export({ type: "spki", format: "der" });
  // Last 32 bytes of SPKI DER are the raw Ed25519 key
  const rawKey = raw.subarray(raw.length - 32);
  return rawKey.toString("base64url");
}

export function signPayload(privateKeyPem: string, payload: string): string {
  const privKey = crypto.createPrivateKey(privateKeyPem);
  const signature = crypto.sign(null, Buffer.from(payload, "utf-8"), privKey);
  return signature.toString("base64url");
}

export function buildDeviceAuthPayload(opts: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token: string | null;
  nonce: string | null;
}): string {
  const version = opts.nonce ? "v2" : "v1";
  const parts = [
    version,
    opts.deviceId,
    opts.clientId,
    opts.clientMode,
    opts.role,
    opts.scopes.join(","),
    String(opts.signedAtMs),
    opts.token || "",
  ];
  if (version === "v2") {
    parts.push(opts.nonce || "");
  }
  return parts.join("|");
}
