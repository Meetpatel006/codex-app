// FILE: bridge.js
// Purpose: Runs Codex locally, bridges relay traffic, and coordinates desktop refreshes for Codex.app.
// Layer: CLI service
// Exports: startBridge
// Depends on: ws, crypto, os, ./qr, ./codex-desktop-refresher, ./codex-transport, ./rollout-watch

const WebSocket = require("ws");
const { randomBytes } = require("crypto");
const os = require("os");
const {
  CodexDesktopRefresher,
  readBridgeConfig,
} = require("./codex-desktop-refresher");
const { createCodexTransport } = require("./codex-transport");
const { createThreadRolloutActivityWatcher } = require("./rollout-watch");
const { printQR } = require("./qr");
const { rememberActiveThread } = require("./session-state");
const { handleDesktopRequest } = require("./desktop-handler");
const { handleGitRequest } = require("./git-handler");
const { handleThreadContextRequest } = require("./thread-context-handler");
const { handleCodexSessionsRequest } = require("./codex-sessions-handler");
const { handleWorkspaceRequest } = require("./workspace-handler");
const { createNotificationsHandler } = require("./notifications-handler");
const { handleRuntimeOptionsRequest } = require("./runtime-options-handler");
const {
  createPushNotificationServiceClient,
} = require("./push-notification-service-client");
const {
  createPushNotificationTracker,
} = require("./push-notification-tracker");
const {
  loadOrCreateBridgeDeviceState,
  resolveBridgeRelaySession,
} = require("./secure-device-state");
const { createBridgeSecureTransport } = require("./secure-transport");
const { createRolloutLiveMirrorController } = require("./rollout-live-mirror");
const {
  parseRuntimeOptions,
  validateRuntimeOptions,
  normalizeRuntimeOptions,
} = require("./runtime-options");

