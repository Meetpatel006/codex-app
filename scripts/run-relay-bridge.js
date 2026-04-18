const { spawn, spawnSync } = require("child_process");
const http = require("http");
const net = require("net");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const useNgrok = process.argv.includes("--ngrok");
const relayPort = Number(
  process.env.PORT || process.env.REMODEX_RELAY_PORT || 9000,
);
const ngrokApiPort = Number(process.env.REMODEX_NGROK_API_PORT || 4040);

let sharedEnv = {
  ...process.env,
  PORT: String(relayPort),
  REMODEX_RELAY:
    process.env.REMODEX_RELAY || `ws://127.0.0.1:${relayPort}/relay`,
};

let relay = null;
let bridge = null;
let ngrok = null;
let ownsNgrokProcess = false;
let isShuttingDown = false;

void main();

async function main() {
  try {
    stopExistingStackProcesses();
    await waitForPortToBeFree(relayPort);

    if (useNgrok) {
      ngrok = spawnNgrok(relayPort);
      ownsNgrokProcess = true;
      const publicUrl = await waitForNgrokHttpsTunnel({
        apiPort: ngrokApiPort,
      });
      console.log("[stack] ngrok running in background");
      const relayUrl = `${publicUrl.replace(/^https:\/\//, "wss://")}/relay`;
      sharedEnv = {
        ...sharedEnv,
        REMODEX_RELAY: relayUrl,
      };
      console.log(`[stack] REMODEX_RELAY=${relayUrl}`);
    } else {
      console.log(`[stack] REMODEX_RELAY=${sharedEnv.REMODEX_RELAY}`);
    }

    relay = spawnWorkspaceScript("packages/relay", "start");
    await waitForRelayHealth({
      port: relayPort,
      relayProcess: relay,
    });
    bridge = spawnWorkspaceScript("packages/bridge", "start");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[stack] failed to start stack: ${message}`);
    shutdown("startup-error");
    process.exit(1);
  }
}

function stopExistingStackProcesses() {
  stopExistingNgrokProcesses();
  stopExistingBridgeProcesses();
  stopProcessesListeningOnPort(relayPort);
}

function stopExistingBridgeProcesses() {
  if (process.platform !== "win32") {
    return;
  }

  const psCommand = [
    "$processes = Get-CimInstance Win32_Process -Filter \"Name = 'node.exe'\" -ErrorAction SilentlyContinue;",
    "$targets = $processes | Where-Object { $_.CommandLine -match 'remodex\\.js\\s+up' };",
    "foreach ($target in $targets) { Stop-Process -Id $target.ProcessId -Force -ErrorAction SilentlyContinue }",
  ].join(" ");

  spawnSync("pwsh", ["-NoProfile", "-Command", psCommand], {
    cwd: rootDir,
    stdio: "ignore",
  });
}

function stopProcessesListeningOnPort(port) {
  if (process.platform === "win32") {
    const psCommand = [
      `$connections = Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue;`,
      "$pids = @();",
      "if ($connections) { $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique }",
      "foreach ($targetPid in $pids) { Stop-Process -Id $targetPid -Force -ErrorAction SilentlyContinue }",
    ].join(" ");
    spawnSync("pwsh", ["-NoProfile", "-Command", psCommand], {
      cwd: rootDir,
      stdio: "ignore",
    });
    return;
  }

  spawnSync("sh", ["-lc", `lsof -ti tcp:${port} | xargs -r kill -9`], {
    cwd: rootDir,
    stdio: "ignore",
  });
}

function stopExistingNgrokProcesses() {
  if (process.platform === "win32") {
    const result = spawnSync(
      "cmd.exe",
      ["/d", "/s", "/c", "taskkill /IM ngrok.exe /T /F"],
      {
        cwd: rootDir,
        stdio: "ignore",
      },
    );
    const code = Number(result.status ?? 0);
    // taskkill returns 128 when no process matched; treat it as non-fatal.
    if (code !== 0 && code !== 128) {
      console.warn(`[stack] taskkill ngrok exited with code ${code}`);
    }
    return;
  }

  const pkillResult = spawnSync("pkill", ["-f", "ngrok"], {
    cwd: rootDir,
    stdio: "ignore",
  });
  const code = Number(pkillResult.status ?? 0);
  // pkill exits 1 when no process matched; treat it as non-fatal.
  if (code !== 0 && code !== 1) {
    console.warn(`[stack] pkill ngrok exited with code ${code}`);
  }
}

function spawnWorkspaceScript(workspace, script) {
  const child =
    process.platform === "win32"
      ? spawn(
          "cmd.exe",
          ["/d", "/s", "/c", `npm run ${script} --workspace ${workspace}`],
          {
            cwd: rootDir,
            stdio: "inherit",
            env: sharedEnv,
          },
        )
      : spawn("npm", ["run", script, "--workspace", workspace], {
          cwd: rootDir,
          stdio: "inherit",
          env: sharedEnv,
        });

  child.on("exit", (code) => {
    if (!isShuttingDown) {
      const status = code == null ? "unknown" : String(code);
      console.log(`[stack] ${workspace} exited (code=${status}); shutting down stack...`);
      shutdown(`${workspace}-exit`);
      return;
    }
    if (code && code !== 0) {
      console.error(`[stack] ${workspace} exited with code ${code}`);
    }
  });

  return child;
}

async function waitForRelayHealth({
  port,
  relayProcess,
  attempts = 30,
  delayMs = 300,
}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (relayProcess && relayProcess.exitCode != null) {
      throw new Error("relay exited before becoming healthy.");
    }

    try {
      const response = await readJsonFromLocalHttp(
        `http://127.0.0.1:${port}/health`,
      );
      if (response && response.ok === true) {
        return;
      }
    } catch {
      // Relay may not be listening yet.
    }

    await wait(delayMs);
  }

  throw new Error("Timed out waiting for relay health endpoint.");
}

