import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import Constants from "expo-constants";
import { useRouter } from "expo-router";

import { FontFamilies } from "@/constants/fonts";
import { useSessionStore } from "@/store/session";
import { useTheme } from "@/hooks/use-theme";

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

function parsePairingPayload(raw: string) {
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

export default function PairingScanScreen() {
  const theme = useTheme();
  const router = useRouter();
  const setPairing = useSessionStore((state) => state.setPairing);
  const [permission, requestPermission] = useCameraPermissions();
  const [scannerLocked, setScannerLocked] = useState(false);

  const styles = useMemo(() => createStyles(theme), [theme]);

  const onScanned = useCallback(
    async (data: string) => {
      if (scannerLocked) return;
      setScannerLocked(true);

      try {
        const parsed = parsePairingPayload(data);
        await setPairing(parsed);
        router.replace("/");
      } catch (error) {
        Alert.alert(
          "Pairing failed",
          error instanceof Error ? error.message : "Invalid QR code",
          [
            {
              text: "Try again",
              onPress: () => setScannerLocked(false),
            },
          ],
        );
      }
    },
    [scannerLocked, setPairing, router],
  );

  const handleRequestPermission = async () => {
    const result = await requestPermission();
    if (!result.granted) {
      Alert.alert("Camera permission required", "Allow camera to scan QR.");
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.title}>Camera Permission Required</Text>
          <Text style={styles.subtitle}>
            Please allow camera access to scan QR codes
          </Text>
          <Pressable style={styles.button} onPress={handleRequestPermission}>
            <Text style={styles.buttonText}>Grant Permission</Text>
          </Pressable>
          <Pressable style={styles.closeButton} onPress={() => router.back()}>
            <Text style={styles.closeButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={({ data }) => onScanned(data)}
      />
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.header}>
          <Pressable style={styles.closeButton} onPress={() => router.back()}>
            <Text style={styles.closeButtonText}>Cancel</Text>
          </Pressable>
        </View>
        <View style={styles.guideBox}>
          <Text style={styles.guideTitle}>Scan Pairing QR</Text>
          <Text style={styles.guideText}>
            Point camera at the Codex desktop pairing QR code
          </Text>
        </View>
      </View>
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#000",
    },
    camera: {
      flex: 1,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "space-between",
      paddingTop: 60,
      paddingBottom: 40,
    },
    header: {
      paddingHorizontal: 16,
      alignItems: "flex-end",
    },
    closeButton: {
      backgroundColor: "rgba(0,0,0,0.6)",
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    closeButtonText: {
      color: "#fff",
      fontSize: 15,
      fontWeight: "600",
      fontFamily: FontFamilies.normal.ibmPlexSans,
    },
    guideBox: {
      marginHorizontal: 16,
      borderRadius: 16,
      backgroundColor: "rgba(0,0,0,0.7)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.2)",
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    guideTitle: {
      color: "#fff",
      fontSize: 17,
      fontWeight: "700",
      marginBottom: 6,
      fontFamily: FontFamilies.display.spaceGrotesk,
    },
    guideText: {
      color: "#f0f0f0",
      fontSize: 14,
      lineHeight: 20,
      fontFamily: FontFamilies.normal.ibmPlexSans,
    },
    centerContent: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      backgroundColor: theme.background,
    },
    title: {
      color: theme.text,
      fontSize: 20,
      fontWeight: "700",
      marginBottom: 8,
      fontFamily: FontFamilies.display.spaceGrotesk,
    },
    subtitle: {
      color: theme.textSecondary,
      fontSize: 14,
      textAlign: "center",
      marginBottom: 24,
      fontFamily: FontFamilies.normal.ibmPlexSans,
    },
    button: {
      borderRadius: 14,
      backgroundColor: theme.userBubble,
      paddingHorizontal: 24,
      paddingVertical: 14,
      alignItems: "center",
    },
    buttonText: {
      color: theme.userText,
      fontSize: 15,
      fontWeight: "600",
      fontFamily: FontFamilies.normal.ibmPlexSans,
    },
  });