function startBridge({
  config: explicitConfig = null,
  printPairingQr = true,
  onPairingPayload = null,
  onBridgeStatus = null,
  runtimeOptions: explicitRuntimeOptions = null,
} = {}) {
  const config = explicitConfig || readBridgeConfig();

  // Merge runtime options: CLI args > config env vars
  const rawRuntimeOptions =
    explicitRuntimeOptions ||
    parseRuntimeOptions({
      args: {},
      env: {
        PORTDEX_MODEL: config.runtimeModel,
        PORTDEX_THINKING: config.runtimeThinking,
        PORTDEX_PERMISSION: config.runtimePermission,
        PORTDEX_BRANCH: config.runtimeBranch,
        PORTDEX_TYPE: config.runtimeType,
      },
    });
  const runtimeOptions = normalizeRuntimeOptions(rawRuntimeOptions);

  // Validate runtime options against config
  validateRuntimeOptions(runtimeOptions, config);

  // Apply transport type override if specified
  const effectiveCodexEndpoint = applyTransportTypeOverride(
    config.codexEndpoint,
    runtimeOptions.type,
  );

  const relayBaseUrl = config.relayUrl.replace(/\/+$/, "");
  if (!relayBaseUrl) {
    console.error("[portdex] No relay URL configured.");
    console.error("[portdex] In a source checkout, run ./run-local-portdex.sh or set PORTDEX_RELAY.");
    process.exit(1);
  }

  let deviceState;
  try {
    deviceState = loadOrCreateBridgeDeviceState();
  } catch (error) {
    console.error(`[portdex] ${(error && error.message) || "Failed to load the saved bridge pairing state."}`);
    process.exit(1);
  }
  const relaySession = resolveBridgeRelaySession(deviceState);
  deviceState = relaySession.deviceState;
  const sessionId = relaySession.sessionId;
  const relaySessionUrl = `${relayBaseUrl}/${sessionId}`;
  const notificationSecret = randomBytes(24).toString("hex");
  const desktopRefresher = new CodexDesktopRefresher({
    enabled: config.refreshEnabled,
    debounceMs: config.refreshDebounceMs,
    refreshCommand: config.refreshCommand,
    bundleId: config.codexBundleId,
    appPath: config.codexAppPath,
    refreshVerbose: config.refreshVerbose,
  });
  const pushServiceClient = createPushNotificationServiceClient({
    baseUrl: config.pushServiceUrl,
    sessionId,
    notificationSecret,
  });
  const notificationsHandler = createNotificationsHandler({
    pushServiceClient,
  });
  const pushNotificationTracker = createPushNotificationTracker({
    sessionId,
    pushServiceClient,
    previewMaxChars: config.pushPreviewMaxChars,
  });

  // Keep the local Codex runtime alive across transient relay disconnects.
  let socket = null;
  let isShuttingDown = false;
  let reconnectAttempt = 0;
  let reconnectTimer = null;
  let lastConnectionStatus = null;
  // Always start cold and let the first initialize probe the real state.
  // Shared/remote Codex runtimes may still be warm, but in that case the
  // forwarded initialize returns "already initialized" and we switch to warm.
  let codexHandshakeState = "cold";
  const forwardedInitializeRequestIds = new Set();
  let shouldForwardNextInitialized = false;
  const secureTransport = createBridgeSecureTransport({
    sessionId,
    relayUrl: relayBaseUrl,
    deviceState,
    onTrustedPhoneUpdate(nextDeviceState) {
      deviceState = nextDeviceState;
      sendRelayRegistrationUpdate(nextDeviceState);
    },
  });
  // Keeps one stable sender identity across reconnects so buffered replay state
  // reflects what actually made it onto the current relay socket.
  function sendRelayWireMessage(wireMessage) {
    if (socket?.readyState !== WebSocket.OPEN) {
      return false;
    }

    socket.send(wireMessage);
    return true;
  }
  // Only the spawned local runtime needs rollout mirroring; a real endpoint
  // already provides the authoritative live stream for resumed threads.
  const rolloutLiveMirror = !effectiveCodexEndpoint
    ? createRolloutLiveMirrorController({
        sendApplicationResponse,
      })
    : null;
  const alwaysForwardInitialize = Boolean(effectiveCodexEndpoint);
  let contextUsageWatcher = null;
  let watchedContextUsageKey = null;

  const codex = createCodexTransport({
    endpoint: effectiveCodexEndpoint,
    env: process.env,
    logPrefix: "[portdex]",
  });
  publishBridgeStatus({
    state: "starting",
    connectionStatus: "starting",
    pid: process.pid,
    lastError: "",
  });

  codex.onError((error) => {
    publishBridgeStatus({
      state: "error",
      connectionStatus: "error",
      pid: process.pid,
      lastError: error.message,
    });
    if (config.codexEndpoint) {
      console.error(`[portdex] Failed to connect to Codex endpoint: ${config.codexEndpoint}`);
    } else {
      console.error("[portdex] Failed to start `codex app-server`.");
      console.error(`[portdex] Launch command: ${codex.describe()}`);
      console.error("[portdex] Make sure the Codex CLI is installed and that the launcher works on this OS.");
    }
    console.error(error.message);
    process.exit(1);
  });

  function clearReconnectTimer() {
    if (!reconnectTimer) {
      return;
    }

    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  // Keeps npm start output compact by emitting only high-signal connection states.
  function logConnectionStatus(status) {
    if (lastConnectionStatus === status) {
      return;
    }

    lastConnectionStatus = status;
    publishBridgeStatus({
      state: "running",
      connectionStatus: status,
      pid: process.pid,
      lastError: "",
    });
    console.log(`[portdex] ${status}`);
  }

  // Retries the relay socket while preserving the active Codex process and session id.
  function scheduleRelayReconnect(closeCode) {
    if (isShuttingDown) {
      return;
    }

    if (closeCode === 4000) {
      logConnectionStatus("disconnected");
      shutdown(codex, () => socket, () => {
        isShuttingDown = true;
        clearReconnectTimer();
      });
      return;
    }

    if (reconnectTimer) {
      return;
    }

    if (closeCode === 4001) {
      console.log("[portdex] relay replaced the previous mac socket; reconnecting...");
    }

    if (closeCode === 4002) {
      console.log("[portdex] relay session unavailable; retrying connection...");
    }

    reconnectAttempt += 1;
    // Reattach quickly after transient relay flaps so mobile pairing does not churn.
    const delayMs = Math.min(250 * 2 ** (reconnectAttempt - 1), 30_000);
    logConnectionStatus("connecting");
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectRelay();
    }, delayMs);
  }

  function connectRelay() {
    if (isShuttingDown) {
      return;
    }

    logConnectionStatus("connecting");
    const nextSocket = new WebSocket(relaySessionUrl, {
      // The relay uses this per-session secret to authenticate the first push registration.
      headers: {
        "x-role": "mac",
        "x-notification-secret": notificationSecret,
        ...buildMacRegistrationHeaders(deviceState),
      },
    });
    socket = nextSocket;

    nextSocket.on("open", () => {
      clearReconnectTimer();
      reconnectAttempt = 0;
      logConnectionStatus("connected");
      secureTransport.bindLiveSendWireMessage(sendRelayWireMessage);
      sendRelayRegistrationUpdate(deviceState, shortCode, pairingPayload);
    });

    nextSocket.on("message", (data) => {
      const message = typeof data === "string" ? data : data.toString("utf8");
      if (
        secureTransport.handleIncomingWireMessage(message, {
          sendControlMessage(controlMessage) {
            if (nextSocket.readyState === WebSocket.OPEN) {
              nextSocket.send(JSON.stringify(controlMessage));
            }
          },
          onApplicationMessage(plaintextMessage) {
            handleApplicationMessage(plaintextMessage);
          },
        })
      ) {
        return;
      }
    });

    nextSocket.on("close", (code) => {
      logConnectionStatus("disconnected");
      if (socket === nextSocket) {
        socket = null;
      }
      stopContextUsageWatcher();
      rolloutLiveMirror?.stopAll();
      desktopRefresher.handleTransportReset();
      scheduleRelayReconnect(code);
    });

    nextSocket.on("error", () => {
      logConnectionStatus("disconnected");
    });
  }

  const pairingPayload = secureTransport.createPairingPayload();
  const shortCode = pairingPayload.shortCode;
  onPairingPayload?.(pairingPayload);
  if (printPairingQr) {
    printQR(pairingPayload);
  }
  pushServiceClient.logUnavailable();
  connectRelay();

  codex.onMessage((message) => {
    trackCodexHandshakeState(message);
    desktopRefresher.handleOutbound(message);
    pushNotificationTracker.handleOutbound(message);
    rememberThreadFromMessage("codex", message);
    secureTransport.queueOutboundApplicationMessage(
      message,
      sendRelayWireMessage,
    );
  });

  codex.onClose(() => {
    logConnectionStatus("disconnected");
    publishBridgeStatus({
      state: "stopped",
      connectionStatus: "disconnected",
      pid: process.pid,
      lastError: "",
    });
    isShuttingDown = true;
    clearReconnectTimer();
    stopContextUsageWatcher();
    rolloutLiveMirror?.stopAll();
    desktopRefresher.handleTransportReset();
    if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) {
      socket.close();
    }
  });

  process.on("SIGINT", () => shutdown(codex, () => socket, () => {
    isShuttingDown = true;
    clearReconnectTimer();
  }));
  process.on("SIGTERM", () => shutdown(codex, () => socket, () => {
    isShuttingDown = true;
    clearReconnectTimer();
  }));

  // Routes decrypted app payloads through the same bridge handlers as before.
  function handleApplicationMessage(rawMessage) {
    const normalizedMessage = normalizeThreadReferenceInMessage(rawMessage);

    if (handleBridgeManagedHandshakeMessage(normalizedMessage)) {
      return;
    }
    if (
      handleThreadContextRequest(normalizedMessage, sendApplicationResponse)
    ) {
      return;
    }
    if (
      handleCodexSessionsRequest(normalizedMessage, sendApplicationResponse)
    ) {
      return;
    }
    if (handleWorkspaceRequest(normalizedMessage, sendApplicationResponse)) {
      return;
    }
    if (
      notificationsHandler.handleNotificationsRequest(
        normalizedMessage,
        sendApplicationResponse,
      )
    ) {
      return;
    }
    if (
      handleDesktopRequest(normalizedMessage, sendApplicationResponse, {
        bundleId: config.codexBundleId,
        appPath: config.codexAppPath,
      })
    ) {
      return;
    }
    if (
      handleGitRequest(normalizedMessage, sendApplicationResponse, {
        defaultBranch: runtimeOptions.branch,
      })
    ) {
      return;
    }
    if (
      handleRuntimeOptionsRequest(normalizedMessage, sendApplicationResponse, {
        runtimeOptions,
      })
    ) {
      return;
    }
    desktopRefresher.handleInbound(normalizedMessage);
    rolloutLiveMirror?.observeInbound(normalizedMessage);
    rememberThreadFromMessage("phone", normalizedMessage);

    // Inject runtime defaults for turn/start requests if not already present
    const enrichedMessage = injectRuntimeDefaults(
      normalizedMessage,
      runtimeOptions,
    );
    codex.send(enrichedMessage);
  }

  // Encrypts bridge-generated responses instead of letting the relay see plaintext.
  function sendApplicationResponse(rawMessage) {
    secureTransport.queueOutboundApplicationMessage(rawMessage, sendRelayWireMessage,);
  }

  function rememberThreadFromMessage(source, rawMessage) {
    const context = extractBridgeMessageContext(rawMessage);
    if (!context.threadId) {
      return;
    }

    rememberActiveThread(context.threadId, source);
    if (shouldStartContextUsageWatcher(context)) {
      ensureContextUsageWatcher(context);
    }
  }

  // Mirrors CodexMonitor's persisted token_count fallback so the phone keeps
  // receiving context-window usage even when the runtime omits live thread usage.
  function ensureContextUsageWatcher({ threadId, turnId }) {
    const normalizedThreadId = readString(threadId);
    const normalizedTurnId = readString(turnId);
    if (!normalizedThreadId) {
      return;
    }

    const nextWatcherKey = `${normalizedThreadId}|${normalizedTurnId || "pending-turn"}`;
    if (watchedContextUsageKey === nextWatcherKey && contextUsageWatcher) {
      return;
    }

    stopContextUsageWatcher();
    watchedContextUsageKey = nextWatcherKey;
    contextUsageWatcher = createThreadRolloutActivityWatcher({
      threadId: normalizedThreadId,
      turnId: normalizedTurnId,
      onUsage: ({ threadId: usageThreadId, usage }) => {
        sendContextUsageNotification(usageThreadId, usage);
      },
      onIdle: () => {
        if (watchedContextUsageKey === nextWatcherKey) {
          stopContextUsageWatcher();
        }
      },
      onTimeout: () => {
        if (watchedContextUsageKey === nextWatcherKey) {
          stopContextUsageWatcher();
        }
      },
      onError: () => {
        if (watchedContextUsageKey === nextWatcherKey) {
          stopContextUsageWatcher();
        }
      },
    });
  }

  function stopContextUsageWatcher() {
    if (contextUsageWatcher) {
      contextUsageWatcher.stop();
    }

    contextUsageWatcher = null;
    watchedContextUsageKey = null;
  }

  function sendContextUsageNotification(threadId, usage) {
    if (!threadId || !usage) {
      return;
    }

    sendApplicationResponse(JSON.stringify({
        method: "thread/tokenUsage/updated",
        params: {
          threadId,
          usage,
        },
      }),);
  }

  // The spawned/shared Codex app-server stays warm across phone reconnects.
  // When iPhone reconnects it sends initialize again, but forwarding that to the
  // already-initialized Codex transport only produces "Already initialized".
  function handleBridgeManagedHandshakeMessage(rawMessage) {
    let parsed = null;
    try {
      parsed = JSON.parse(rawMessage);
    } catch {
      return false;
    }

    const method = typeof parsed?.method === "string" ? parsed.method.trim() : "";
    if (!method) {
      return false;
    }

    if (method === "initialize" && parsed.id != null) {
      if (alwaysForwardInitialize || codexHandshakeState !== "warm") {
        forwardedInitializeRequestIds.add(String(parsed.id));
        shouldForwardNextInitialized = true;
        return false;
      }

      sendApplicationResponse(JSON.stringify({
          jsonrpc: "2.0",
          id: parsed.id,
          result: {
            bridgeManaged: true,
          },
        }),);
      return true;
    }

    if (method === "initialized") {
      if (shouldForwardNextInitialized) {
        shouldForwardNextInitialized = false;
        return false;
      }
      return codexHandshakeState === "warm";
    }

    return false;
  }

  // Learns whether the underlying Codex transport has already completed its own MCP handshake.
  function trackCodexHandshakeState(rawMessage) {
    let parsed = null;
    try {
      parsed = JSON.parse(rawMessage);
    } catch {
      return;
    }

    const responseId = parsed?.id;
    if (responseId == null) {
      return;
    }

    const responseKey = String(responseId);
    if (!forwardedInitializeRequestIds.has(responseKey)) {
      return;
    }

    forwardedInitializeRequestIds.delete(responseKey);

    if (parsed?.result != null) {
      codexHandshakeState = "warm";
      return;
    }

    const errorMessage = typeof parsed?.error?.message === "string"
      ? parsed.error.message.toLowerCase()
      : "";
    if (errorMessage.includes("already initialized")) {
      codexHandshakeState = "warm";
      shouldForwardNextInitialized = false;
    }
  }

  function publishBridgeStatus(status) {
    onBridgeStatus?.(status);
  }

  // Refreshes the relay's trusted-mac index after the QR bootstrap locks in a phone identity.
  function sendRelayRegistrationUpdate(
    nextDeviceState,
    shortCodeValue = null,
    pairingPayloadValue = null,
  ) {
    deviceState = nextDeviceState;
    if (socket?.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(JSON.stringify({
        kind: "relayMacRegistration",
        registration: buildMacRegistration(
          nextDeviceState,
          shortCodeValue,
          pairingPayloadValue,
        ),
      }),
    );
  }
}

