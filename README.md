# Codex App Monorepo

This monorepo contains the full Portdex + Codex remote stack: mobile client, relay transport, desktop bridge CLI, web/docs apps, and shared workspace packages.

## What This Repo Actually Does

It enables a phone client to connect to a desktop Codex runtime through a relay:

```text
Mobile App (Expo)  <--WSS-->  Relay Server  <--WSS-->  Portdex Bridge (desktop)
                                                     |
                                                     +--> Local Codex app-server
                                                     +--> Local git/workspace operations
```

- The **phone app** pairs to a desktop session and sends/receives session traffic.
- The **relay** is a transport/broker layer and live-session resolver.
- The **desktop bridge** (Portdex) runs locally and performs actual Codex/workspace/git work on the user machine.
- After secure handshake, app payloads are encrypted end-to-end between phone and bridge.

## Monorepo Layout

### Applications

- `apps/mobile` - Expo Router mobile app for pairing + remote sessions.
- `apps/web` - Next.js app (dev default `http://localhost:3000`).
- `apps/docs` - Next.js docs app (dev default `http://localhost:3001`).

### Packages (Libraries/Services)

- `packages/relay` - Node WebSocket relay + trusted resolve/push routes.
- `packages/portdex` - Desktop bridge CLI (`portdex`) + daemon/service helpers.
- `packages/ui` - Shared React UI components.
- `packages/eslint-config` - Shared ESLint config package.
- `packages/typescript-config` - Shared TypeScript config package.

### Root Scripts

- `scripts/run-relay-bridge.js` - starts relay stack, can auto-create ngrok tunnel, waits for relay health.
- `scripts/serve-relay-test.js` - serves `relay-test.html` and local APIs to inspect Codex rollout sessions.

## Stack and Tooling

- **Package manager:** Bun (`bun.lock`, root `packageManager: bun@1.3.4`)
- **Monorepo runner:** Turborepo
- **Node runtime:** `>=18`
- **Mobile:** Expo 55, React Native, Expo Router
- **Web/docs:** Next.js 16, React 19
- **Bridge/relay runtime:** Node + WebSocket (`ws`)

## Prerequisites

- Node.js 18+
- Bun 1.3.4+ (recommended to match lockfile)
- ngrok (optional, only for public-tunnel local stack usage)
- Codex CLI available on desktop for bridge runtime flows

## Installation

```bash
bun install
```

## Root Command Reference

```bash
# workspace-wide via turbo
npm run dev
npm run build
npm run lint
npm run format
npm run check-types

# helper scripts
npm run run:stack
npm run serve:relay-test
npm run test:bridge:windows
```

## Workspace Script Matrix

| Workspace | Scripts |
| --- | --- |
| root | `dev`, `build`, `lint`, `format`, `check-types`, `run:stack`, `serve:relay-test`, `test:bridge:windows` |
| apps/mobile | `start`, `reset-project`, `android`, `ios`, `web`, `lint`, `typecheck` |
| apps/web | `dev`, `build`, `start`, `lint`, `check-types` |
| apps/docs | `dev`, `build`, `start`, `lint`, `check-types` |
| packages/relay | `start`, `test` |
| packages/portdex | `build`, `start`, `up`, `run`, `stop`, `status`, `test`, `prepack`, `postpack` |
| packages/ui | `lint`, `generate:component`, `check-types` |

## Port and Endpoint Map

| Item | Default | Source |
| --- | --- | --- |
| Relay HTTP/WS server | `9000` | `PORT` in `packages/relay/.env.example` |
| Relay WS path | `/relay/{sessionId}` | relay protocol |
| Web app dev server | `3000` | `apps/web/package.json` |
| Docs app dev server | `3001` | `apps/docs/package.json` |
| Relay test server | `8787` | `RELAY_TEST_PORT` in `scripts/serve-relay-test.js` |
| ngrok local API | `4040` | `PORTDEX_NGROK_API_PORT` in `scripts/run-relay-bridge.js` |
| Codex endpoint commonly used by bridge | `ws://127.0.0.1:4501` | `packages/portdex/.env.example` |

## Local Development Flows

### 1. Run apps only (UI development)

```bash
npm run dev
```

Runs all workspace `dev` tasks under turbo.

### 2. Run relay only

```bash
cd packages/relay
npm run start
```

