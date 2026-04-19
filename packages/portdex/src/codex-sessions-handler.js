// FILE: codex-sessions-handler.js
// Purpose: Exposes read-only Codex rollout session metadata to mobile clients.
// Layer: Bridge handler
// Exports: handleCodexSessionsRequest
// Depends on: fs, path, ./rollout-watch

const fs = require("fs");
const path = require("path");
const { resolveSessionsRoot } = require("./rollout-watch");
const { parseApplyPatchFileChanges } = require("./file-changes");
const sessionState = require("./session-state");

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 300;
const HEAD_READ_BYTES = 512 * 1024;
const TAIL_READ_BYTES = 96 * 1024;
const loggedEmptyTitleFallbacks = new Set();

function logSessionsDebug(...args) {
  if (String(process.env.PORTDEX_DEBUG_SESSIONS || "").trim() !== "1") {
    return;
  }
  console.log(...args);
}

function handleCodexSessionsRequest(rawMessage, sendResponse) {
  let parsed;
  try {
    parsed = JSON.parse(rawMessage);
  } catch {
    return false;
  }

  const method = typeof parsed?.method === "string" ? parsed.method.trim() : "";
  if (
    method !== "codex/sessions/list" &&
    method !== "codex/sessions/read" &&
    method !== "codex/sessions/active"
  ) {
    return false;
  }

  const id = parsed.id;
  const params = parsed.params || {};

  const handler = method === "codex/sessions/read"
      ? handleCodexSessionRead(params)
      : method === "codex/sessions/active"
        ? handleCodexActiveSession(params)
        : handleCodexSessionsList(params);

  handler
    .then((result) => {
      sendResponse(JSON.stringify({
          jsonrpc: "2.0",
          id,
          result,
      }));
    })
    .catch((err) => {
      const errorCode = err.errorCode || "codex_sessions_error";
      const message = err.userMessage || err.message || "Unknown Codex sessions error";
      sendResponse(JSON.stringify({
          jsonrpc: "2.0",
          id,
          error: {
            code: -32000,
            message,
            data: { errorCode },
          },
      }));
    });

  return true;
}

async function handleCodexSessionsList(params) {
  const sessionsRoot = resolveSessionsRoot();
  const limit = normalizeLimit(params.limit);
  const files = collectRolloutFiles(sessionsRoot);
  logSessionsDebug(
    `[portdex][codex/sessions/list] root=${sessionsRoot} limit=${limit} rolloutFiles=${files.length}`,
  );

  if (files.length === 0) {
    logSessionsDebug("[portdex][codex/sessions/list] no rollout files found");
    return {
      sessions: [],
      generatedAtMs: Date.now(),
      source: sessionsRoot,
    };
  }

  const sessions = files
    .sort((lhs, rhs) => rhs.mtimeMs - lhs.mtimeMs)
    .slice(0, Math.max(limit * 3, limit))
    .map((file) => readSessionSummary(file))
    .filter(Boolean)
    .slice(0, limit);

  logSessionsDebug(
    `[portdex][codex/sessions/list] returning sessions=${sessions.length}`,
    sessions.slice(0, 3).map((session) => ({
      sessionId: session.sessionId,
      cwd: session.cwd,
      updatedAtMs: session.updatedAtMs,
    })),
  );

  return {
    sessions,
    generatedAtMs: Date.now(),
    source: sessionsRoot,
  };
}

async function handleCodexSessionRead(params) {
  const sessionsRoot = resolveSessionsRoot();
  const sessionRef = readNonEmptyString(params?.sessionRef);
  const messageLimit = normalizeReadLimit(params?.limit);

  if (!sessionRef) {
    throw createSessionReadError("invalid_request", "sessionRef is required.");
  }

  const rolloutPath = resolveSessionRolloutPath({
    sessionsRoot,
    sessionRef,
  });

  if (!rolloutPath) {
    throw createSessionReadError("session_not_found", "No rollout file found for the selected session.");
  }

  const transcript = readRolloutTranscript(rolloutPath, messageLimit);
  const selection = readSessionSelection(rolloutPath);
  return {
    sessionRef,
    rolloutPath,
    chat: transcript,
    model: selection.model,
    effort: selection.effort,
  };
}

