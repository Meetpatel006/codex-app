import { isRunningInExpoGo } from "expo";
import * as Application from "expo-application";
import * as Sentry from "@sentry/react-native";
import { PostHog, type PostHogOptions } from "posthog-react-native";
import { Platform } from "react-native";

type TelemetryContext = {
  pairingStatus?: string | null;
  pairingSessionId?: string | null;
  activeProjectId?: string | null;
  activeProjectName?: string | null;
  activeSessionId?: string | null;
};

type TelemetryEventProperties = Record<string, string | number | boolean | null>;

const SENTRY_DSN = String(process.env.EXPO_PUBLIC_SENTRY_DSN || "").trim();
const POSTHOG_API_KEY = String(
  process.env.EXPO_PUBLIC_POSTHOG_API_KEY || "",
).trim();
const POSTHOG_HOST = String(
  process.env.EXPO_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
).trim();
const APP_VERSION =
  Application.nativeApplicationVersion || "unknown";
const APP_BUILD = Application.nativeBuildVersion || "unknown";
const APP_RUNTIME = isRunningInExpoGo() ? "expo-go" : "native";

let telemetryInitialized = false;
let posthogClient: PostHog | null = null;

const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: !isRunningInExpoGo(),
});

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === "string" ? error : "Unknown telemetry error");
}

function sanitizeProperties(properties?: TelemetryEventProperties) {
  return Object.fromEntries(
    Object.entries(properties || {}).filter(([, value]) => value !== undefined),
  );
}

export const telemetryConfig = {
  sentryEnabled: SENTRY_DSN.length > 0,
  posthogEnabled: POSTHOG_API_KEY.length > 0,
  sentryDsn: SENTRY_DSN,
  posthogHost: POSTHOG_HOST,
};

export function getSentryNavigationIntegration() {
  return navigationIntegration;
}

export function getPostHogClient() {
  return posthogClient;
}

export function initTelemetry() {
  if (telemetryInitialized) {
    return;
  }

  telemetryInitialized = true;

  if (telemetryConfig.sentryEnabled) {
    Sentry.init({
      dsn: SENTRY_DSN,
      tracesSampleRate: __DEV__ ? 1.0 : 0.2,
      profilesSampleRate: 1.0,
      replaysOnErrorSampleRate: 1.0,
      replaysSessionSampleRate: __DEV__ ? 1.0 : 0.1,
      enableLogs: true,
      sendDefaultPii: false,
      integrations: [
        navigationIntegration,
        Sentry.mobileReplayIntegration({
          maskAllText: true,
          maskAllImages: true,
        }),
      ],
      enableNativeFramesTracking: !isRunningInExpoGo(),
      environment: __DEV__ ? "development" : "production",
      release: `mobile@${APP_VERSION}+${APP_BUILD}`,
      dist: APP_BUILD,
    });
  } else {
    console.warn(
      "[mobile][telemetry] Sentry disabled because EXPO_PUBLIC_SENTRY_DSN is missing.",
    );
  }

  if (telemetryConfig.posthogEnabled) {
    const options: PostHogOptions = {
      host: POSTHOG_HOST,
      captureAppLifecycleEvents: true,
      persistence: "file",
    };
    posthogClient = new PostHog(POSTHOG_API_KEY, options);
    posthogClient.register({
      app_platform: Platform.OS,
      app_runtime: APP_RUNTIME,
      app_version: APP_VERSION,
      app_build: APP_BUILD,
    });
  } else {
    console.warn(
      "[mobile][telemetry] PostHog disabled because EXPO_PUBLIC_POSTHOG_API_KEY is missing.",
    );
  }
}

export function identifyTelemetryUser(params: {
  publicKeyHex?: string | null;
  pairingSessionId?: string | null;
}) {
  const publicKeyHex = String(params.publicKeyHex || "").trim().toLowerCase();
  if (!publicKeyHex) {
    return;
  }

  const distinctId = `mobile:${publicKeyHex.slice(0, 24)}`;
  const userProperties = {
    mobile_identity_prefix: publicKeyHex.slice(0, 16),
    app_platform: Platform.OS,
    app_runtime: APP_RUNTIME,
    app_version: APP_VERSION,
    app_build: APP_BUILD,
    has_pairing_session: Boolean(params.pairingSessionId),
  };

  Sentry.setUser({
    id: distinctId,
  });
  Sentry.setTag("mobile_identity_prefix", publicKeyHex.slice(0, 16));
  Sentry.setTag("app_runtime", APP_RUNTIME);
  Sentry.setTag("app_platform", Platform.OS);

  posthogClient?.identify(distinctId, {
    $set: userProperties,
  });
}

export function setTelemetryContext(context: TelemetryContext) {
  const sanitized = sanitizeProperties({
    pairing_status: context.pairingStatus || null,
    pairing_session_id: context.pairingSessionId || null,
    active_project_id: context.activeProjectId || null,
    active_project_name: context.activeProjectName || null,
    active_session_id: context.activeSessionId || null,
  });

  Sentry.setTag("pairing_status", context.pairingStatus || "none");
  Sentry.setTag("active_project_id", context.activeProjectId || "none");
  Sentry.setTag("active_session_id", context.activeSessionId || "none");
  Sentry.setContext("mobile_context", sanitized);

  posthogClient?.register(sanitized);
}

export function trackTelemetryEvent(
  event: string,
  properties?: TelemetryEventProperties,
) {
  const sanitized = sanitizeProperties(properties);
  Sentry.addBreadcrumb({
    category: "app.lifecycle",
    message: event,
    level: "info",
    data: sanitized,
  });
  posthogClient?.capture(event, sanitized);
}

export function trackScreen(
  screenName: string,
  properties?: TelemetryEventProperties,
) {
  const sanitized = sanitizeProperties(properties);
  Sentry.addBreadcrumb({
    category: "navigation",
    message: screenName,
    level: "info",
    data: sanitized,
  });
  posthogClient?.screen(screenName, sanitized).catch(() => {});
}

export function captureTelemetryError(
  error: unknown,
  context?: {
    area: string;
    properties?: TelemetryEventProperties;
  },
) {
  const normalized = normalizeError(error);
  const sanitized = sanitizeProperties({
    area: context?.area || "unknown",
    ...(context?.properties || {}),
  });

  Sentry.withScope((scope) => {
    scope.setLevel("error");
    scope.setTag("error_area", String(sanitized.area || "unknown"));
    scope.setContext("telemetry_error", sanitized);
    Sentry.captureException(normalized);
  });

  posthogClient?.captureException(normalized, sanitized);
}