// Registers the canonical Mac identity and the one trusted iPhone allowed for auto-resolve.
function buildMacRegistrationHeaders(deviceState) {
  const registration = buildMacRegistration(deviceState);
  const headers = {
    "x-mac-device-id": registration.macDeviceId,
    "x-mac-identity-public-key": registration.macIdentityPublicKey,
    "x-machine-name": registration.displayName,
  };
  if (registration.trustedPhoneDeviceId && registration.trustedPhonePublicKey) {
    headers["x-trusted-phone-device-id"] = registration.trustedPhoneDeviceId;
    headers["x-trusted-phone-public-key"] = registration.trustedPhonePublicKey;
  }
  return headers;
}

function buildMacRegistration(
  deviceState,
  shortCodeValue = null,
  pairingPayloadValue = null,
) {
  const trustedPhoneEntry =
    Object.entries(deviceState?.trustedPhones || {})[0] || null;
  const registration = {
    macDeviceId: normalizeNonEmptyString(deviceState?.macDeviceId),
    macIdentityPublicKey: normalizeNonEmptyString(
      deviceState?.macIdentityPublicKey,
    ),
    displayName: normalizeNonEmptyString(os.hostname()),
    trustedPhoneDeviceId: normalizeNonEmptyString(trustedPhoneEntry?.[0]),
    trustedPhonePublicKey: normalizeNonEmptyString(trustedPhoneEntry?.[1]),
  };

  if (shortCodeValue && pairingPayloadValue) {
    registration.shortCode = shortCodeValue;
    registration.pairingPayload = pairingPayloadValue;
  }

  return registration;
}

