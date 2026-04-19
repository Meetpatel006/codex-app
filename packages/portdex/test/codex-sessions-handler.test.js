const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const { handleCodexSessionsRequest } = require("../src/codex-sessions-handler");
const sessionState = require("../src/session-state");

test("codex/sessions/read includes file-change messages reconstructed from apply_patch", async (t) => {
  const homeDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "codex-sessions-handler-"),
  );
  const sessionsDir = path.join(homeDir, "sessions", "2026", "03", "25");
  fs.mkdirSync(sessionsDir, { recursive: true });

  const rolloutPath = path.join(
    sessionsDir,
    "rollout-2026-03-25T20-00-00-thread-file-change.jsonl",
  );
  fs.writeFileSync(
    rolloutPath,
    [
      JSON.stringify({
        timestamp: "2026-03-25T14:30:00.000Z",
        type: "session_meta",
        payload: {
          id: "thread-file-change",
          cwd: "C:\\repo",
          originator: "Codex Desktop",
          source: "vscode",
        },
      }),
      JSON.stringify({
        timestamp: "2026-03-25T14:30:01.000Z",
        type: "response_item",
        payload: {
          type: "custom_tool_call",
          status: "completed",
          call_id: "call-patch",
          name: "apply_patch",
          input: [
            "*** Begin Patch",
            "*** Update File: C:\\repo\\src\\screen.tsx",
            "@@",
            "-before",
            "+after",
            "*** Add File: C:\\repo\\src\\new.ts",
            "+export const ready = true;",
            "*** End Patch",
          ].join("\n"),
        },
      }),
      JSON.stringify({
        timestamp: "2026-03-25T14:30:02.000Z",
        type: "turn_context",
        payload: {
          model: "gpt-5.4",
          effort: "high",
        },
      }),
      "",
    ].join("\n"),
  );

  const previousCodexHome = process.env.CODEX_HOME;
  process.env.CODEX_HOME = homeDir;
  t.after(() => {
    if (previousCodexHome == null) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = previousCodexHome;
    }
    fs.rmSync(homeDir, { recursive: true, force: true });
  });

  const response = await requestCodexSessionRead("thread-file-change");
  assert.equal(Array.isArray(response.chat), true);
  assert.equal(response.chat.length, 1);
  assert.equal(response.model, "gpt-5.4");
  assert.equal(response.effort, "high");
  assert.deepEqual(response.chat[0], {
    id: "call-patch",
    role: "system",
    kind: "file-change",
    text: "Applying file changes...",
    fileChanges: [
      {
        path: "src/screen.tsx",
        action: "edited",
        additions: 1,
        deletions: 1,
      },
      {
        path: "src/new.ts",
        action: "created",
        additions: 1,
        deletions: 0,
      },
    ],
    timestamp: "2026-03-25T14:30:01.000Z",
  });
});

test("codex/sessions/list uses the real session_meta id instead of the rollout filename stem", async (t) => {
  const homeDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "codex-sessions-handler-list-"),
  );
  const sessionsDir = path.join(homeDir, "sessions", "2026", "03", "22");
  fs.mkdirSync(sessionsDir, { recursive: true });

  const rolloutPath = path.join(
    sessionsDir,
    "rollout-2026-03-22T16-16-44-019d1527-85ab-7910-8e7e-5fb0496ae0c6.jsonl",
  );
  fs.writeFileSync(
    rolloutPath,
    [
      JSON.stringify({
        timestamp: "2026-03-22T10:46:44.000Z",
        type: "session_meta",
        payload: {
          id: "019d1527-85ab-7910-8e7e-5fb0496ae0c6",
          cwd: "C:\\repo",
          originator: "Codex Desktop",
          source: "vscode",
        },
      }),
      JSON.stringify({
        timestamp: "2026-03-22T10:46:45.000Z",
        type: "event_msg",
        payload: {
          type: "user_message",
          message: "hello",
        },
      }),
      "",
    ].join("\n"),
  );

  const previousCodexHome = process.env.CODEX_HOME;
  process.env.CODEX_HOME = homeDir;
  t.after(() => {
    if (previousCodexHome == null) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = previousCodexHome;
    }
    fs.rmSync(homeDir, { recursive: true, force: true });
  });

  const response = await requestCodexSessionsList();
  assert.equal(Array.isArray(response.sessions), true);
  assert.equal(response.sessions.length, 1);
  assert.equal(
    response.sessions[0].threadId,
    "019d1527-85ab-7910-8e7e-5fb0496ae0c6",
  );
  assert.equal(
    response.sessions[0].sessionId,
    "019d1527-85ab-7910-8e7e-5fb0496ae0c6",
  );
});