async function waitForPortToBeFree(port, { attempts = 20, delayMs = 250 } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const inUse = await isTcpPortInUse(port);
    if (!inUse) {
      return;
    }

    await wait(delayMs);
  }

  throw new Error(`Port ${port} is still in use after cleanup. Stop existing relay processes and retry.`);
}

function isTcpPortInUse(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (inUse) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(inUse);
    };

    socket.setTimeout(350);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, "127.0.0.1");
  });
}

function spawnNgrok(port) {
  const child = spawn("ngrok", ["http", String(port)], {
    cwd: rootDir,
    stdio: "ignore",
    windowsHide: true,
    env: process.env,
  });

  child.on("exit", (code) => {
    if (isShuttingDown) {
      return;
    }
    if (code && code !== 0) {
      console.error(`[stack] ngrok exited with code ${code}`);
    }
  });

  return child;
}

async function tryReadNgrokHttpsTunnel({ apiPort }) {
  try {
    const response = await readJsonFromLocalHttp(
      `http://127.0.0.1:${apiPort}/api/tunnels`,
    );
    const tunnels = Array.isArray(response?.tunnels) ? response.tunnels : [];
    const httpsTunnel = tunnels.find(
      (tunnel) =>
        tunnel?.proto === "https" && typeof tunnel?.public_url === "string",
    );
    return httpsTunnel?.public_url?.replace(/\/+$/, "") || "";
  } catch {
    return "";
  }
}

async function waitForNgrokHttpsTunnel({
  apiPort,
  attempts = 30,
  delayMs = 500,
}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (ngrok && ngrok.exitCode != null) {
      throw new Error("ngrok exited before a tunnel was ready.");
    }

    const publicUrl = await tryReadNgrokHttpsTunnel({ apiPort });
    if (publicUrl) {
      return publicUrl;
    }

    await wait(delayMs);
  }

  throw new Error("Timed out waiting for ngrok HTTPS tunnel.");
}

function readJsonFromLocalHttp(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      const chunks = [];
      response.on("data", (chunk) => {
        chunks.push(chunk);
      });
      response.on("end", () => {
        if (response.statusCode !== 200) {
          reject(new Error(`Unexpected status ${response.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on("error", reject);
  });
}

function wait(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`[stack] shutting down due to ${signal}...`);

  if (relay) {
    relay.kill("SIGTERM");
  }
  if (bridge) {
    bridge.kill("SIGTERM");
  }
  if (ngrok && ownsNgrokProcess) {
    ngrok.kill("SIGTERM");
  }

  setTimeout(() => {
    if (relay) {
      relay.kill("SIGKILL");
    }
    if (bridge) {
      bridge.kill("SIGKILL");
    }
    if (ngrok && ownsNgrokProcess) {
      ngrok.kill("SIGKILL");
    }
    process.exit(0);
  }, 2_000).unref?.();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
