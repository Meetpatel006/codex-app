# Codex Self-Hosted Relay Stack

A personal, self-hosted relay setup for connecting mobile and desktop devices to Codex.

## Architecture

```
Mobile App ←─WSS─→ Relay Server ←─WSS─→ Desktop Bridge (Portdex)
                                   │
                                   ├── Local Codex Transport
                                   └── Local git/workspace handlers
```

- **Mobile** connects to relay over `WSS /relay/{sessionId}` with `x-role: iphone`
- **Desktop Bridge** connects to relay over `WSS /relay/{sessionId}` with `x-role: mac`
- **Relay** brokers transport only—it does not execute git or Codex operations

## Packages

| Package | Description |
| ------- | ----------- |
| `packages/relay` | WebSocket relay server |
| `packages/portdex` | Desktop bridge (Portdex) |
| `packages/ui` | Shared UI components |
| `apps/mobile` | Mobile app (Expo) |
| `apps/web` | Web application |
| `apps/docs` | Documentation site |

## Prerequisites

- Node.js 18+
- Bun (for package management)

## Setup

### Install Dependencies

```bash
bun install
```

### Environment Variables

#### Relay

```bash
cd packages/relay
cp .env.example .env
```

Default values:

```env
PORT=9000
PORTDEX_ENABLE_PUSH_SERVICE=false
PORTDEX_TRUST_PROXY=false
```

#### Desktop Bridge (Portdex)

```bash
cd packages/portdex
cp .env.example .env
```

Required:

```env
PORTDEX_RELAY=wss://yourrelay.example.com/relay
```

## Running

### Relay Server

```bash
cd packages/relay
bun start
```

### Desktop Bridge

```bash
cd packages/portdex
bun start
```

### Mobile App

```bash
cd apps/mobile
bun start
```

### All Services

```bash
bun run dev
```

## Testing

Run relay tests:

```bash
node --test ./packages/relay/server.test.js
```

Run bridge tests:

```bash
bun test packages/portdex
```

## License

See [LICENSE.md](./LICENSE.md) for details.