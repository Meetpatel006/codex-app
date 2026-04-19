// FILE: linux-systemd.js
// Purpose: Owns Linux user-systemd install/start/stop/status helpers for the background Portdex bridge.
// Layer: CLI helper
// Exports: start/stop/status helpers for Linux background service mode.
// Depends on: child_process, fs, os, path, ./codex-desktop-refresher, ./daemon-state

const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { readBridgeConfig } = require("./codex-desktop-refresher");
const {
  clearBridgeStatus,
  clearPairingSession,
  ensurePortdexLogsDir,
  ensurePortdexStateDir,
  readBridgeStatus,
  readPairingSession,
  resolveBridgeStderrLogPath,
  resolveBridgeStdoutLogPath,
  writeDaemonConfig,
} = require("./daemon-state");

const SERVICE_FILE_NAME = "com.portdex.bridge.service";
const SERVICE_NAME = "com.portdex.bridge";
const DEFAULT_PAIRING_WAIT_TIMEOUT_MS = 10_000;
const DEFAULT_PAIRING_WAIT_INTERVAL_MS = 200;

async function startLinuxBridgeService({
  env = process.env,
  platform = process.platform,
  fsImpl = fs,
  execFileSyncImpl = execFileSync,
  osImpl = os,
  nodePath = process.execPath,
  cliPath = path.resolve(__dirname, "..", "bin", "portdex.js"),
  waitForPairing = false,
  pairingTimeoutMs = DEFAULT_PAIRING_WAIT_TIMEOUT_MS,
  pairingPollIntervalMs = DEFAULT_PAIRING_WAIT_INTERVAL_MS,
} = {}) {
  assertLinuxPlatform(platform);
  const config = readBridgeConfig({ env });
  assertRelayConfigured(config);
  const startedAt = Date.now();

  writeDaemonConfig(config, { env, fsImpl });
  clearPairingSession({ env, fsImpl });
  clearBridgeStatus({ env, fsImpl });
  ensurePortdexStateDir({ env, fsImpl, osImpl });
  ensurePortdexLogsDir({ env, fsImpl, osImpl });

  const unitPath = writeSystemdUnitFile({
    env,
    fsImpl,
    osImpl,
    nodePath,
    cliPath,
  });

  runSystemctl(execFileSyncImpl, ["--user", "daemon-reload"]);
  runSystemctl(execFileSyncImpl, ["--user", "enable", "--now", SERVICE_FILE_NAME]);

  if (!waitForPairing) {
    return {
      unitPath,
      pairingSession: null,
    };
  }

  const pairingSession = await waitForFreshPairingSession({
    env,
    fsImpl,
    startedAt,
    timeoutMs: pairingTimeoutMs,
    intervalMs: pairingPollIntervalMs,
  });

  return {
    unitPath,
    pairingSession,
  };
}

function stopLinuxBridgeService({
  env = process.env,
  platform = process.platform,
  execFileSyncImpl = execFileSync,
  fsImpl = fs,
} = {}) {
  assertLinuxPlatform(platform);
  try {
    runSystemctl(execFileSyncImpl, ["--user", "stop", SERVICE_FILE_NAME]);
  } catch {
    // Ignore missing/stopped service errors so reset flows stay idempotent.
  }
  clearPairingSession({ env, fsImpl });
  clearBridgeStatus({ env, fsImpl });
}

function getLinuxBridgeServiceStatus({
  env = process.env,
  platform = process.platform,
  execFileSyncImpl = execFileSync,
  fsImpl = fs,
  osImpl = os,
} = {}) {
  assertLinuxPlatform(platform);
  const unitPath = resolveSystemdUnitPath({ env, osImpl });
  const status = readSystemdStatus({ execFileSyncImpl });
  return {
    label: SERVICE_NAME,
    serviceFile: SERVICE_FILE_NAME,
    platform: "linux",
    installed: fsImpl.existsSync(unitPath),
    launchdLoaded: status.loaded,
    launchdPid: status.pid,
    bridgeStatus: readBridgeStatus({ env, fsImpl }),
    pairingSession: readPairingSession({ env, fsImpl }),
    stdoutLogPath: resolveBridgeStdoutLogPath({ env, osImpl }),
    stderrLogPath: resolveBridgeStderrLogPath({ env, osImpl }),
  };
}