function shutdown(codex, getSocket, beforeExit = () => {}) {
  beforeExit();

  const socket = getSocket();
  if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) {
    socket.close();
  }

  codex.shutdown();

  setTimeout(() => process.exit(0), 100);
}

function extractBridgeMessageContext(rawMessage) {
  let parsed = null;
  try {
    parsed = JSON.parse(rawMessage);
  } catch {
    return { method: "", threadId: null, turnId: null };
  }

  const method = parsed?.method;
  const params = parsed?.params;
  const threadId = extractThreadId(method, params);
  const turnId = extractTurnId(method, params);

  return {
    method: typeof method === "string" ? method : "",
    threadId,
    turnId,
  };
}

function shouldStartContextUsageWatcher(context) {
  if (!context?.threadId) {
    return false;
  }

  return context.method === "turn/start"
    || context.method === "turn/started";
}

function extractThreadId(method, params) {
  if (method === "turn/start" || method === "turn/started") {
    return (
      readString(params?.threadId)
      || readString(params?.thread_id)
      || readString(params?.turn?.threadId)
      || readString(params?.turn?.thread_id)
    );
  }

  if (method === "thread/start" || method === "thread/started") {
    return (
      readString(params?.threadId)
      || readString(params?.thread_id)
      || readString(params?.thread?.id)
      || readString(params?.thread?.threadId)
      || readString(params?.thread?.thread_id)
    );
  }

  if (method === "thread/resume" || method === "thread/read") {
    return (
      readString(params?.threadId)
      || readString(params?.thread_id)
      || readString(params?.conversationId)
      || readString(params?.conversation_id)
      || readString(params?.thread?.id)
      || readString(params?.thread?.threadId)
      || readString(params?.thread?.thread_id)
    );
  }

  if (method === "turn/completed") {
    return (
      readString(params?.threadId)
      || readString(params?.thread_id)
      || readString(params?.turn?.threadId)
      || readString(params?.turn?.thread_id)
    );
  }

  return null;
}

