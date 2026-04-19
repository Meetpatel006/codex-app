// FILE: windows-service.js
// Purpose: Owns Windows service install/start/stop/status helpers for the background Portdex bridge.
// Layer: CLI helper
// Exports: start/stop/status helpers for Windows background service mode.
// Depends on: child_process, fs, os, path, node-windows, ./codex-desktop-refresher, ./daemon-state

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
  resolvePortdexStateDir,
  writeDaemonConfig,
} = require("./daemon-state");

const SERVICE_NAME = "PortdexBridge";
const SERVICE_WINDOWS_ID = "portdexbridge.exe";
const SERVICE_LABEL = "com.portdex.bridge";
const DEFAULT_PAIRING_WAIT_TIMEOUT_MS = 10_000;
const DEFAULT_PAIRING_WAIT_INTERVAL_MS = 200;

async function startWindowsBridgeService({
  env = process.env,
  platform = process.platform,
  fsImpl = fs,
  execFileSyncImpl = execFileSync,
  osImpl = os,
  nodePath = process.execPath,
  cliPath = process.argv[1] || path.resolve(__dirname, "..", "bin", "portdex.js"),
  ServiceCtor,
  waitForPairing = false,
  pairingTimeoutMs = DEFAULT_PAIRING_WAIT_TIMEOUT_MS,
  pairingPollIntervalMs = DEFAULT_PAIRING_WAIT_INTERVAL_MS,
} = {}) {
  assertWindowsPlatform(platform);
  const config = readBridgeConfig({ env });
  assertRelayConfigured(config);
  const startedAt = Date.now();
  const stateDir = resolvePortdexStateDir({ env, osImpl });
  const codexCliPath = resolveCodexCliPath({ env, fsImpl, execFileSyncImpl });
  const codexHomePath = resolveCodexHomePath({ env, fsImpl });

  writeDaemonConfig(config, { env, fsImpl });
  clearPairingSession({ env, fsImpl });
  clearBridgeStatus({ env, fsImpl });
  ensurePortdexStateDir({ env, fsImpl, osImpl });
  ensurePortdexLogsDir({ env, fsImpl, osImpl });

  await ensureWindowsService({
    execFileSyncImpl,
    fsImpl,
    nodePath,
    cliPath,
    stateDir,
    codexCliPath,
    codexHomePath,
    ServiceCtor,
  });
  const serviceStatus = readWindowsServiceStatus(execFileSyncImpl);
  if (!serviceStatus.running) {
    const service = createWindowsService({
      ServiceCtor,
      serviceName: SERVICE_NAME,
        execPath: nodePath,
        cliPath,
        stateDir,
        codexCliPath,
        codexHomePath,
      });
      await startService(service);
  }

  if (!waitForPairing) {
    return {
      serviceName: SERVICE_NAME,
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
    serviceName: SERVICE_NAME,
    pairingSession,
  };
}

async function stopWindowsBridgeService({
  env = process.env,
  platform = process.platform,
  execFileSyncImpl = execFileSync,
  fsImpl = fs,
  nodePath = process.execPath,
  cliPath = process.argv[1] || path.resolve(__dirname, "..", "bin", "portdex.js"),
  osImpl = os,
  ServiceCtor,
} = {}) {
  assertWindowsPlatform(platform);
  const queryResult = readWindowsServiceStatus(execFileSyncImpl);
  const stateDir = resolvePortdexStateDir({ env, osImpl });
  const codexCliPath = resolveCodexCliPath({ env, fsImpl, execFileSyncImpl });
  const codexHomePath = resolveCodexHomePath({ env, fsImpl });
  try {
    if (queryResult.installed && queryResult.running) {
      const service = createWindowsService({
        ServiceCtor,
        serviceName: SERVICE_NAME,
        execPath: nodePath,
        cliPath,
        stateDir,
        codexCliPath,
        codexHomePath,
      });
      await stopService(service);
    }
  } catch {
    // Ignore missing/stopped service errors to keep control commands idempotent.
  }
  clearPairingSession({ env, fsImpl });
  clearBridgeStatus({ env, fsImpl });
}

function getWindowsBridgeServiceStatus({
  env = process.env,
  platform = process.platform,
  execFileSyncImpl = execFileSync,
  fsImpl = fs,
  osImpl = os,
} = {}) {
  assertWindowsPlatform(platform);
  const queryResult = readWindowsServiceStatus(execFileSyncImpl);
  return {
    label: SERVICE_LABEL,
    serviceName: SERVICE_NAME,
    platform: "win32",
    installed: queryResult.installed,
    launchdLoaded: queryResult.running,
    launchdPid: queryResult.pid,
    bridgeStatus: readBridgeStatus({ env, fsImpl }),
    pairingSession: readPairingSession({ env, fsImpl }),
    stdoutLogPath: resolveBridgeStdoutLogPath({ env, osImpl }),
    stderrLogPath: resolveBridgeStderrLogPath({ env, osImpl }),
  };
}

function printWindowsBridgeServiceStatus(options = {}) {
  const status = getWindowsBridgeServiceStatus(options);
  const bridgeState = status.bridgeStatus?.state || "unknown";
  const connectionStatus = status.bridgeStatus?.connectionStatus || "unknown";
  const pairingCreatedAt = status.pairingSession?.createdAt || "none";
  console.log(`[portdex] Service label: ${status.label}`);
  console.log(`[portdex] Installed: ${status.installed ? "yes" : "no"}`);
  console.log(`[portdex] Service running: ${status.launchdLoaded ? "yes" : "no"}`);
  console.log(`[portdex] PID: ${status.launchdPid || status.bridgeStatus?.pid || "unknown"}`);
  console.log(`[portdex] Bridge state: ${bridgeState}`);
  console.log(`[portdex] Connection: ${connectionStatus}`);
  console.log(`[portdex] Pairing payload: ${pairingCreatedAt}`);
  console.log(`[portdex] Stdout log: ${status.stdoutLogPath}`);
  console.log(`[portdex] Stderr log: ${status.stderrLogPath}`);
}

async function ensureWindowsService({
  execFileSyncImpl,
  fsImpl = fs,
  nodePath,
  cliPath,
  stateDir,
  codexCliPath,
  codexHomePath,
  ServiceCtor,
}) {
  stopWindowsServiceAlias(execFileSyncImpl, SERVICE_NAME);
  stopWindowsServiceAlias(execFileSyncImpl, SERVICE_WINDOWS_ID);
  deleteWindowsServiceAlias(execFileSyncImpl, SERVICE_NAME);
  deleteWindowsServiceAlias(execFileSyncImpl, SERVICE_WINDOWS_ID);
  removeNodeWindowsDaemonArtifacts({ fsImpl, cliPath });

  const service = createWindowsService({
    ServiceCtor,
    serviceName: SERVICE_NAME,
    execPath: nodePath,
    cliPath,
    stateDir,
    codexCliPath,
    codexHomePath,
  });
  await installService(service);
}

function readWindowsServiceStatus(execFileSyncImpl) {
  for (const serviceName of [SERVICE_NAME, SERVICE_WINDOWS_ID]) {
    try {
      const output = runSc(execFileSyncImpl, ["queryex", serviceName], {
        encoding: "utf8",
      });
      const stateMatch = String(output).match(/STATE\s*:\s*\d+\s+(\w+)/i);
      const pidMatch = String(output).match(/PID\s*:\s*(\d+)/i);
      const state = stateMatch ? stateMatch[1].toUpperCase() : "UNKNOWN";
      const pid = pidMatch ? Number.parseInt(pidMatch[1], 10) : null;
      return {
        installed: true,
        running: state === "RUNNING" || state === "START_PENDING",
        pid: Number.isFinite(pid) && pid > 0 ? pid : null,
        raw: output,
      };
    } catch (error) {
      if (!isMissingServiceError(error)) {
        throw error;
      }
    }
  }

  return {
    installed: false,
    running: false,
    pid: null,
    raw: "",
  };
}

function runSc(execFileSyncImpl, args, options = {}) {
  try {
    return execFileSyncImpl("sc.exe", args, {
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });
  } catch (error) {
    const stderr = error?.stderr?.toString?.("utf8") || "";
    const stdout = error?.stdout?.toString?.("utf8") || "";
    const combined = [stderr, stdout, error?.message || ""].join("\n").toLowerCase();
    if (
      combined.includes("access is denied") ||
      combined.includes("error 5") ||
      combined.includes("[sc] openscmanager failed") ||
      error?.status === 5
    ) {
      throw new Error(
        "Windows service management requires an elevated shell. Re-run this command from PowerShell as Administrator.",
      );
    }
    throw error;
  }
}

function createWindowsService({
  ServiceCtor,
  serviceName,
  execPath,
  cliPath,
  stateDir = "",
  codexCliPath = "",
  codexHomePath = "",
}) {
  const NodeWindowsService = resolveServiceCtor(ServiceCtor);
  const serviceEnv = [];
  if (stateDir) {
    serviceEnv.push({ name: "PORTDEX_DEVICE_STATE_DIR", value: stateDir });
  }
  if (codexCliPath) {
    serviceEnv.push({ name: "PORTDEX_CODEX_CLI_PATH", value: codexCliPath });
  }
  if (codexHomePath) {
    serviceEnv.push({ name: "CODEX_HOME", value: codexHomePath });
  }

  return new NodeWindowsService({
    name: serviceName,
    description: "Portdex Bridge Service",
    script: cliPath,
    scriptOptions: "run-service",
    execPath,
    workingDirectory: path.resolve(path.dirname(cliPath), ".."),
    env: serviceEnv.length > 0 ? serviceEnv : undefined,
  });
}

function resolveCodexCliPath({
  env = process.env,
  fsImpl = fs,
  execFileSyncImpl = execFileSync,
} = {}) {
  const whereResults = runWhereCodex(execFileSyncImpl);
  if (whereResults.length > 0) {
    return whereResults[0];
  }

  const userProfile = readNonEmptyString(env.USERPROFILE);
  const appData = readNonEmptyString(env.APPDATA);
  const localAppData = readNonEmptyString(env.LOCALAPPDATA);
  const programFiles = readNonEmptyString(env.ProgramFiles);
  const candidates = [
    userProfile ? path.join(userProfile, ".bun", "bin", "codex.exe") : "",
    appData ? path.join(appData, "npm", "codex.cmd") : "",
    appData ? path.join(appData, "npm", "codex") : "",
    localAppData ? path.join(localAppData, "Programs", "nodejs", "codex.cmd") : "",
    programFiles ? path.join(programFiles, "nodejs", "codex.cmd") : "",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fsImpl.existsSync(candidate)) {
      return candidate;
    }
  }

  return "";
}

