import Constants from "expo-constants";
import React, { useEffect, useMemo, useState } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useSessionStore } from "@/store/session";
import { useTheme } from "@/hooks/use-theme";

type PairDeviceViewProps = {
  onPaired?: () => void;
};

function extractHostFromUrl(input: string) {
  try {
    return new URL(input).hostname;
  } catch {
    return "";
  }
}

function resolveExpoHostIp(input: string) {
  const directHost = extractHostFromUrl(input.trim());
  if (directHost) {
    return directHost;
  }

  const hostUri = (Constants.expoConfig as { hostUri?: string } | null)
    ?.hostUri;
  if (typeof hostUri === "string" && hostUri.trim()) {
    const host = hostUri.split(":")[0]?.trim();
    if (host) {
      return host;
    }
  }

  if (typeof Constants.linkingUri === "string" && Constants.linkingUri.trim()) {
    const host = extractHostFromUrl(Constants.linkingUri);
    if (host) {
      return host;
    }
  }

  return "";
}

function normalizeRelayUrl(relayUrl: string, sourceInput: string) {
  const expoHostIp = resolveExpoHostIp(sourceInput);

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
      relayUrl: normalizeRelayUrl(relayUrl, raw),
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
    relayUrl: normalizeRelayUrl(relayUrl, raw),
    sessionId,
    bridgeIdentityPublicKey,
    expiryMs,
  };
}