function extractTurnId(method, params) {
  if (method === "turn/started" || method === "turn/completed") {
    return (
      readString(params?.turnId)
      || readString(params?.turn_id)
      || readString(params?.id)
      || readString(params?.turn?.id)
      || readString(params?.turn?.turnId)
      || readString(params?.turn?.turn_id)
    );
  }

  return null;
}

function readString(value) {
  return typeof value === "string" && value ? value : null;
}

function normalizeNonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function normalizeThreadReferenceInMessage(rawMessage) {
  let parsed = null;
  try {
    parsed = JSON.parse(rawMessage);
  } catch {
    return rawMessage;
  }

  const method = typeof parsed?.method === "string" ? parsed.method : "";
  if (!method) {
    return rawMessage;
  }

  const params = parsed?.params;
  if (!params || typeof params !== "object") {
    return rawMessage;
  }

  const threadCandidate =
    readString(params.threadId) ||
    readString(params.thread_id) ||
    readString(params.conversationId) ||
    readString(params.conversation_id);
  const normalizedThreadId = normalizeThreadReference(threadCandidate);
  if (!normalizedThreadId) {
    return rawMessage;
  }

  const nextParams = { ...params };
  let changed = false;

  for (const key of [
    "threadId",
    "thread_id",
    "conversationId",
    "conversation_id",
  ]) {
    if (readString(nextParams[key]) && nextParams[key] !== normalizedThreadId) {
      nextParams[key] = normalizedThreadId;
      changed = true;
    }
  }

  if (
    (method === "turn/start" ||
      method === "thread/resume" ||
      method === "thread/read" ||
      method === "turn/steer") &&
    !readString(nextParams.threadId)
  ) {
    nextParams.threadId = normalizedThreadId;
    changed = true;
  }

  if (!changed) {
    return rawMessage;
  }

  return JSON.stringify({
    ...parsed,
    params: nextParams,
  });
}