function printLinuxBridgeServiceStatus(options = {}) {
  const status = getLinuxBridgeServiceStatus(options);
  const bridgeState = status.bridgeStatus?.state || "unknown";
  const connectionStatus = status.bridgeStatus?.connectionStatus || "unknown";
  const pairingCreatedAt = status.pairingSession?.createdAt || "none";
  console.log(`[portdex] Service label: ${status.label}`);
  console.log(`[portdex] Installed: ${status.installed ? "yes" : "no"}`);
  console.log(`[portdex] Service loaded: ${status.launchdLoaded ? "yes" : "no"}`);
  console.log(`[portdex] PID: ${status.launchdPid || status.bridgeStatus?.pid || "unknown"}`);
  console.log(`[portdex] Bridge state: ${bridgeState}`);
  console.log(`[portdex] Connection: ${connectionStatus}`);
  console.log(`[portdex] Pairing payload: ${pairingCreatedAt}`);
  console.log(`[portdex] Stdout log: ${status.stdoutLogPath}`);
  console.log(`[portdex] Stderr log: ${status.stderrLogPath}`);
}

function resolveSystemdUnitPath({ env = process.env, osImpl = os } = {}) {
  const homeDir = env.HOME || osImpl.homedir();
  return path.join(homeDir, ".config", "systemd", "user", SERVICE_FILE_NAME);
}

function writeSystemdUnitFile({
  env = process.env,
  fsImpl = fs,
  osImpl = os,
  nodePath,
  cliPath,
} = {}) {
  const unitPath = resolveSystemdUnitPath({ env, osImpl });
  const homeDir = env.HOME || osImpl.homedir();
  const stateDir = env.PORTDEX_DEVICE_STATE_DIR || "";
  const stdoutLogPath = resolveBridgeStdoutLogPath({ env, osImpl });
  const stderrLogPath = resolveBridgeStderrLogPath({ env, osImpl });
  const serviceText = buildSystemdUnit({
    homeDir,
    pathEnv: env.PATH || "",
    stateDir,
    stdoutLogPath,
    stderrLogPath,
    nodePath,
    cliPath,
  });
  fsImpl.mkdirSync(path.dirname(unitPath), { recursive: true });
  fsImpl.writeFileSync(unitPath, serviceText, "utf8");
  return unitPath;
}

function buildSystemdUnit({
  homeDir,
  pathEnv,
  stateDir,
  stdoutLogPath,
  stderrLogPath,
  nodePath,
  cliPath,
}) {
  const envLines = [
    `Environment=HOME=${escapeSystemdValue(homeDir)}`,
    `Environment=PATH=${escapeSystemdValue(pathEnv)}`,
  ];

  if (stateDir.trim()) {
    envLines.push(`Environment=PORTDEX_DEVICE_STATE_DIR=${escapeSystemdValue(stateDir)}`);
  }

  return [
    "[Unit]",
    "Description=Portdex Bridge Service",
    "After=network-online.target",
    "Wants=network-online.target",
    "",
    "[Service]",
    "Type=simple",
    ...envLines,
    `ExecStart=${escapeSystemdExec(nodePath)} ${escapeSystemdExec(cliPath)} run-service`,
    "Restart=always",
    "RestartSec=2",
    `WorkingDirectory=${escapeSystemdValue(homeDir)}`,
    `StandardOutput=append:${escapeSystemdValue(stdoutLogPath)}`,
    `StandardError=append:${escapeSystemdValue(stderrLogPath)}`,
    "",
    "[Install]",
    "WantedBy=default.target",
    "",
  ].join("\n");
}

