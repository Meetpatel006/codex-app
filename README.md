# Codex Self-Hosted Relay Stack

This monorepo contains a personal, single-user Codex relay setup:

- Relay server in `packages/relay`
- Desktop bridge in `packages/bridge`
- Mobile app in `apps/mobile`

## Architecture

Runtime flow:

1. Mobile connects to relay over `WSS /relay/{sessionId}` with `x-role: iphone`.
2. Bridge connects to relay over `WSS /relay/{sessionId}` with `x-role: mac`.
3. Bridge runs local Codex transport and local git/workspace handlers.
4. Relay brokers transport only; it does not execute git or Codex operations.

## Current Status

Implemented in this fork:

1. Relay push endpoints are disabled (APNs paths return 404).
2. Relay keeps health endpoint and trusted-session resolve endpoint.
3. Bridge reconnect behavior now uses exponential backoff (1s, 2s, 4s, 8s, capped at 30s).
4. Bridge JSON-RPC handler responses include `jsonrpc: "2.0"` envelopes.
5. Bridge session/device persistence uses atomic write patterns.

Not enabled yet:

1. Trusted reconnect flow in mobile (phase 2).
2. APNs or push-notification integration.

## Local Run

### Relay

```sh
cd packages/relay
npm install
cp .env.example .env
npm start
```

Default relay env:

```env
PORT=9000
REMODEX_ENABLE_PUSH_SERVICE=false
REMODEX_TRUST_PROXY=false
```

### Bridge

```sh
cd packages/bridge
npm install
cp .env.example .env
npm start
```

Minimum bridge env:

```env
REMODEX_RELAY=wss://yourrelay.example.com/relay
```

## Testing

Run relay tests:

```sh
node --test ./packages/relay/server.test.js
```

Run bridge tests:

```sh
npm test --workspace packages/bridge
```

Note: some existing bridge tests are currently environment-sensitive on Windows/macOS and may fail independent of current implementation changes.
