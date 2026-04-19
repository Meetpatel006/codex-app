# Portdex

Local bridge between Codex and the Portdex mobile app.

## Installation

```bash
# Run directly with npx (recommended)
npx portdex up

# Or install globally
npm install -g portdex
portdex up
```

## Commands

```bash
# Start service and print pairing QR
portdex up

# Foreground mode (no OS service manager)
portdex run

# Start background service
portdex start

# Stop background service
portdex stop

# Show service status
portdex status

# Reset bridge pairing state
portdex reset-pairing
```

## Background service by platform

- macOS: uses launchd (`com.portdex.bridge`)
- Linux: uses user systemd (`~/.config/systemd/user/com.portdex.bridge.service`)
- Windows: uses Windows Service Manager (`PortdexBridge`)

Notes:
- Linux requires `systemctl --user` to be available.
- Windows service create/start may require PowerShell or CMD as Administrator.

## Configuration

Portdex automatically loads `.env` from your current working directory (and also checks the package directory), so you can define variables there before running `portdex`:

```env
# Required: relay websocket base URL
PORTDEX_RELAY=wss://your-relay-server.com/relay

# Optional transport/runtime settings
PORTDEX_CODEX_ENDPOINT=
PORTDEX_REFRESH_ENABLED=true
PORTDEX_PUSH_SERVICE_URL=
PORTDEX_MODEL=
PORTDEX_THINKING=
PORTDEX_PERMISSION=
PORTDEX_BRANCH=
PORTDEX_TYPE=

# Optional custom state directory
PORTDEX_DEVICE_STATE_DIR=
```

If `PORTDEX_CODEX_ENDPOINT` is set to `ws://127.0.0.1:4501` (or `ws://localhost:4501`), Portdex now auto-launches `codex app-server --listen ...` for you.

## Runtime files

Portdex stores state in `~/.portdex` by default:

- `daemon-config.json`
- `pairing-session.json`
- `bridge-status.json`
- `logs/bridge.stdout.log`
- `logs/bridge.stderr.log`

## Security

- End-to-end encryption between mobile and bridge
- X25519 key exchange + AES-256-GCM session keys
- Relay server forwards encrypted envelopes only