async function handleCodexActiveSession(params) {
  const sessionsRoot = resolveSessionsRoot();
  const limit = normalizeLimit(params?.limit);
  const files = collectRolloutFiles(sessionsRoot);
  const sessions = files
    .sort((lhs, rhs) => rhs.mtimeMs - lhs.mtimeMs)
    .slice(0, Math.max(limit * 3, limit))
    .map((file) => readSessionSummary(file))
    .filter(Boolean);

  const rememberedThreadId = readRememberedThreadId();
  if (rememberedThreadId) {
    let rememberedSession = sessions.find(
      (session) =>
        normalizeThreadReference(session?.sessionId) === rememberedThreadId ||
        normalizeThreadReference(session?.threadId) === rememberedThreadId,
    );

    if (!rememberedSession) {
      const rememberedRolloutPath = resolveSessionRolloutPath({
        sessionsRoot,
        sessionRef: rememberedThreadId,
      });
      if (rememberedRolloutPath) {
        try {
          const rememberedRolloutStat = fs.statSync(rememberedRolloutPath);
          rememberedSession = readSessionSummary({
            filePath: rememberedRolloutPath,
            fileName: path.basename(rememberedRolloutPath),
            mtimeMs: rememberedRolloutStat.mtimeMs,
          });
        } catch {
          rememberedSession = null;
        }
      }
    }

    if (rememberedSession) {
      return {
        activeSessionId:
          rememberedSession.sessionId || rememberedSession.threadId,
        session: rememberedSession,
        source: "remembered",
        generatedAtMs: Date.now(),
      };
    }
  }

  const mostRecentSession = sessions[0] || null;
  if (!mostRecentSession) {
    return {
      activeSessionId: null,
      session: null,
      source: "none",
      generatedAtMs: Date.now(),
    };
  }

  return {
    activeSessionId: mostRecentSession.sessionId || mostRecentSession.threadId,
    session: mostRecentSession,
    source: "recent",
    generatedAtMs: Date.now(),
  };
}

function readSessionSelection(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch {
    return { model: "", effort: "" };
  }

  const parsed = parseJsonLines(raw);
  for (let index = parsed.length - 1; index >= 0; index -= 1) {
    const entry = parsed[index];
    if (readNonEmptyString(entry?.type) !== "turn_context") {
      continue;
    }

    const payload = entry?.payload || {};
    const model = firstNonEmpty([payload.model]);
    const effort = firstNonEmpty([
      payload.effort,
      payload.reasoning_effort,
      payload.model_reasoning_effort,
    ]);
    if (model || effort) {
      return { model, effort };
    }
  }

  return { model: "", effort: "" };
}

function collectRolloutFiles(root) {
  if (!root || !fs.existsSync(root)) {
    return [];
  }

  const stack = [root];
  const output = [];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = safeReadDir(current);

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (!entry.name.startsWith("rollout-") || !entry.name.endsWith(".jsonl")) {
        continue;
      }

      try {
        const stat = fs.statSync(fullPath);
        output.push({
          filePath: fullPath,
          fileName: entry.name,
          mtimeMs: stat.mtimeMs,
        });
      } catch {
        // Ignore files that disappear while scanning.
      }
    }
  }

  return output;
}

function readSessionSummary(file) {
  const threadIdFromName = extractThreadIdFromFileName(file.fileName);
  const head = readFileRange(file.filePath, 0, HEAD_READ_BYTES);
  const tail = readTailRange(file.filePath, TAIL_READ_BYTES);
  const parsedHead = parseJsonLines(head);
  const parsedTail = parseJsonLines(tail);

  const sessionMeta = parsedHead.find((entry) => entry?.type === "session_meta")?.payload || null;
  const sessionMetaId = readNonEmptyString(sessionMeta?.id);
  const threadId = sessionMetaId || extractThreadId(parsedHead, parsedTail) || threadIdFromName;
  const title = extractSessionTitle(parsedHead, parsedTail, threadId);
  const cwd = readNonEmptyString(sessionMeta?.cwd) || "";
  const source = readNonEmptyString(sessionMeta?.source) || "";
  const originator = readNonEmptyString(sessionMeta?.originator) || "";

  if (!threadId) {
    return null;
  }

  if (!title) {
    const fallbackKey = `${threadId}:${file.fileName}`;
    if (!loggedEmptyTitleFallbacks.has(fallbackKey)) {
      loggedEmptyTitleFallbacks.add(fallbackKey);
      logSessionsDebug(
        `[portdex][codex/sessions/list] empty title fallback thread=${threadId} file=${file.fileName}`,
      );
    }
  }

  return {
    threadId,
    sessionId: threadId,
    title,
    cwd,
    source,
    originator,
    updatedAtMs: Math.round(file.mtimeMs),
    rolloutPath: file.filePath,
  };
}

