// FILE: index.js
// Purpose: Small entrypoint wrapper for bridge lifecycle commands.
// Layer: CLI entry
// Exports: bridge lifecycle, pairing reset, thread resume/watch, and platform service helpers.
// Depends on: ./bridge, ./secure-device-state, ./session-state, ./rollout-watch, ./macos-launch-agent, ./linux-systemd, ./windows-service

const { startBridge } = require("./bridge");
const { resetBridgeDeviceState } = require("./secure-device-state");
const { openLastActiveThread } = require("./session-state");
const { watchThreadRollout } = require("./rollout-watch");
const { readBridgeConfig } = require("./codex-desktop-refresher");
const {
  getMacOSBridgeServiceStatus,
  printMacOSBridgePairingQr,
  printMacOSBridgeServiceStatus,
  resetMacOSBridgePairing,
  runMacOSBridgeService,
  startMacOSBridgeService,
  stopMacOSBridgeService,
} = require("./macos-launch-agent");
const {
  getLinuxBridgeServiceStatus,
  printLinuxBridgeServiceStatus,
  startLinuxBridgeService,
  stopLinuxBridgeService,
} = require("./linux-systemd");
const {
  getWindowsBridgeServiceStatus,
  printWindowsBridgeServiceStatus,
  startWindowsBridgeService,
  stopWindowsBridgeService,
} = require("./windows-service");

module.exports = {
  getLinuxBridgeServiceStatus,
  getMacOSBridgeServiceStatus,
  getWindowsBridgeServiceStatus,
  printLinuxBridgeServiceStatus,
  printMacOSBridgePairingQr,
  printMacOSBridgeServiceStatus,
  printWindowsBridgeServiceStatus,
  readBridgeConfig,
  resetMacOSBridgePairing,
  startBridge,
  startLinuxBridgeService,
  runMacOSBridgeService,
  startMacOSBridgeService,
  startWindowsBridgeService,
  stopLinuxBridgeService,
  stopMacOSBridgeService,
  stopWindowsBridgeService,
  resetBridgePairing: resetBridgeDeviceState,
  openLastActiveThread,
  watchThreadRollout,
};
