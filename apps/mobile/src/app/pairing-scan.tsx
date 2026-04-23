import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";

import { FontFamilies } from "@/constants/fonts";
import { trackTelemetryEvent } from "@/services/telemetry";
import { useSessionStore } from "@/store/session";
import { useTheme } from "@/hooks/use-theme";
import {
  isShortCode,
  parsePairingPayload,
  resolveShortCode,
} from "@/utils/pairing";

function navigateBackToPairing(router: ReturnType<typeof useRouter>) {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace("/");
}

export default function PairingScanScreen() {
  const theme = useTheme();
  const router = useRouter();
  const startPairing = useSessionStore((state) => state.startPairing);
  const markPairingFailed = useSessionStore((state) => state.markPairingFailed);
  const resetPairingFlow = useSessionStore((state) => state.resetPairingFlow);
  const [permission, requestPermission] = useCameraPermissions();
  const [scannerLocked, setScannerLocked] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [isCodeInputFocused, setIsCodeInputFocused] = useState(false);
  const [showCursor, setShowCursor] = useState(true);
  const codeInputRef = useRef<TextInput>(null);
  const [isManualProcessing, setIsManualProcessing] = useState(false);

  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    if (isCodeInputFocused) {
      const interval = setInterval(() => {
        setShowCursor((prev) => !prev);
      }, 500);
      return () => {
        clearInterval(interval);
        setShowCursor(true);
      };
    } else {
      setShowCursor(true);
    }
  }, [isCodeInputFocused]);

  const handleManualSubmit = async () => {
    if (!manualCode.trim() || isManualProcessing) return;

    Keyboard.dismiss();
    setIsManualProcessing(true);
    const usedShortCode = isShortCode(manualCode.trim());

    try {
      const trimmedCode = manualCode.trim();
      const payload = isShortCode(trimmedCode)
        ? await resolveShortCode(trimmedCode)
        : trimmedCode;

      const parsed = parsePairingPayload(payload);
      await startPairing(parsed);
      trackTelemetryEvent("pairing_manual_code_submitted", {
        used_short_code: usedShortCode,
        success: true,
      });
      router.replace("/");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to connect";
      const isExpired = message.toLowerCase().includes("expired");

      if (isExpired) {
        markPairingFailed(message, { expired: true });
        router.replace("/");
        return;
      }

      Alert.alert("Connection failed", message);

      trackTelemetryEvent("pairing_manual_code_submitted", {
        used_short_code: usedShortCode,
        success: false,
        expired: isExpired,
      });
    } finally {
      setIsManualProcessing(false);
    }
  };

  const handleManualCodeChange = (value: string) => {
    const normalized = value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8);
    setManualCode(normalized);
  };

  const codeChars = Array.from(
    { length: 8 },
    (_, index) => manualCode[index] || "",
  );

  const getLeftCodeDisplay = () => {
    const chars = codeChars.slice(0, 4).map((char) => (char ? char : "_"));
    const cursorPos = Math.min(manualCode.length, 4);
    if (isCodeInputFocused && showCursor && cursorPos >= 0 && cursorPos < 4) {
      chars[cursorPos] = "|";
    }
    return chars.join(" ");
  };

  const getRightCodeDisplay = () => {
    const chars = codeChars.slice(4).map((char) => (char ? char : "_"));
    const cursorPos = Math.max(0, manualCode.length - 4);
    if (
      isCodeInputFocused &&
      showCursor &&
      manualCode.length >= 4 &&
      cursorPos < 4
    ) {
      chars[cursorPos] = "|";
    }
    return chars.join(" ");
  };

  const leftCode = getLeftCodeDisplay();
  const rightCode = getRightCodeDisplay();

  const onScanned = useCallback(
    async (data: string) => {
      if (scannerLocked || isProcessing) return;
      setScannerLocked(true);
      setIsProcessing(true);

      try {
        const parsed = parsePairingPayload(data);
        await startPairing(parsed);
        trackTelemetryEvent("pairing_qr_scanned", {
          success: true,
        });
        router.replace("/");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Invalid QR code";
        const isExpired = message.toLowerCase().includes("expired");
        trackTelemetryEvent("pairing_qr_scanned", {
          success: false,
          expired: isExpired,
        });
        if (isExpired) {
          markPairingFailed(message, { expired: true });
          router.replace("/");
          return;
        }

        Alert.alert("Pairing failed", message, [
          {
            text: "Try again",
            onPress: () => {
              setScannerLocked(false);
              setIsProcessing(false);
            },
          },
        ]);
      }
    },
    [scannerLocked, isProcessing, markPairingFailed, router, startPairing],
  );

  const handleRequestPermission = async () => {
    const result = await requestPermission();
    trackTelemetryEvent("pairing_camera_permission_requested", {
      granted: result.granted,
    });
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
          <Pressable
            style={styles.backButton}
            onPress={() => {
              trackTelemetryEvent("pairing_scan_closed", {
                reason: "permission_denied",
              });
              void resetPairingFlow();
              navigateBackToPairing(router);
            }}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
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
          <Pressable
            style={styles.closeButton}
            onPress={() => {
              trackTelemetryEvent("pairing_scan_closed", {
                reason: "cancel",
              });
              void resetPairingFlow();
              navigateBackToPairing(router);
            }}
          >
            <Text style={styles.closeButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.bottomContainer}>
        <Text style={styles.bottomTitle}>Having trouble scanning?</Text>
        <Text style={styles.bottomSubtitle}>
          Enter the 8-character code from your Codex desktop app
        </Text>

        <View style={styles.codeRow}>
          <Pressable
            style={styles.codePill}
            onPress={() => codeInputRef.current?.focus()}
          >
            <Text style={styles.codeText}>{leftCode}</Text>
          </Pressable>
          <Text style={styles.codeDivider}>-</Text>
          <Pressable
            style={styles.codePill}
            onPress={() => codeInputRef.current?.focus()}
          >
            <Text style={styles.codeText}>{rightCode}</Text>
          </Pressable>
        </View>

        <TextInput
          ref={codeInputRef}
          style={styles.hiddenInput}
          keyboardType="default"
          value={manualCode}
          onChangeText={handleManualCodeChange}
          editable={!isManualProcessing}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="done"
          maxLength={8}
          onFocus={() => setIsCodeInputFocused(true)}
          onBlur={() => setIsCodeInputFocused(false)}
          onSubmitEditing={handleManualSubmit}
        />

        <Pressable
          style={[
            styles.connectButton,
            (!manualCode.trim() || isManualProcessing) && styles.connectButtonDisabled,
          ]}
          onPress={handleManualSubmit}
          disabled={!manualCode.trim() || isManualProcessing}
        >
          {isManualProcessing ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.connectButtonText}>Connect</Text>
          )}
        </Pressable>
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
      justifyContent: "flex-start",
      paddingTop: 60,
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
    bottomContainer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: "rgba(0,0,0,0.85)",
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 40,
      alignItems: "center",
    },
    bottomTitle: {
      color: "#fff",
      fontSize: 18,
      fontWeight: "700",
      fontFamily: FontFamilies.display.spaceGrotesk,
      marginBottom: 4,
    },
    bottomSubtitle: {
      color: "rgba(255,255,255,0.6)",
      fontSize: 14,
      fontFamily: FontFamilies.normal.ibmPlexSans,
      marginBottom: 20,
    },
    codeRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginBottom: 20,
    },
    codePill: {
      height: 54,
      minWidth: 132,
      borderRadius: 27,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.3)",
      backgroundColor: "rgba(255,255,255,0.1)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    codeText: {
      color: "#fff",
      fontSize: 18,
      fontWeight: "600",
      fontFamily: FontFamilies.mono.jetBrainsMono,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    codeDivider: {
      color: "rgba(255,255,255,0.5)",
      fontSize: 20,
      fontWeight: "700",
      fontFamily: FontFamilies.mono.jetBrainsMono,
    },
    hiddenInput: {
      position: "absolute",
      opacity: 0,
      width: 1,
      height: 1,
    },
    connectButton: {
      width: "100%",
      maxWidth: 320,
      backgroundColor: "#2563eb",
      borderRadius: 14,
      height: 52,
      alignItems: "center",
      justifyContent: "center",
    },
    connectButtonDisabled: {
      backgroundColor: "rgba(37,99,235,0.4)",
    },
    connectButtonText: {
      color: "#ffffff",
      fontSize: 17,
      fontWeight: "600",
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
    backButton: {
      borderRadius: 14,
      backgroundColor: "transparent",
      borderWidth: 1.5,
      borderColor: theme.textSecondary + "40",
      paddingHorizontal: 24,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 12,
    },
    backButtonText: {
      color: theme.textSecondary,
      fontSize: 15,
      fontWeight: "500",
      fontFamily: FontFamilies.normal.ibmPlexSans,
    },
  });
