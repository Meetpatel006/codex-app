const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const { handleCodexSessionsRequest } = require("../src/codex-sessions-handler");

test("codex/sessions handlers can read real local Codex session data", async (t) => {
  const requestedHome =
    process.env.REMODEX_REAL_CODEX_HOME ||
    process.env.CODEX_HOME ||
    path.join(os.homedir(), ".codex");

  if (!fs.existsSync(requestedHome)) {
    t.skip(`Real Codex home not found: ${requestedHome}`);
    return;
  }

  const previousCodexHome = process.env.CODEX_HOME;
  process.env.CODEX_HOME = requestedHome;
  t.after(() => {
    if (previousCodexHome == null) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = previousCodexHome;
    }
  });

  const listed = await requestRpc("codex/sessions/list", { limit: 5 });
  assert.equal(Array.isArray(listed.sessions), true);

  if (listed.sessions.length === 0) {
    t.skip(`No rollout sessions found in ${requestedHome}`);
    return;
  }

  const first = listed.sessions[0];
  const sessionRef = String(first.sessionId || first.threadId || "").trim();
  assert.ok(
    sessionRef.length > 0,
    "Expected a sessionRef from real sessions list",
  );

  const read = await requestRpc("codex/sessions/read", {
    sessionRef,
    limit: 200,
  });

  assert.equal(read.sessionRef, sessionRef);
  assert.equal(typeof read.rolloutPath, "string");
  assert.ok(read.rolloutPath.length > 0);
  assert.equal(Array.isArray(read.chat), true);
});

function requestRpc(method, params) {
  return new Promise((resolve, reject) => {
    const handled = handleCodexSessionsRequest(
      JSON.stringify({
        jsonrpc: "2.0",
        id: `real-${Date.now()}`,
        method,
        params,
      }),
      (rawResponse) => {
        const parsed = JSON.parse(rawResponse);
        if (parsed.error) {
          reject(new Error(parsed.error.message || "RPC failed"));
          return;
        }
        resolve(parsed.result);
      },
    );

    if (!handled) {
      reject(new Error(`Request not handled: ${method}`));
    }
  });
}
