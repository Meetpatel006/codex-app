# Mobile App

Expo Router mobile client for Codex remote sessions.

## Telemetry

This app now wires both Sentry and PostHog into the main mobile flows:

- Sentry: startup, navigation tracing, replay, pairing/relay/chat error capture, session context, release tagging
- PostHog: screen views, pairing funnel events, relay lifecycle events, chat send events, approval actions, user identification

Telemetry uses public Expo env vars from [`.env.example`](/C:/Users/hites/Desktop/Coding/codex-app/apps/mobile/.env.example:1):

```bash
EXPO_PUBLIC_SENTRY_DSN=
EXPO_PUBLIC_POSTHOG_API_KEY=
EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

If either key is missing, that provider is skipped without crashing the app.

## Run

```bash
bun install
bun run start
```

## Verify

1. Open the app and navigate between `/` and `/pairing-scan`.
2. Submit a manual pairing code or scan flow to confirm PostHog events land.
3. Force a handled error in pairing or relay code and confirm it appears in Sentry.
4. Build a native dev/release build to verify Sentry replay and native performance features. Expo Go will not cover all Sentry native features.