function normalizeThreadReference(value) {
  const normalized = readString(value);
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

// Apply transport type override: type=local forces spawn, type=cloud requires endpoint
function applyTransportTypeOverride(configEndpoint, transportType) {
  if (transportType === "local") {
    return ""; // Force spawn mode
  }
  if (transportType === "cloud") {
    if (!configEndpoint) {
      throw new Error(
        "type=cloud requires PORTDEX_CODEX_ENDPOINT to be set. " +
          "Provide a WebSocket endpoint or switch to type=local.",
      );
    }
    return configEndpoint;
  }
  return configEndpoint;
}

// Inject runtime defaults into turn/start requests if fields are missing
function injectRuntimeDefaults(rawMessage, runtimeOptions) {
  let parsed;
  try {
    parsed = JSON.parse(rawMessage);
  } catch {
    return rawMessage;
  }

  const method = typeof parsed?.method === "string" ? parsed.method : "";
  if (method !== "turn/start" && method !== "message/send") {
    return rawMessage;
  }

  const params = parsed.params || {};
  let modified = false;

  // Inject model if missing
  if (!params.model && runtimeOptions.model) {
    params.model = runtimeOptions.model;
    modified = true;
  }

  // Inject reasoning effort (thinking) if missing
  if (!params.effort && runtimeOptions.thinking) {
    params.effort = runtimeOptions.thinking;
    modified = true;
  }

  // Inject permission/collaboration mode if missing
  if (!params.collaborationMode && runtimeOptions.permission) {
    params.collaborationMode = {
      mode: runtimeOptions.permission === "full" ? "auto" : "on-request",
    };
    modified = true;
  }

  if (!modified) {
    return rawMessage;
  }

  return JSON.stringify({ ...parsed, params });
}

module.exports = {
  startBridge,
  __test: {
    injectRuntimeDefaults,
    applyTransportTypeOverride,
    extractThreadId,
  },
};