Relay provides:

- `GET /health`
- `POST /v1/trusted/session/resolve`
- optional push routes:
  - `POST /v1/push/session/register-device`
  - `POST /v1/push/session/notify-completion`

### 3. Run bridge only

```bash
cd packages/portdex
npm run build
npm run up
```

`up` starts service flow and prints pairing QR.  
`run` runs foreground mode (no OS service manager).

### 4. Run local stack helper (relay + bridge + optional ngrok)

```bash
npm run run:stack
```

The helper:

- clears stale listeners on relay port,
- optionally starts ngrok (`--ngrok` is already used by root script),
- waits for relay `GET /health`,
- then starts workspace scripts.

## Environment Variables

### Relay (`packages/relay`)

Base env:

```env
PORT=9000
PORTDEX_ENABLE_PUSH_SERVICE=false
PORTDEX_TRUST_PROXY=false
```

Additional push-related envs used in relay code:

- `PORTDEX_APNS_TEAM_ID`
- `PORTDEX_APNS_KEY_ID`
- `PORTDEX_APNS_BUNDLE_ID`
- `PORTDEX_APNS_PRIVATE_KEY` or `PORTDEX_APNS_PRIVATE_KEY_FILE`
- `PORTDEX_PUSH_STATE_FILE`

### Portdex Bridge (`packages/portdex`)

From `.env.example`:

```env
PORTDEX_RELAY=wss://example.com/relay
PORTDEX_CODEX_ENDPOINT=ws://127.0.0.1:4501
PORTDEX_REFRESH_ENABLED=true
PORTDEX_PUSH_SERVICE_URL=
PORTDEX_MODEL=
PORTDEX_THINKING=
PORTDEX_PERMISSION=
PORTDEX_BRANCH=
PORTDEX_TYPE=
```

Additional bridge envs used in source/tests:

- `PORTDEX_DEVICE_STATE_DIR`
- `PORTDEX_DEVICE_STATE_FILE`
- `PORTDEX_DEVICE_STATE_KEYCHAIN_MOCK_FILE`
- `PORTDEX_DEBUG_SESSIONS`
- `PORTDEX_DEBUG_SECURE`
- `CODEX_HOME`

### Mobile App (`apps/mobile`)

From `.env.example`:

```env
EXPO_PUBLIC_SENTRY_DSN=
EXPO_PUBLIC_POSTHOG_API_KEY=
EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

Behavior:

- if `EXPO_PUBLIC_SENTRY_DSN` missing -> Sentry telemetry is skipped
- if `EXPO_PUBLIC_POSTHOG_API_KEY` missing -> PostHog telemetry is skipped

## Protocol Details (Relay)

- Required WS header: `x-role: mac` or `x-role: iphone`
- WS route: `/relay/{sessionId}`
- Close codes:
  - `4000` invalid session or role
  - `4001` previous Mac connection replaced
  - `4002` session unavailable / Mac disconnected
  - `4003` previous iPhone connection replaced

Security model summary:

- Relay is not the trusted execution environment for Codex operations.
- Relay can observe metadata + control channel during setup.
- End-to-end encrypted payload transport is between phone and bridge after key exchange.

## Testing

Root/workspace tests currently available:

```bash
# relay tests
cd packages/relay
npm run test

# bridge tests
cd packages/portdex
npm run test
```

Root also exposes:

```bash
npm run test:bridge:windows
```

## Troubleshooting Quick Notes

- If relay cannot start on port 9000, check existing listeners or set `PORT`.
- If pairing cannot connect, verify bridge `PORTDEX_RELAY` points to relay `/relay` base.
- If mobile telemetry is expected but missing, verify Expo public env keys are present.
- If using reverse proxy in front of relay, only enable `PORTDEX_TRUST_PROXY=true` with sanitized forwarding headers.
- If using push features, keep `PORTDEX_ENABLE_PUSH_SERVICE=false` until APNs env is fully configured.

## Related Package Documentation

- Relay: [`packages/relay/README.md`](./packages/relay/README.md)
- Portdex bridge: [`packages/portdex/README.md`](./packages/portdex/README.md)
- Mobile app: [`apps/mobile/README.md`](./apps/mobile/README.md)

## License

See [LICENSE.md](./LICENSE.md) for licensing terms.
