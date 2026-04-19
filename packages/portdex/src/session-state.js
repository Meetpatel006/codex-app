// FILE: session-state.js
// Purpose: Persists the latest active thread for local status and resume metadata.
// Layer: CLI helper
// Exports: rememberActiveThread, openLastActiveThread, readLastActiveThread
// Depends on: fs, os, path

const fs = require("fs");
const os = require("os");
const path = require("path");

const STATE_DIR = path.join(os.homedir(), ".portdex");
const STATE_FILE = path.join(STATE_DIR, "last-thread.json");

function rememberActiveThread(threadId, source) {
  if (!threadId || typeof threadId !== "string") {
    return false;
  }

  const payload = {
    threadId,
    source: source || "unknown",
    updatedAt: new Date().toISOString(),
  };

  fs.mkdirSync(STATE_DIR, { recursive: true });
  writeJSONFileAtomic(STATE_FILE, payload);
  return true;
}

function writeJSONFileAtomic(targetPath, payload) {
  const directory = path.dirname(targetPath);
  const tempPath = path.join(
    directory,
    `${path.basename(targetPath)}.${process.pid}.${Date.now()}.tmp`
  );

  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2));
  fs.renameSync(tempPath, targetPath);
}

function openLastActiveThread() {
  const state = readState();
  const threadId = state?.threadId;
  if (!threadId) {
    throw new Error("No remembered thread found yet.");
  }

  return state;
}

function readState() {
  if (!fs.existsSync(STATE_FILE)) {
    return null;
  }

  const raw = fs.readFileSync(STATE_FILE, "utf8");
  return JSON.parse(raw);
}

module.exports = {
  rememberActiveThread,
  openLastActiveThread,
  readLastActiveThread: readState,
};