function resolveCodexHomePath({
  env = process.env,
  fsImpl = fs,
} = {}) {
  const configuredHome = readNonEmptyString(env.CODEX_HOME);
  if (configuredHome) {
    return configuredHome;
  }

  const userProfile = readNonEmptyString(env.USERPROFILE);
  if (!userProfile) {
    return "";
  }

  const candidate = path.join(userProfile, ".codex");
  return fsImpl.existsSync(candidate) ? candidate : "";
}

function runWhereCodex(execFileSyncImpl) {
  try {
    const output = execFileSyncImpl("where.exe", ["codex"], {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    });
    return String(output)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function readNonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function resolveServiceCtor(ServiceCtor) {
  if (ServiceCtor) {
    return ServiceCtor;
  }

  const { Service } = require("node-windows");
  if (typeof Service !== "function") {
    throw new Error("node-windows Service API is unavailable.");
  }
  return Service;
}

function installService(service) {
  return waitForServiceEvent({
    service,
    successEvents: ["install", "alreadyinstalled"],
    failureEvents: ["error", "invalidinstallation"],
    run: () => service.install(),
  });
}

function startService(service) {
  return waitForServiceEvent({
    service,
    successEvents: ["start"],
    failureEvents: ["error"],
    run: () => service.start(),
  });
}

function stopService(service) {
  return waitForServiceEvent({
    service,
    successEvents: ["stop"],
    failureEvents: ["error"],
    run: () => service.stop(),
  });
}

function waitForServiceEvent({
  service,
  successEvents,
  failureEvents,
  run,
  timeoutMs = 30_000,
}) {
  return new Promise((resolve, reject) => {
    let done = false;
    let timer = null;
    const listeners = [];

    const finish = (callback) => (value) => {
      if (done) {
        return;
      }
      done = true;
      if (timer) {
        clearTimeout(timer);
      }
      for (const [eventName, handler] of listeners) {
        service.removeListener(eventName, handler);
      }
      callback(value);
    };

    const resolveOnce = finish(resolve);
    const rejectOnce = finish((error) => reject(error instanceof Error ? error : new Error(String(error))));

    for (const eventName of successEvents) {
      const handler = () => resolveOnce();
      listeners.push([eventName, handler]);
      service.on(eventName, handler);
    }

    for (const eventName of failureEvents) {
      const handler = (error) => rejectOnce(error || new Error(`Service action failed on event: ${eventName}`));
      listeners.push([eventName, handler]);
      service.on(eventName, handler);
    }

    try {
      run();
      timer = setTimeout(() => {
        rejectOnce(new Error("Timed out waiting for Windows service action to complete."));
      }, timeoutMs);
    } catch (error) {
      rejectOnce(error);
    }
  });
}

function isMissingServiceError(error) {
  const combined = [
    error?.message,
    error?.stderr?.toString?.("utf8"),
    error?.stdout?.toString?.("utf8"),
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  return combined.includes("1060") || combined.includes("does not exist");
}

function isIgnorableStopOrDeleteError(error) {
  const combined = [
    error?.message,
    error?.stderr?.toString?.("utf8"),
    error?.stdout?.toString?.("utf8"),
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  return combined.includes("1062") || combined.includes("1060") || combined.includes("does not exist");
}

function stopWindowsServiceAlias(execFileSyncImpl, serviceName) {
  try {
    runSc(execFileSyncImpl, ["stop", serviceName], { encoding: "utf8" });
  } catch (error) {
    if (!isIgnorableStopOrDeleteError(error)) {
      throw error;
    }
  }
}

function deleteWindowsServiceAlias(execFileSyncImpl, serviceName) {
  try {
    runSc(execFileSyncImpl, ["delete", serviceName], { encoding: "utf8" });
  } catch (error) {
    if (!isIgnorableStopOrDeleteError(error)) {
      throw error;
    }
  }
}

function removeNodeWindowsDaemonArtifacts({ fsImpl = fs, cliPath }) {
  const daemonDirPath = path.join(path.dirname(cliPath), "daemon");
  try {
    fsImpl.rmSync(daemonDirPath, { recursive: true, force: true });
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
}

function assertWindowsPlatform(platform = process.platform) {
  if (platform !== "win32") {
    throw new Error("Windows bridge service management is only available on Windows.");
  }
}

function assertRelayConfigured(config) {
  if (typeof config?.relayUrl === "string" && config.relayUrl.trim()) {
    return;
  }
  throw new Error("No relay URL configured. Set PORTDEX_RELAY before enabling the Windows bridge service.");
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
    `Timed out waiting for the Windows bridge service to publish a pairing QR. `
      + `Check ${resolveBridgeStderrLogPath({ env })}.`,
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  SERVICE_NAME,
  getWindowsBridgeServiceStatus,
  printWindowsBridgeServiceStatus,
  startWindowsBridgeService,
  stopWindowsBridgeService,
};
