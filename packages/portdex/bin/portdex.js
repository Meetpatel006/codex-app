#!/usr/bin/env node
// FILE: portdex.js
// Purpose: CLI surface for foreground bridge runs, pairing reset, thread resume, and macOS service control.
// Layer: CLI binary
// Exports: none
// Depends on: ../src

const {
  printMacOSBridgePairingQr,
  printLinuxBridgeServiceStatus,
  printMacOSBridgeServiceStatus,
  printWindowsBridgeServiceStatus,
  readBridgeConfig,
  resetMacOSBridgePairing,
  runMacOSBridgeService,
  startLinuxBridgeService,
  startBridge,
  startMacOSBridgeService,
  startWindowsBridgeService,
  stopLinuxBridgeService,
  stopMacOSBridgeService,
  stopWindowsBridgeService,
  resetBridgePairing,
  openLastActiveThread,
  watchThreadRollout,
} = require("../src");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const packageJsonPath = fs.existsSync(path.join(__dirname, "..", "package.json"))
  ? path.join(__dirname, "..", "package.json")
  : path.join(__dirname, "..", "..", "package.json");
const { version } = require(packageJsonPath);
const { parseRuntimeOptions } = require("../src/runtime-options");
const {
  clearPairingSession,
  readDaemonConfig,
  writeBridgeStatus,
  writePairingSession,
} = require("../src/daemon-state");

loadDotEnv();
void main();

// ─── ENTRY POINT ─────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  // Check version command first before parsing runtime args
  if (args.length > 0 && isVersionCommand(args[0])) {
    console.log(version);
    return;
  }

  const { command, runtimeArgs } = parseCliArgs(args);

  if (command === "up") {
    if (process.platform === "darwin") {
      const result = await startMacOSBridgeService({
        waitForPairing: true,
      });
      printMacOSBridgePairingQr({
        pairingSession: result.pairingSession,
      });
      return;
    }

    if (process.platform === "linux") {
      const result = await startLinuxBridgeService({
        waitForPairing: true,
      });
      printMacOSBridgePairingQr({
        pairingSession: result.pairingSession,
      });
      return;
    }

    if (process.platform === "win32") {
      const result = await startWindowsBridgeService({
        waitForPairing: true,
      });
      printMacOSBridgePairingQr({
        pairingSession: result.pairingSession,
      });
      return;
    }

    const runtimeOptions = parseRuntimeOptions({ args: runtimeArgs });
    startBridge({ runtimeOptions });
    return;
  }

  if (command === "run") {
    const runtimeOptions = parseRuntimeOptions({ args: runtimeArgs });
    startBridge({ runtimeOptions });
    return;
  }

  if (command === "run-service") {
    if (process.platform === "darwin") {
      runMacOSBridgeService();
      return;
    }

    runManagedBridgeService();
    return;
  }

  if (command === "start") {
    readBridgeConfig();
    if (process.platform === "darwin") {
      const result = await startMacOSBridgeService({ waitForPairing: true });
      printMacOSBridgePairingQr({
        pairingSession: result.pairingSession,
      });
      return;
    }
    if (process.platform === "linux") {
      const result = await startLinuxBridgeService({ waitForPairing: true });
      printMacOSBridgePairingQr({
        pairingSession: result.pairingSession,
      });
      return;
    }
    if (process.platform === "win32") {
      const result = await startWindowsBridgeService({ waitForPairing: true });
      printMacOSBridgePairingQr({
        pairingSession: result.pairingSession,
      });
      return;
    }

    assertServicePlatform(command);
    return;
  }

  if (command === "stop") {
    if (process.platform === "darwin") {
      stopMacOSBridgeService();
      console.log("[portdex] macOS bridge service stopped.");
      return;
    }
    if (process.platform === "linux") {
      stopLinuxBridgeService();
      console.log("[portdex] Linux bridge service stopped.");
      return;
    }
    if (process.platform === "win32") {
      await stopWindowsBridgeService();
      console.log("[portdex] Windows bridge service stopped.");
      return;
    }

    assertServicePlatform(command);
    return;
  }

  if (command === "status") {
    if (process.platform === "darwin") {
      printMacOSBridgeServiceStatus();
      return;
    }
    if (process.platform === "linux") {
      printLinuxBridgeServiceStatus();
      return;
    }
    if (process.platform === "win32") {
      printWindowsBridgeServiceStatus();
      return;
    }

    assertServicePlatform(command);
    return;
  }

  if (command === "reset-pairing") {
    try {
      if (process.platform === "darwin") {
        resetMacOSBridgePairing();
        console.log(
          "[portdex] Stopped the macOS bridge service and cleared the saved pairing state. Run `portdex up` to pair again.",
        );
      } else if (process.platform === "linux") {
        stopLinuxBridgeService();
        resetBridgePairing();
        console.log(
          "[portdex] Stopped the Linux bridge service and cleared the saved pairing state. Run `portdex up` to pair again.",
        );
      } else if (process.platform === "win32") {
        await stopWindowsBridgeService();
        resetBridgePairing();
        console.log(
          "[portdex] Stopped the Windows bridge service and cleared the saved pairing state. Run `portdex up` to pair again.",
        );
      } else {
        resetBridgePairing();
        console.log(
          "[portdex] Cleared the saved pairing state. Run `portdex up` to pair again.",
        );
      }
    } catch (error) {
      console.error(`[portdex] ${(error && error.message) || "Failed to clear the saved pairing state."}`);
      process.exit(1);
    }
    return;
  }

  if (command === "resume") {
    try {
      const state = openLastActiveThread();
      console.log(
        `[portdex] Last active thread: ${state.threadId} (${state.source || "unknown"})`
      );
    } catch (error) {
      console.error(`[portdex] ${(error && error.message) || "Failed to read the last thread."}`);
      process.exit(1);
    }
    return;
  }

  if (command === "watch") {
    try {
      watchThreadRollout(process.argv[3] || "");
    } catch (error) {
      console.error(`[portdex] ${(error && error.message) || "Failed to watch the thread rollout."}`);
      process.exit(1);
    }
    return;
  }

  console.error(`Unknown command: ${command}`);
  console.error(
    "Usage: portdex up | portdex run | portdex start | portdex stop | portdex status | "
    + "portdex reset-pairing | portdex resume | portdex watch [threadId] | portdex --version"
  );
  process.exit(1);
}