test("codex/sessions/active prefers remembered active thread when present", async (t) => {
  const homeDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "codex-sessions-handler-active-"),
  );
  const sessionsDir = path.join(homeDir, "sessions", "2026", "03", "30");
  fs.mkdirSync(sessionsDir, { recursive: true });

  const olderPath = path.join(
    sessionsDir,
    "rollout-2026-03-30T09-00-00-thread-remembered.jsonl",
  );
  const newerPath = path.join(
    sessionsDir,
    "rollout-2026-03-30T09-30-00-thread-recent.jsonl",
  );
  writeSessionMetaRollout(olderPath, "thread-remembered");
  writeSessionMetaRollout(newerPath, "thread-recent");
  fs.utimesSync(
    olderPath,
    new Date("2026-03-30T09:00:00.000Z"),
    new Date("2026-03-30T09:00:00.000Z"),
  );
  fs.utimesSync(
    newerPath,
    new Date("2026-03-30T09:30:00.000Z"),
    new Date("2026-03-30T09:30:00.000Z"),
  );

  const previousCodexHome = process.env.CODEX_HOME;
  process.env.CODEX_HOME = homeDir;
  const previousReadLastActiveThread = sessionState.readLastActiveThread;
  sessionState.readLastActiveThread = () => ({
    threadId: "thread-remembered",
  });

  t.after(() => {
    sessionState.readLastActiveThread = previousReadLastActiveThread;
    if (previousCodexHome == null) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = previousCodexHome;
    }
    fs.rmSync(homeDir, { recursive: true, force: true });
  });

  const response = await requestCodexActiveSession();
  assert.equal(response.activeSessionId, "thread-remembered");
  assert.equal(response.source, "remembered");
  assert.equal(response.session?.sessionId, "thread-remembered");
});

test("codex/sessions/active falls back to most recent session when remembered thread is unavailable", async (t) => {
  const homeDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "codex-sessions-handler-active-fallback-"),
  );
  const sessionsDir = path.join(homeDir, "sessions", "2026", "03", "31");
  fs.mkdirSync(sessionsDir, { recursive: true });

  const olderPath = path.join(
    sessionsDir,
    "rollout-2026-03-31T09-00-00-thread-older.jsonl",
  );
  const newerPath = path.join(
    sessionsDir,
    "rollout-2026-03-31T09-45-00-thread-newer.jsonl",
  );
  writeSessionMetaRollout(olderPath, "thread-older");
  writeSessionMetaRollout(newerPath, "thread-newer");
  fs.utimesSync(
    olderPath,
    new Date("2026-03-31T09:00:00.000Z"),
    new Date("2026-03-31T09:00:00.000Z"),
  );
  fs.utimesSync(
    newerPath,
    new Date("2026-03-31T09:45:00.000Z"),
    new Date("2026-03-31T09:45:00.000Z"),
  );

  const previousCodexHome = process.env.CODEX_HOME;
  process.env.CODEX_HOME = homeDir;
  const previousReadLastActiveThread = sessionState.readLastActiveThread;
  sessionState.readLastActiveThread = () => ({
    threadId: "missing-thread",
  });

  t.after(() => {
    sessionState.readLastActiveThread = previousReadLastActiveThread;
    if (previousCodexHome == null) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = previousCodexHome;
    }
    fs.rmSync(homeDir, { recursive: true, force: true });
  });

  const response = await requestCodexActiveSession();
  assert.equal(response.activeSessionId, "thread-newer");
  assert.equal(response.source, "recent");
  assert.equal(response.session?.sessionId, "thread-newer");
});

