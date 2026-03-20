const { spawn } = require("child_process");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const sharedEnv = {
  ...process.env,
  REMODEX_RELAY: process.env.REMODEX_RELAY || "ws://127.0.0.1:9000/relay",
};

function spawnWorkspaceScript(workspace, script) {
  const child = process.platform === "win32"
    ? spawn(
      "cmd.exe",
      ["/d", "/s", "/c", `npm run ${script} --workspace ${workspace}`],
      {
        cwd: rootDir,
        stdio: "inherit",
        env: sharedEnv,
      }
    )
    : spawn("npm", ["run", script, "--workspace", workspace], {
      cwd: rootDir,
      stdio: "inherit",
      env: sharedEnv,
    });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[stack] ${workspace} exited with code ${code}`);
    }
  });

  return child;
}

const relay = spawnWorkspaceScript("packages/relay", "start");
const bridge = spawnWorkspaceScript("packages/bridge", "start");

let isShuttingDown = false;

function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`[stack] shutting down due to ${signal}...`);

  relay.kill("SIGTERM");
  bridge.kill("SIGTERM");

  setTimeout(() => {
    relay.kill("SIGKILL");
    bridge.kill("SIGKILL");
    process.exit(0);
  }, 2_000).unref?.();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
