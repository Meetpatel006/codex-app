import React, { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";

import { FontFamilies } from "@/constants/fonts";
import { trackTelemetryEvent } from "@/services/telemetry";
import { useSessionStore } from "@/store/session";
import { useTheme } from "@/hooks/use-theme";
import { parsePairingPayload } from "@/utils/pairing";

export default function PairingScanScreen() {
  const theme = useTheme();
  const router = useRouter();
  const startPairing = useSessionStore((state) => state.startPairing);
  const markPairingFailed = useSessionStore((state) => state.markPairingFailed);
  const resetPairingFlow = useSessionStore((state) => state.resetPairingFlow);
  const [permission, requestPermission] = useCameraPermissions();
  const [scannerLocked, setScannerLocked] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const styles = useMemo(() => createStyles(theme), [theme]);

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
              router.back();
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
              router.back();
            }}
          >
            <Text style={styles.closeButtonText}>Cancel</Text>
          </Pressable>
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
