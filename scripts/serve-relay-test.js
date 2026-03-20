const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { URL } = require("url");

const rootDir = path.resolve(__dirname, "..");
const htmlPath = path.join(rootDir, "relay-test.html");
const port = Number(process.env.RELAY_TEST_PORT || 8787);
const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
const sessionsRoot = path.join(codexHome, "sessions");

function collectRolloutFiles(root) {
  if (!fs.existsSync(root)) {
    return [];
  }

  const stack = [root];
  const files = [];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (entry.name.startsWith("rollout-") && entry.name.endsWith(".jsonl")) {
        const stat = fs.statSync(fullPath);
        files.push({
          fullPath,
          relativePath: path.relative(sessionsRoot, fullPath).replaceAll("\\", "/"),
          mtimeMs: stat.mtimeMs,
          size: stat.size,
        });
      }
    }
  }

  files.sort((a, b) => b.mtimeMs - a.mtimeMs || b.relativePath.localeCompare(a.relativePath));
  return files;
}

function readSessionChat(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").split("\n");
  const messages = [];
  let latestUsage = null;
  let activeTurnId = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }

    if (parsed?.type !== "event_msg") {
      continue;
    }

    const payload = parsed.payload || {};
    const eventType = readString(payload.type);

    if (eventType === "task_started") {
      activeTurnId = readString(payload.turn_id) || readString(payload.turnId) || activeTurnId;
      continue;
    }

    if (eventType === "token_count") {
      const info = payload.info || {};
      const usageRoot = info.last_token_usage || info.lastTokenUsage || info.total_token_usage || info.totalTokenUsage;
      const tokensUsed = readNumber(usageRoot?.total_tokens ?? usageRoot?.totalTokens);
      const tokenLimit = readNumber(info.model_context_window ?? info.modelContextWindow);
      if (tokensUsed > 0 && tokenLimit > 0) {
        latestUsage = { tokensUsed, tokenLimit };
      }
      continue;
    }

    if (eventType === "user_message" || eventType === "agent_message") {
      const text = readString(payload.message) || readString(payload.text);
      if (!text) {
        continue;
      }

      messages.push({
        role: eventType === "user_message" ? "user" : "assistant",
        text,
        turnId: readString(payload.turn_id) || readString(payload.turnId) || activeTurnId,
        timestamp: readString(parsed.timestamp),
      });
    }
  }

  return {
    messages,
    usage: latestUsage,
  };
}

function readString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function writeJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://localhost");

  if (url.pathname === "/" || url.pathname === "/relay-test.html") {
    if (!fs.existsSync(htmlPath)) {
      writeJson(res, 404, { ok: false, error: "relay-test.html not found" });
      return;
    }
    res.statusCode = 200;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(fs.readFileSync(htmlPath, "utf8"));
    return;
  }

  if (url.pathname === "/api/codex/sessions") {
    const files = collectRolloutFiles(sessionsRoot).slice(0, 100);
    writeJson(res, 200, {
      ok: true,
      codexHome,
      sessionsRoot,
      sessions: files.map((file, index) => ({
        id: String(index),
        relativePath: file.relativePath,
        updatedAt: new Date(file.mtimeMs).toISOString(),
        size: file.size,
      })),
    });
    return;
  }

  if (url.pathname === "/api/codex/session") {
    const id = readString(url.searchParams.get("id"));
    const files = collectRolloutFiles(sessionsRoot).slice(0, 100);
    const file = files[Number(id)];
    if (!file) {
      writeJson(res, 404, { ok: false, error: "session not found" });
      return;
    }

    const parsed = readSessionChat(file.fullPath);
    writeJson(res, 200, {
      ok: true,
      session: {
        id,
        relativePath: file.relativePath,
        updatedAt: new Date(file.mtimeMs).toISOString(),
        size: file.size,
      },
      chat: parsed.messages,
      usage: parsed.usage,
    });
    return;
  }

  writeJson(res, 404, { ok: false, error: "not found" });
});

server.listen(port, () => {
  console.log(`[relay-test] open http://127.0.0.1:${port}/relay-test.html`);
  console.log(`[relay-test] reading Codex sessions from: ${sessionsRoot}`);
});