function resolveSessionRolloutPath({ sessionsRoot, sessionRef }) {
  const normalizedRef = readNonEmptyString(sessionRef);
  if (!normalizedRef) {
    return "";
  }

  if (normalizedRef.endsWith(".jsonl")) {
    const directPath = path.isAbsolute(normalizedRef)
      ? normalizedRef
      : path.join(sessionsRoot, normalizedRef);
    if (isPathWithinSessionsRoot(directPath, sessionsRoot) && fs.existsSync(directPath)) {
      return directPath;
    }
  }

  const files = collectRolloutFiles(sessionsRoot).sort((lhs, rhs) => rhs.mtimeMs - lhs.mtimeMs);
  const byFileName = files.find((file) => extractThreadIdFromFileName(file.fileName) === normalizedRef);
  if (byFileName) {
    return byFileName.filePath;
  }

  const byContains = files.find((file) => file.fileName.includes(normalizedRef));
  if (byContains) {
    return byContains.filePath;
  }

  return "";
}

function readRolloutTranscript(filePath, messageLimit) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch {
    return [];
  }

  const parsed = parseJsonLines(raw);
  const output = [];
  const commandMessagesByCallId = new Map();
  const sessionMeta = parsed.find((entry) => entry?.type === "session_meta")?.payload || {};
  const sessionCwd = readNonEmptyString(sessionMeta?.cwd);

  for (const entry of parsed) {
    const entryType = readNonEmptyString(entry?.type);
    const payload = entry?.payload || {};

    if (entryType === "event_msg") {
      const payloadType = readNonEmptyString(payload.type);
      if (payloadType === "task_started") {
        continue;
      }

      if (payloadType === "user_message" || payloadType === "agent_message") {
        const text = firstNonEmpty([payload.message, payload.text, payload.content]);
        if (!text) {
          continue;
        }

        output.push({
          id: `${payloadType}-${output.length + 1}`,
          role: payloadType === "user_message" ? "user" : "assistant",
          kind: "normal",
          text,
          timestamp: readNonEmptyString(entry.timestamp),
        });
      }
      continue;
    }

    if (entryType !== "response_item") {
      continue;
    }

    const responseType = readNonEmptyString(payload.type);
    if (responseType === "function_call") {
      const callId = firstNonEmpty([payload.call_id, payload.callId]);
      const toolName = readNonEmptyString(payload.name).toLowerCase();
      const argumentsObject = parseToolArguments(payload.arguments);

      if (toolName === "exec_command" || toolName === "shell_command") {
        const commandMessage = {
          id: callId || `command-${output.length + 1}`,
          role: "system",
          kind: "command-execution",
          text: resolveToolCommand(toolName, argumentsObject) || "Running command...",
          commandExecution: {
            command: resolveToolCommand(toolName, argumentsObject) || "Running command...",
            status: "running",
            workingDirectory: resolveToolWorkingDirectory(argumentsObject),
            output: "",
          },
          timestamp: readNonEmptyString(entry.timestamp),
        };
        output.push(commandMessage);
        if (callId) {
          commandMessagesByCallId.set(callId, commandMessage);
        }
        continue;
      }

      if (toolName === "apply_patch") {
        const patchText = firstNonEmpty([
          payload.input,
          argumentsObject.patch,
          argumentsObject.text,
        ]);
        const fileChanges = parseApplyPatchFileChanges(patchText, {
          cwd: sessionCwd,
        });

        output.push(fileChanges.length > 0
            ? {
                id: callId || `file-change-${output.length + 1}`,
                role: "system",
                kind: "file-change",
                text: "Applying file changes...",
                fileChanges,
                timestamp: readNonEmptyString(entry.timestamp),
              }
            : {
                id: callId || `background-${output.length + 1}`,
                role: "system",
                kind: "normal",
                text: "Applying patch",
                timestamp: readNonEmptyString(entry.timestamp),
            });
      }
      continue;
    }

    if (responseType === "custom_tool_call") {
      const toolName = readNonEmptyString(payload.name).toLowerCase();
      if (toolName !== "apply_patch") {
        continue;
      }

      const patchText = readNonEmptyString(payload.input);
      const fileChanges = parseApplyPatchFileChanges(patchText, {
        cwd: sessionCwd,
      });
      output.push(fileChanges.length > 0
          ? {
            id: firstNonEmpty([payload.call_id, payload.callId]) || `file-change-${output.length + 1}`,
              role: "system",
              kind: "file-change",
              text: "Applying file changes...",
              fileChanges,
              timestamp: readNonEmptyString(entry.timestamp),
            }
          : {
            id: firstNonEmpty([payload.call_id, payload.callId]) || `background-${output.length + 1}`,
              role: "system",
              kind: "normal",
              text: "Applying patch",
              timestamp: readNonEmptyString(entry.timestamp),
          });
      continue;
    }

    if (responseType !== "function_call_output") {
      continue;
    }

    const callId = firstNonEmpty([payload.call_id, payload.callId]);
    const existingMessage = callId ? commandMessagesByCallId.get(callId) : null;
    if (!existingMessage || !existingMessage.commandExecution) {
      continue;
    }

    const outputText = firstNonEmpty([payload.output, payload.text, payload.content]) || "";
    existingMessage.commandExecution.output = `${
      existingMessage.commandExecution.output || ""
    }${outputText}`;
    existingMessage.commandExecution.status = "completed";
  }

  if (output.length <= messageLimit) {
    return output;
  }

  return output.slice(output.length - messageLimit);
}

