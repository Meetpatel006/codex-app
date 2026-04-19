// FILE: codex-transport.js
// Purpose: Abstracts the Codex-side transport so the bridge can talk to either a spawned app-server or an existing WebSocket endpoint.
// Layer: CLI helper
// Exports: createCodexTransport
// Depends on: child_process, ws

const { spawn } = require("child_process");
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

  if (process.platform === "win32") {
    return {
      command: env.ComSpec || "cmd.exe",
      args: ["/d", "/c", "codex app-server"],
      options: {
        ...sharedOptions,
        windowsHide: true,
      },
      description: "`cmd.exe /d /c codex app-server`",
    };
  }

  return {
    command: "codex",
    args: ["app-server"],
    options: sharedOptions,
    description: "`codex app-server`",
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

  if (process.platform === "win32") {
    return {
      command: env.ComSpec || "cmd.exe",
      args: ["/d", "/c", `codex app-server --listen "${endpoint}"`],
      options: {
        ...sharedOptions,
        windowsHide: true,
      },
      description: `\`cmd.exe /d /c codex app-server --listen "${endpoint}"\``,
    };
  }

  return {
    command: "codex",
    args: ["app-server", "--listen", endpoint],
    options: sharedOptions,
    description: `\`codex app-server --listen ${endpoint}\``,
  };
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

module.exports = { createCodexTransport };
