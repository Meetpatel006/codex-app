import { Platform } from "react-native";
import Constants from "expo-constants";

export type PairingPayload = {
  relayUrl: string;
  sessionId: string;
  macDeviceId?: string;
  bridgeIdentityPublicKey: string;
  expiryMs: number;
};

function extractHostFromUrl(input: string) {
  try {
    return new URL(input).hostname;
  } catch {
    return "";
  }
}

function resolveExpoHostIp() {
  const hostUri = (Constants.expoConfig as { hostUri?: string } | null)
    ?.hostUri;
  if (typeof hostUri === "string" && hostUri.trim()) {
    const host = hostUri.split(":")[0]?.trim();
    if (host) return host;
  }

  if (typeof Constants.linkingUri === "string" && Constants.linkingUri.trim()) {
    const host = extractHostFromUrl(Constants.linkingUri);
    if (host) return host;
  }

  return "";
}

function normalizeRelayUrl(relayUrl: string) {
  const expoHostIp = resolveExpoHostIp();
  try {
    const parsed = new URL(relayUrl);
    if (
      (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") &&
      expoHostIp
    ) {
      parsed.hostname = expoHostIp;
      return parsed.toString();
    }

    if (
      Platform.OS === "android" &&
      (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost")
    ) {
      parsed.hostname = "10.0.2.2";
      return parsed.toString();
    }
  } catch {
    return relayUrl;
  }
  return relayUrl;
}

export function isShortCode(value: string) {
  return /^[A-Z0-9]{4}-?[A-Z0-9]{4}$/i.test(value.trim());
}

export async function resolveShortCode(code: string): Promise<string> {
  const normalizedCode = code.replace(/-/g, "").toUpperCase().trim();

  if (!/^[A-Z0-9]{8}$/.test(normalizedCode)) {
    throw new Error(
      "Invalid code format. Please enter an 8-character code (e.g., ABCD-EF23)",
    );
  }

  const defaultRelayUrl = "https://jalisa-unreputed-cleta.ngrok-free.dev";

  const response = await fetch(`${defaultRelayUrl}/v1/code/resolve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      shortCode: normalizedCode,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const errorMessage =
      (error as { error?: string }).error || "Failed to resolve code";

    if (response.status === 404) {
      throw new Error(
        "Code not found or expired. Please check the code and try again.",
      );
    }

    throw new Error(errorMessage);
  }

  const resolved = await response.json();
  return JSON.stringify(resolved);
}

export function parsePairingPayload(raw: string): PairingPayload {
  const trimmed = raw.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    const parsed = JSON.parse(trimmed) as {
      relay?: string;
      sessionId?: string;
      macDeviceId?: string;
      macIdentityPublicKey?: string;
      expiresAt?: number;
    };

    const relayUrl = parsed.relay?.trim() || "";
    const sessionId = parsed.sessionId?.trim() || "";
    const macDeviceId = parsed.macDeviceId?.trim() || "";
    const bridgeIdentityPublicKey = parsed.macIdentityPublicKey?.trim() || "";
    const expiryMs = Number(parsed.expiresAt);

    if (
      !relayUrl ||
      !sessionId ||
      !bridgeIdentityPublicKey ||
      !Number.isFinite(expiryMs)
    ) {
      throw new Error("Invalid QR JSON payload.");
    }

    if (expiryMs < Date.now()) {
      throw new Error("Pairing QR has expired. Please generate a new one.");
    }

    return {
      relayUrl: normalizeRelayUrl(relayUrl),
      sessionId,
      macDeviceId: macDeviceId || undefined,
      bridgeIdentityPublicKey,
      expiryMs,
    };
  }

  const [relayUrl, sessionId, bridgeIdentityPublicKey, expiryRaw] = trimmed
    .split("|")
    .map((item) => item.trim());
  const expiryMs = Number(expiryRaw);

  if (
    !relayUrl ||
    !sessionId ||
    !bridgeIdentityPublicKey ||
    !Number.isFinite(expiryMs)
  ) {
    throw new Error("Invalid pairing payload format.");
  }

  if (expiryMs < Date.now()) {
    throw new Error("Pairing QR has expired. Please generate a new one.");
  }

  return {
    relayUrl: normalizeRelayUrl(relayUrl),
    sessionId,
    bridgeIdentityPublicKey,
    expiryMs,
  };
}