function normalizeReadLimit(rawLimit) {
  const parsed = Number.parseInt(String(rawLimit ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 250;
  }

  return Math.min(parsed, 1000);
}

function isPathWithinSessionsRoot(candidatePath, sessionsRoot) {
  const root = path.resolve(sessionsRoot);
  const resolved = path.resolve(candidatePath);
  return resolved === root || resolved.startsWith(`${root}${path.sep}`);
}

function createSessionReadError(code, message) {
  const error = new Error(message);
  error.errorCode = code;
  error.userMessage = message;
  return error;
}

function parseToolArguments(rawArguments) {
  if (typeof rawArguments !== "string" || !rawArguments.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawArguments);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function resolveToolCommand(toolName, argumentsObject) {
  if (toolName !== "exec_command" && toolName !== "shell_command") {
    return toolName;
  }

  return firstNonEmpty([
      argumentsObject.cmd,
      argumentsObject.command,
      argumentsObject.raw_command,
      argumentsObject.rawCommand,
  ]) || toolName;
}

function resolveToolWorkingDirectory(argumentsObject) {
  return firstNonEmpty([
      argumentsObject.workdir,
      argumentsObject.cwd,
      argumentsObject.working_directory,
  ]) || "";
}

function extractSessionTitle(parsedHead, parsedTail, threadId) {
  const metadataTitle = firstNonEmpty([
    parsedHead.find((entry) => entry?.type === "session_meta")?.payload?.title,
    parsedHead.find((entry) => entry?.type === "session_meta")?.payload?.sessionTitle,
    parsedHead.find((entry) => entry?.type === "session_meta")?.payload?.name,
  ]);

  if (metadataTitle) {
    return truncateSessionTitle(metadataTitle);
  }

  const firstUserMessage = findFirstUserMessage(parsedHead, parsedTail);
  if (firstUserMessage) {
    return truncateSessionTitle(firstUserMessage);
  }

  return "";
}

function findFirstUserMessage(parsedHead, parsedTail) {
  const candidates = [...parsedHead, ...parsedTail];
  const titleCandidates = [];

  for (const entry of candidates) {
    const responseItemUserMessage = extractResponseItemUserMessage(entry);
    if (responseItemUserMessage) {
      titleCandidates.push(responseItemUserMessage);
    }

    if (entry?.type !== "event_msg") {
      continue;
    }

    const payload = entry.payload || {};
    const eventType = readNonEmptyString(payload.type);
    if (eventType !== "user_message") {
      continue;
    }

    const message = firstNonEmpty([
      payload.message,
      payload.text,
      payload.content,
    ]);
    if (message) {
      titleCandidates.push(message);
    }
  }

  for (const candidate of titleCandidates) {
    const cleaned = pickMeaningfulTitleLine(candidate);
    if (cleaned) {
      return cleaned;
    }
  }

  return "";
}

function extractResponseItemUserMessage(entry) {
  if (entry?.type !== "response_item") {
    return "";
  }

  const payload = entry.payload || {};
  if (readNonEmptyString(payload.role) !== "user") {
    return "";
  }

  const content = Array.isArray(payload.content) ? payload.content : [];
  for (const item of content) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const text = firstNonEmpty([
      item.text,
      item.input,
      item.message,
      item.value,
    ]);
    if (!text) {
      continue;
    }

    const trimmed = text.trim();
    if (!trimmed || trimmed.startsWith("# AGENTS.md instructions for")) {
      continue;
    }

    return trimmed;
  }

  return "";
}

function truncateSessionTitle(value) {
  const normalized = String(value).replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  const MAX_TITLE_LENGTH = 64;
  if (normalized.length <= MAX_TITLE_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_TITLE_LENGTH - 1)}…`;
}

function pickMeaningfulTitleLine(rawText) {
  if (typeof rawText !== "string" || !rawText.trim()) {
    return "";
  }

  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (isBoilerplateTitleLine(line)) {
      continue;
    }

    if (!containsUsefulText(line)) {
      continue;
    }

    if (isLowSignalPrompt(line)) {
      continue;
    }

    return line;
  }

  return "";
}

function isBoilerplateTitleLine(line) {
  const normalized = line.trim();
  if (!normalized) {
    return true;
  }

  if (normalized.startsWith("# AGENTS.md instructions for")) {
    return true;
  }

  if (normalized.startsWith("<") && normalized.endsWith(">")) {
    return true;
  }

  if (/^<[^>]+>/.test(normalized)) {
    return true;
  }

  const lowered = normalized.toLowerCase();
  return (
    lowered.startsWith("filesystem sandboxing")
    || lowered.startsWith("the writable roots are")
    || lowered.startsWith("approved command prefixes")
    || lowered.startsWith("# collaboration mode")
  );
}

function containsUsefulText(line) {
  const withoutMarkup = line.replace(/[<>`*_#]/g, "").trim();
  return /[a-z0-9]/i.test(withoutMarkup);
}