export function PairDeviceView({ onPaired }: PairDeviceViewProps) {
  const colors = useTheme();
  const themedStyles = useMemo(() => createStyles(colors), [colors]);

  const pairing = useSessionStore((state) => state.pairing);
  const setPairing = useSessionStore((state) => state.setPairing);
  const [payload, setPayload] = useState("");
  const [relayUrlInput, setRelayUrlInput] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerLocked, setScannerLocked] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (pairing?.relayUrl) {
      setRelayUrlInput(pairing.relayUrl);
    }
  }, [pairing?.relayUrl]);

  async function onPair() {
    try {
      const trimmedPayload = payload.trim();
      if (
        trimmedPayload.startsWith("exp://") ||
        trimmedPayload.startsWith("exps://")
      ) {
        if (!pairing) {
          throw new Error(
            "Paste full QR payload first. Expo URL host-only update needs existing pairing.",
          );
        }

        const host = resolveExpoHostIp(trimmedPayload);
        if (!host) {
          throw new Error("Could not read host from Expo URL.");
        }

        const relayUrl = normalizeRelayUrl(
          `ws://${host}:9000/relay`,
          trimmedPayload,
        );
        await setPairing({
          ...pairing,
          relayUrl,
        });
        onPaired?.();
        return;
      }

      const parsed = parsePairingPayload(payload);
      await setPairing(parsed);
      onPaired?.();
    } catch (error) {
      Alert.alert(
        "Pairing failed",
        error instanceof Error ? error.message : "Invalid payload",
      );
    }
  }

  async function onSaveRelayUrl() {
    try {
      if (!pairing) {
        throw new Error("Save pairing first, then update URL.");
      }

      const normalizedRelayUrl = normalizeRelayUrl(
        relayUrlInput.trim(),
        relayUrlInput,
      );
      if (!normalizedRelayUrl) {
        throw new Error("Relay URL is required.");
      }

      void new URL(normalizedRelayUrl);

      await setPairing({
        ...pairing,
        relayUrl: normalizedRelayUrl,
      });
      Alert.alert("Pairing updated", "Relay URL saved.");
    } catch (error) {
      Alert.alert(
        "Invalid relay URL",
        error instanceof Error ? error.message : "Invalid relay URL",
      );
    }
  }

  async function openScanner() {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert("Camera permission required", "Allow camera to scan QR.");
        return;
      }
    }

    setScannerLocked(false);
    setScannerOpen(true);
  }

  function onScanned(data: string) {
    if (scannerLocked) {
      return;
    }
    setScannerLocked(true);
    setScannerOpen(false);
    setPayload(data);

    setTimeout(() => {
      void onPair();
    }, 100);
  }

  return (
    <View style={themedStyles.container}>
      <Text style={themedStyles.title}>Pair Device</Text>
      <Text style={themedStyles.copy}>
        Paste bridge QR JSON payload (or legacy
        relayUrl|sessionId|bridgePublicKey|expiryMs)
      </Text>
      <Text style={themedStyles.copy}>
        Tip: You can paste exp://IP:8081 to auto-update relay host to
        ws://IP:9000/relay.
      </Text>
      <TextInput
        value={payload}
        onChangeText={setPayload}
        style={themedStyles.input}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        placeholder='{"v":2,"relay":"ws://10.0.2.2:9000/relay","sessionId":"...","macIdentityPublicKey":"...","expiresAt":1735000000000}'
        placeholderTextColor={colors.textSecondary}
      />
      <Pressable style={themedStyles.scanButton} onPress={() => void openScanner()}>
        <Text style={themedStyles.buttonText}>Scan QR with Camera</Text>
      </Pressable>
      <Text style={themedStyles.copy}>Or set relay URL directly:</Text>
      <TextInput
        value={relayUrlInput}
        onChangeText={setRelayUrlInput}
        style={themedStyles.urlInput}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="ws://10.31.235.240:9000/relay"
        placeholderTextColor={colors.textSecondary}
      />
      <Pressable style={themedStyles.button} onPress={() => void onPair()}>
        <Text style={themedStyles.buttonText}>Save Pairing</Text>
      </Pressable>
      <Pressable
        style={themedStyles.secondaryButton}
        onPress={() => void onSaveRelayUrl()}
      >
        <Text style={themedStyles.buttonText}>Save URL Only</Text>
      </Pressable>

      <Modal
        visible={scannerOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setScannerOpen(false)}
      >
        <View style={themedStyles.scannerContainer}>
          <CameraView
            style={themedStyles.camera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ["qr", "aztec", "pdf417", "code128", "code39"],
            }}
            onBarcodeScanned={({ data }) => onScanned(data)}
          />
          <View style={themedStyles.scannerOverlay} pointerEvents="box-none">
            <View style={themedStyles.scannerHeader}>
              <Pressable
                style={themedStyles.scannerCloseButton}
                onPress={() => setScannerOpen(false)}
              >
                <Text style={themedStyles.buttonText}>Close</Text>
              </Pressable>
            </View>
            <View style={themedStyles.scannerGuideBox}>
              <Text style={themedStyles.scannerGuideTitle}>Scan Pairing QR</Text>
              <Text style={themedStyles.scannerGuideText}>
                Point camera at desktop pairing QR. It will auto-save.
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 16,
      gap: 12,
    },
    title: {
      color: colors.text,
      fontSize: 24,
      fontWeight: "700",
      marginBottom: 8,
    },
    copy: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    input: {
      minHeight: 140,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.backgroundSelected,
      color: colors.text,
      padding: 14,
      backgroundColor: colors.backgroundElement,
      fontSize: 14,
    },
    urlInput: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.backgroundSelected,
      color: colors.text,
      padding: 14,
      backgroundColor: colors.backgroundElement,
      fontSize: 14,
    },
    button: {
      borderRadius: 14,
      backgroundColor: colors.successColor,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 8,
    },
    scanButton: {
      borderRadius: 14,
      backgroundColor: colors.userBubble,
      paddingVertical: 14,
      alignItems: "center",
      marginVertical: 4,
    },
    secondaryButton: {
      borderRadius: 14,
      backgroundColor: colors.backgroundSelected,
      paddingVertical: 14,
      alignItems: "center",
    },
    buttonText: {
      color: colors.userText,
      fontWeight: "700",
      fontSize: 15,
    },
    scannerContainer: {
      flex: 1,
      backgroundColor: "#000",
    },
    camera: {
      flex: 1,
    },
    scannerOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "space-between",
      paddingTop: 52,
      paddingBottom: 36,
    },
    scannerHeader: {
      paddingHorizontal: 16,
      alignItems: "flex-end",
    },
    scannerCloseButton: {
      backgroundColor: "rgba(0,0,0,0.6)",
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    scannerGuideBox: {
      marginHorizontal: 16,
      borderRadius: 16,
      backgroundColor: "rgba(0,0,0,0.7)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.2)",
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    scannerGuideTitle: {
      color: "#fff",
      fontSize: 17,
      fontWeight: "700",
      marginBottom: 6,
    },
    scannerGuideText: {
      color: "#f0f0f0",
      fontSize: 14,
      lineHeight: 20,
    },
  });

