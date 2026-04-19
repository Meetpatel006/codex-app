// FILE: codex-transport.js
// Purpose: Abstracts the Codex-side transport so the bridge can talk to either a spawned app-server or an existing WebSocket endpoint.
// Layer: CLI helper
// Exports: createCodexTransport
// Depends on: child_process, ws

const { execFileSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const WebSocket = require("ws");

function createCodexTransport({
  endpoint = "",
  env = process.env,
  WebSocketImpl = WebSocket,
} = {}) {
  if (endpoint) {
    return createWebSocketTransport({
      endpoint,
      env,
      WebSocketImpl,
      autoStartEndpointServer: isDefaultLocalCodexEndpoint(endpoint),
    });
  }

  return createSpawnTransport({ env });
}

function createSpawnTransport({ env }) {
  const launch = createCodexLaunchPlan({ env });
  const codex = spawn(launch.command, launch.args, launch.options);

  let stdoutBuffer = "";
  let stderrBuffer = "";
  let didRequestShutdown = false;
  let didReportError = false;
  const listeners = createListenerBag();

  codex.on("error", (error) => {
    didReportError = true;
    listeners.emitError(error);
  });
  codex.on("close", (code, signal) => {
    if (!didRequestShutdown && !didReportError && code !== 0) {
      didReportError = true;
      listeners.emitError(createCodexCloseError({
        code,
        signal,
        stderrBuffer,
        launchDescription: launch.description,
      }));
      return;
    }

    listeners.emitClose(code, signal);
  });
  // Ignore broken-pipe shutdown noise once the child is already going away.
  codex.stdin.on("error", (error) => {
    if (didRequestShutdown && isIgnorableStdinShutdownError(error)) {
      return;
    }

    if (isIgnorableStdinShutdownError(error)) {
      return;
    }

    didReportError = true;
    listeners.emitError(error);
  });
  // Keep stderr muted during normal operation, but preserve enough output to
  // explain launch failures when the child exits before the bridge can use it.
  codex.stderr.on("data", (chunk) => {
    stderrBuffer = appendOutputBuffer(stderrBuffer, chunk.toString("utf8"));
  });

  codex.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk.toString("utf8");
    const lines = stdoutBuffer.split("\n");
    stdoutBuffer = lines.pop() || "";

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine) {
        listeners.emitMessage(trimmedLine);
      }
    }
  });

  return {
    mode: "spawn",
    describe() {
      return launch.description;
    },
    send(message) {
      if (!codex.stdin.writable || codex.stdin.destroyed || codex.stdin.writableEnded) {
        return;
      }

      codex.stdin.write(message.endsWith("\n") ? message : `${message}\n`);
    },
    onMessage(handler) {
      listeners.onMessage = handler;
    },
    onClose(handler) {
      listeners.onClose = handler;
    },
    onError(handler) {
      listeners.onError = handler;
    },
    shutdown() {
      didRequestShutdown = true;
      shutdownCodexProcess(codex);
    },
  };
}

// Builds a single, platform-aware launch path so the bridge never "guesses"
// between multiple commands and accidentally starts duplicate runtimes.
function createCodexLaunchPlan({ env }) {
  const sharedOptions = {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...env },
  };
  const codexExecutable = resolveCodexExecutable({ env });
  const codexArgs = ["app-server"];
  const codexDescription = formatCodexCommandForLog(codexExecutable, codexArgs);

  if (process.platform === "win32") {
    if (requiresCmdShell(codexExecutable)) {
      const shellCommand = joinWindowsShellCommand(codexExecutable, codexArgs);
      return {
        command: env.ComSpec || "cmd.exe",
        args: ["/d", "/c", shellCommand],
        options: {
          ...sharedOptions,
          windowsHide: true,
        },
        description: `\`cmd.exe /d /c ${shellCommand}\``,
      };
    }

    return {
      command: codexExecutable,
      args: codexArgs,
      options: {
        ...sharedOptions,
        windowsHide: true,
      },
      description: codexDescription,
    };
  }

  return {
    command: codexExecutable,
    args: codexArgs,
    options: sharedOptions,
    description: codexDescription,
  };
}