function readSystemdStatus({ execFileSyncImpl = execFileSync } = {}) {
  try {
    const output = runSystemctl(execFileSyncImpl, [
      "--user",
      "show",
      SERVICE_FILE_NAME,
      "--property=LoadState,ActiveState,SubState,MainPID,UnitFileState",
      "--no-pager",
    ], { encoding: "utf8" });
    const parsed = parseSystemdProperties(output);
    const activeState = normalizeNonEmptyString(parsed.ActiveState);
    const pid = Number.parseInt(parsed.MainPID || "", 10);
    return {
      loaded: activeState === "active" || activeState === "activating",
      pid: Number.isFinite(pid) && pid > 0 ? pid : null,
      raw: output,
    };
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    if (
      message.includes("could not be found")
      || message.includes("not found")
      || message.includes("failed to connect to bus")
    ) {
      return {
        loaded: false,
        pid: null,
        raw: "",
      };
    }
    throw error;
  }
}

function runSystemctl(execFileSyncImpl, args, options = {}) {
  try {
    return execFileSyncImpl("systemctl", args, {
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });
  } catch (error) {
    const stderr = error?.stderr?.toString?.("utf8") || "";
    const stdout = error?.stdout?.toString?.("utf8") || "";
    const combined = [stderr, stdout, error?.message || ""].join("\n").toLowerCase();
    if (combined.includes("failed to connect to bus")) {
      throw new Error(
        "Linux background service requires user systemd. Start a login session with systemd user services, or use `portdex run`.",
      );
    }
    if (combined.includes("command not found") || combined.includes("not recognized")) {
      throw new Error("systemctl is not available on this system. Use `portdex run`.");
    }
    throw error;
  }
}

function parseSystemdProperties(output) {
  const result = {};
  for (const line of String(output || "").split(/\r?\n/)) {
    const index = line.indexOf("=");
    if (index <= 0) {
      continue;
    }
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (key) {
      result[key] = value;
    }
  }
  return result;
}

function assertLinuxPlatform(platform = process.platform) {
  if (platform !== "linux") {
    throw new Error("Linux bridge service management is only available on Linux.");
  }
}

function assertRelayConfigured(config) {
  if (typeof config?.relayUrl === "string" && config.relayUrl.trim()) {
    return;
  }
  throw new Error("No relay URL configured. Set PORTDEX_RELAY before enabling the Linux bridge service.");
}

async function waitForFreshPairingSession({
  env = process.env,
  fsImpl = fs,
  startedAt = Date.now(),
  timeoutMs = DEFAULT_PAIRING_WAIT_TIMEOUT_MS,
  intervalMs = DEFAULT_PAIRING_WAIT_INTERVAL_MS,
} = {}) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const pairingSession = readPairingSession({ env, fsImpl });
    const createdAt = Date.parse(pairingSession?.createdAt || "");
    if (pairingSession?.pairingPayload && Number.isFinite(createdAt) && createdAt >= startedAt) {
      return pairingSession;
    }
    await sleep(intervalMs);
  }

  throw new Error(
    `Timed out waiting for the Linux bridge service to publish a pairing QR. `
      + `Check ${resolveBridgeStderrLogPath({ env })}.`,
  );
}

function normalizeNonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function escapeSystemdValue(value) {
  return String(value || "").replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function escapeSystemdExec(value) {
  const text = String(value || "");
  if (!text.includes(" ") && !text.includes("\t")) {
    return text;
  }
  return `"${text.replaceAll('"', '\\"')}"`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  SERVICE_FILE_NAME,
  getLinuxBridgeServiceStatus,
  printLinuxBridgeServiceStatus,
  resolveSystemdUnitPath,
  startLinuxBridgeService,
  stopLinuxBridgeService,
};