test("codex/sessions/list logs the empty title fallback at most once per rollout", async (t) => {
  const homeDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "codex-sessions-handler-empty-title-"),
  );
  const sessionsDir = path.join(homeDir, "sessions", "2026", "04", "18");
  fs.mkdirSync(sessionsDir, { recursive: true });

  const rolloutPath = path.join(
    sessionsDir,
    "rollout-2026-04-18T12-00-00-thread-empty-title.jsonl",
  );
  writeSessionMetaRollout(rolloutPath, "thread-empty-title");

  const previousCodexHome = process.env.CODEX_HOME;
  process.env.CODEX_HOME = homeDir;
  const previousDebugSessions = process.env.PORTDEX_DEBUG_SESSIONS;
  process.env.PORTDEX_DEBUG_SESSIONS = "1";
  const originalConsoleLog = console.log;
  const capturedLogs = [];
  console.log = (...args) => {
    capturedLogs.push(args.join(" "));
  };

  t.after(() => {
    console.log = originalConsoleLog;
    if (previousCodexHome == null) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = previousCodexHome;
    }
    if (previousDebugSessions == null) {
      delete process.env.PORTDEX_DEBUG_SESSIONS;
    } else {
      process.env.PORTDEX_DEBUG_SESSIONS = previousDebugSessions;
    }
    fs.rmSync(homeDir, { recursive: true, force: true });
  });

  await requestCodexSessionsList();
  await requestCodexSessionsList();

  const emptyTitleLogs = capturedLogs.filter((entry) =>
    entry.includes("empty title fallback thread=thread-empty-title"),
  );
  assert.equal(emptyTitleLogs.length, 1);
});

function writeSessionMetaRollout(filePath, threadId) {
  fs.writeFileSync(
    filePath,
    [
      JSON.stringify({
        timestamp: "2026-03-31T09:00:00.000Z",
        type: "session_meta",
        payload: {
          id: threadId,
          cwd: "C:\\repo",
          originator: "Codex Desktop",
          source: "vscode",
        },
      }),
      "",
    ].join("\n"),
  );
}

function requestCodexSessionRead(sessionRef) {
  return new Promise((resolve, reject) => {
    const handled = handleCodexSessionsRequest(
      JSON.stringify({
        jsonrpc: "2.0",
        id: "test-read",
        method: "codex/sessions/read",
        params: {
          sessionRef,
        },
      }),
      (rawResponse) => {
        const parsed = JSON.parse(rawResponse);
        if (parsed.error) {
          reject(new Error(parsed.error.message));
          return;
        }
        resolve(parsed.result);
      },
    );

    if (!handled) {
      reject(new Error("Request was not handled."));
    }
  });
}

function requestCodexSessionsList() {
  return new Promise((resolve, reject) => {
    const handled = handleCodexSessionsRequest(
      JSON.stringify({
        jsonrpc: "2.0",
        id: "test-list",
        method: "codex/sessions/list",
        params: {
          limit: 10,
        },
      }),
      (rawResponse) => {
        const parsed = JSON.parse(rawResponse);
        if (parsed.error) {
          reject(new Error(parsed.error.message));
          return;
        }
        resolve(parsed.result);
      },
    );

    if (!handled) {
      reject(new Error("Request was not handled."));
    }
  });
}

function requestCodexActiveSession() {
  return new Promise((resolve, reject) => {
    const handled = handleCodexSessionsRequest(
      JSON.stringify({
        jsonrpc: "2.0",
        id: "test-active",
        method: "codex/sessions/active",
        params: {
          limit: 10,
        },
      }),
      (rawResponse) => {
        const parsed = JSON.parse(rawResponse);
        if (parsed.error) {
          reject(new Error(parsed.error.message));
          return;
        }
        resolve(parsed.result);
      },
    );

    if (!handled) {
      reject(new Error("Request was not handled."));
    }
  });
}