function isLowSignalPrompt(line) {
  const normalized = line
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return true;
  }

  const lowSignalSet = new Set([
    "hi",
    "hello",
    "hey",
    "ok",
    "okay",
    "yo",
    "ping",
  ]);

  return lowSignalSet.has(normalized);
}

function extractThreadId(parsedHead, parsedTail) {
  for (const entry of parsedTail) {
    const threadId = deepFindThreadId(entry);
    if (threadId) {
      return threadId;
    }
  }

  for (const entry of parsedHead) {
    const threadId = deepFindThreadId(entry);
    if (threadId) {
      return threadId;
    }
  }

  return "";
}

function deepFindThreadId(value, depth = 0) {
  if (depth > 5 || value == null) {
    return "";
  }

  if (typeof value === "string") {
    return "";
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = deepFindThreadId(item, depth + 1);
      if (found) {
        return found;
      }
    }
    return "";
  }

  if (typeof value !== "object") {
    return "";
  }

  const candidate = firstNonEmpty([
    value.thread_id,
    value.threadId,
    value.conversation_id,
    value.conversationId,
  ]);
  if (candidate) {
    return candidate;
  }

  const objectValues = Object.values(value);
  for (const nested of objectValues) {
    const found = deepFindThreadId(nested, depth + 1);
    if (found) {
      return found;
    }
  }

  return "";
}

function firstNonEmpty(values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function readFileRange(filePath, start, length) {
  try {
    const fileHandle = fs.openSync(filePath, "r");
    try {
      const buffer = Buffer.alloc(length);
      const bytesRead = fs.readSync(fileHandle, buffer, 0, length, start);
      return buffer.toString("utf8", 0, bytesRead);
    } finally {
      fs.closeSync(fileHandle);
    }
  } catch {
    return "";
  }
}

function readTailRange(filePath, length) {
  try {
    const stat = fs.statSync(filePath);
    const start = Math.max(0, stat.size - length);
    return readFileRange(filePath, start, Math.min(length, stat.size));
  } catch {
    return "";
  }
}

function parseJsonLines(text) {
  if (!text) {
    return [];
  }

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function extractThreadIdFromFileName(fileName) {
  if (typeof fileName !== "string" || !fileName.startsWith("rollout-") || !fileName.endsWith(".jsonl")) {
    return "";
  }

  const body = fileName.slice("rollout-".length, -".jsonl".length).trim();
  if (!body) {
    return "";
  }

  const uuidMatch = body.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
  if (uuidMatch) {
    return uuidMatch[1];
  }

  return body;
}

function safeReadDir(dirPath) {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

function normalizeLimit(rawLimit) {
  const parsed = Number.parseInt(String(rawLimit ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(parsed, MAX_LIMIT);
}

function readNonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function readRememberedThreadId() {
  try {
    return normalizeThreadReference(
      sessionState.readLastActiveThread()?.threadId,
    );
  } catch {
    return "";
  }
}

function normalizeThreadReference(value) {
  const normalized = readNonEmptyString(value);
  if (!normalized) {
    return "";
  }

  const uuidSuffix = normalized.match(
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i,
  );
  if (uuidSuffix) {
    return uuidSuffix[1].toLowerCase();
  }

  return normalized;
}

module.exports = {
  handleCodexSessionsRequest,
};