function assertServicePlatform(name) {
  if (process.platform === "darwin" || process.platform === "linux" || process.platform === "win32") {
    return;
  }

  console.error(`[portdex] \`${name}\` is only available on macOS, Linux, and Windows. Use \`portdex run\` for the foreground bridge on this OS.`);
  process.exit(1);
}

function isVersionCommand(value) {
  return (
    value === "-v" ||
    value === "--v" ||
    value === "-V" ||
    value === "--version" ||
    value === "version"
  );
}

// Parse CLI args to extract command and runtime options (--model, --thinking, etc.)
function parseCliArgs(args) {
  if (!args.length) {
    return { command: "up", runtimeArgs: {} };
  }

  const command = args[0] && !args[0].startsWith("--") ? args[0] : "up";
  const runtimeArgs = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--model" && args[i + 1]) {
      runtimeArgs.model = args[i + 1];
      i++;
    } else if (arg === "--thinking" && args[i + 1]) {
      runtimeArgs.thinking = args[i + 1];
      i++;
    } else if (arg === "--permission" && args[i + 1]) {
      runtimeArgs.permission = args[i + 1];
      i++;
    } else if (arg === "--branch" && args[i + 1]) {
      runtimeArgs.branch = args[i + 1];
      i++;
    } else if (arg === "--type" && args[i + 1]) {
      runtimeArgs.type = args[i + 1];
      i++;
    }
  }

  return { command, runtimeArgs };
}

function runManagedBridgeService() {
  const config = readDaemonConfig();
  if (!config?.relayUrl) {
    const message = "No relay URL configured for the background bridge service.";
    clearPairingSession();
    writeBridgeStatus({
      state: "error",
      connectionStatus: "error",
      pid: process.pid,
      lastError: message,
    });
    console.error(`[portdex] ${message}`);
    return;
  }

  startBridge({
    config,
    printPairingQr: false,
    onPairingPayload(pairingPayload) {
      writePairingSession(pairingPayload);
    },
    onBridgeStatus(status) {
      writeBridgeStatus(status);
    },
  });
}

function loadDotEnv() {
  const envCandidates = [
    path.join(process.cwd(), ".env"),
    path.join(__dirname, "..", ".env"),
  ];
  const loaded = new Set();

  for (const envPath of envCandidates) {
    if (loaded.has(envPath) || !fs.existsSync(envPath)) {
      continue;
    }
    dotenv.config({ path: envPath, override: false });
    loaded.add(envPath);
  }
}