// Stops the exact process tree we launched on Windows so the shell wrapper
// does not leave a child Codex process running in the background.
function shutdownCodexProcess(codex) {
  if (codex.killed || codex.exitCode !== null) {
    return;
  }

  if (process.platform === "win32" && codex.pid) {
    const killer = spawn("taskkill", ["/pid", String(codex.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
    killer.on("error", () => {
      codex.kill();
    });
    return;
  }

  codex.kill("SIGTERM");
}

function createCodexCloseError({ code, signal, stderrBuffer, launchDescription }) {
  const details = stderrBuffer.trim();
  const reason = details || `Process exited with code ${code}${signal ? ` (signal: ${signal})` : ""}.`;
  return new Error(`Codex launcher ${launchDescription} failed: ${reason}`);
}

function appendOutputBuffer(buffer, chunk) {
  const next = `${buffer}${chunk}`;
  return next.slice(-4_096);
}

function isIgnorableStdinShutdownError(error) {
  return error?.code === "EPIPE" || error?.code === "ERR_STREAM_DESTROYED";
}

function createWebSocketTransport({
  endpoint,
  env = process.env,
  WebSocketImpl = WebSocket,
  autoStartEndpointServer = false,
}) {
  const managedServer = autoStartEndpointServer
    ? createManagedEndpointServer({ endpoint, env })
    : null;
  const socket = new WebSocketImpl(endpoint);
  const listeners = createListenerBag();
  const openState = WebSocketImpl.OPEN ?? WebSocket.OPEN ?? 1;
  const connectingState = WebSocketImpl.CONNECTING ?? WebSocket.CONNECTING ?? 0;
  let socketOpened = false;

  socket.on("open", () => {
    socketOpened = true;
  });

  socket.on("message", (chunk) => {
    const message = typeof chunk === "string" ? chunk : chunk.toString("utf8");
    if (message.trim()) {
      listeners.emitMessage(message);
    }
  });

  socket.on("close", (code, reason) => {
    const safeReason = reason ? reason.toString("utf8") : "no reason";
    listeners.emitClose(code, safeReason);
  });

  socket.on("error", (error) => listeners.emitError(error));

  if (managedServer) {
    managedServer.onError((error) => {
      if (!socketOpened) {
        listeners.emitError(error);
      }
    });
  }

  return {
    mode: "websocket",
    describe() {
      return endpoint;
    },
    send(message) {
      if (socket.readyState === openState) {
        socket.send(message);
      }
    },
    onMessage(handler) {
      listeners.onMessage = handler;
    },
    onClose(handler) {
      listeners.onClose = handler;
    },
    onError(handler) {
      listeners.onError = handler;
    },
    shutdown() {
      if (socket.readyState === openState || socket.readyState === connectingState) {
        socket.close();
      }
      managedServer?.shutdown();
    },
  };
}

function createManagedEndpointServer({ endpoint, env }) {
  const launch = createCodexListenLaunchPlan({ endpoint, env });
  const codex = spawn(launch.command, launch.args, launch.options);
  let stderrBuffer = "";
  let didRequestShutdown = false;
  const listeners = createListenerBag();

  codex.on("error", (error) => {
    listeners.emitError(error);
  });
  codex.on("close", (code, signal) => {
    if (!didRequestShutdown && code !== 0) {
      listeners.emitError(
        createCodexCloseError({
          code,
          signal,
          stderrBuffer,
          launchDescription: launch.description,
        }),
      );
    }
  });
  codex.stderr.on("data", (chunk) => {
    stderrBuffer = appendOutputBuffer(stderrBuffer, chunk.toString("utf8"));
  });

  return {
    onError(handler) {
      listeners.onError = handler;
    },
    shutdown() {
      didRequestShutdown = true;
      shutdownCodexProcess(codex);
    },
  };
}

function createCodexListenLaunchPlan({ endpoint, env }) {
  const sharedOptions = {
    stdio: ["ignore", "ignore", "pipe"],
    env: { ...env },
  };
  const codexExecutable = resolveCodexExecutable({ env });
  const codexArgs = ["app-server", "--listen", endpoint];
  const codexDescription = formatCodexCommandForLog(codexExecutable, codexArgs);

  if (process.platform === "win32") {
    if (requiresCmdShell(codexExecutable)) {
      const shellCommand = joinWindowsShellCommand(codexExecutable, codexArgs);
      return {
        command: env.ComSpec || "cmd.exe",
        args: ["/d", "/c", shellCommand],
        options: {
          ...sharedOptions,
          windowsHide: true,
        },
        description: `\`cmd.exe /d /c ${shellCommand}\``,
      };
    }

    return {
      command: codexExecutable,
      args: codexArgs,
      options: {
        ...sharedOptions,
        windowsHide: true,
      },
      description: codexDescription,
    };
  }

  return {
    command: codexExecutable,
    args: codexArgs,
    options: sharedOptions,
    description: codexDescription,
  };
}

function resolveCodexExecutable({
  env = process.env,
  fsImpl = fs,
  execFileSyncImpl = execFileSync,
} = {}) {
  const configuredPath = readNonEmptyString(env.PORTDEX_CODEX_CLI_PATH);
  if (configuredPath) {
    return configuredPath;
  }

  if (process.platform !== "win32") {
    return "codex";
  }

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

  return "codex";
}

function formatCodexCommandForLog(command, args) {
  const normalizedArgs = args.map((arg) => quoteIfNeeded(arg)).join(" ");
  return `\`${quoteIfNeeded(command)}${normalizedArgs ? ` ${normalizedArgs}` : ""}\``;
}

function requiresCmdShell(command) {
  if (process.platform !== "win32") {
    return false;
  }

  const ext = path.extname(command || "").toLowerCase();
  return ext === ".cmd" || ext === ".bat";
}

function joinWindowsShellCommand(command, args) {
  const parts = [command, ...args].map((value) => quoteIfNeeded(value));
  return parts.join(" ");
}

function stripWrappingQuotes(value) {
  const trimmed = String(value).trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\""))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function quoteIfNeeded(value) {
  const normalized = stripWrappingQuotes(value);
  return /\s/.test(normalized) ? `"${normalized}"` : normalized;
}

function readNonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
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

function isDefaultLocalCodexEndpoint(endpoint) {
  try {
    const parsed = new URL(String(endpoint).trim().replace(/^'+|'+$/g, ""));
    if (!/^wss?:$/i.test(parsed.protocol)) {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    return (host === "127.0.0.1" || host === "localhost") && parsed.port === "4501";
  } catch {
    return false;
  }
}

function createListenerBag() {
  return {
    onMessage: null,
    onClose: null,
    onError: null,
    emitMessage(message) {
      this.onMessage?.(message);
    },
    emitClose(...args) {
      this.onClose?.(...args);
    },
    emitError(error) {
      this.onError?.(error);
    },
  };
}

module.exports = {
  createCodexTransport,
  __test: {
    createCodexLaunchPlan,
    createCodexListenLaunchPlan,
    resolveCodexExecutable,
    requiresCmdShell,
    quoteIfNeeded,
  },
};
