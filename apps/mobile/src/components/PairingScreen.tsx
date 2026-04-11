import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { QrCodeIcon } from "@/components/icons/Icon";
import { FontFamilies } from "@/constants/fonts";
import { getRandomPfpAsset } from "@/constants/pfp-assets";
import { useTheme } from "@/hooks/use-theme";
import { useChatStore } from "@/store/chat";
import { useSessionStore } from "@/store/session";
import {
  isShortCode,
  parsePairingPayload,
  resolveShortCode,
} from "@/utils/pairing";

export function PairingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const beginPairingScan = useSessionStore((state) => state.beginPairingScan);
  const startPairing = useSessionStore((state) => state.startPairing);
  const markPairingFailed = useSessionStore((state) => state.markPairingFailed);
  const [pfpImageSource] = useState(getRandomPfpAsset);
  const [manualCode, setManualCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCodeInputFocused, setIsCodeInputFocused] = useState(false);
  const [isManualEntryVisible, setIsManualEntryVisible] = useState(false);
  const [showCursor, setShowCursor] = useState(true);
  const codeInputRef = useRef<TextInput>(null);
  const modalInputRef = useRef<TextInput>(null);

  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    if (isManualEntryVisible) {
      setTimeout(() => {
        modalInputRef.current?.focus();
      }, 300);
    }
  }, [isManualEntryVisible]);

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
    if (!manualCode.trim() || isProcessing) return;

    Keyboard.dismiss();
    setIsProcessing(true);

    try {
      const trimmedCode = manualCode.trim();
      const payload = isShortCode(trimmedCode)
        ? await resolveShortCode(trimmedCode)
        : trimmedCode;

      const parsed = parsePairingPayload(payload);
      await startPairing(parsed);
      setManualCode("");
      setIsManualEntryVisible(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to connect";
      const isExpired = message.toLowerCase().includes("expired");

      if (isExpired) {
        markPairingFailed(message, { expired: true });
      } else {
        Alert.alert("Connection failed", message);
      }
    } finally {
      setIsProcessing(false);
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

  const closeModal = () => {
    Keyboard.dismiss();
    setManualCode("");
    setIsManualEntryVisible(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.centerContent}>
        <View style={styles.pfpCard}>
          <Image
            source={pfpImageSource}
            style={styles.pfpImage}
            resizeMode="cover"
          />
        </View>

        <Text style={styles.username}>User</Text>

        <Pressable
          style={styles.scanButton}
          onPress={() => {
            beginPairingScan();
            router.push("/pairing-scan");
          }}
        >
          <QrCodeIcon size={22} color="#111111" />
          <Text style={styles.scanButtonText}>Scan with Codex to connect</Text>
        </Pressable>

        <Pressable
          style={styles.manualEntryTriggerButton}
          onPress={() => setIsManualEntryVisible(true)}
        >
          <Text style={styles.manualEntryTriggerText}>Enter code manually</Text>
        </Pressable>
      </View>

      <Modal
        visible={isManualEntryVisible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalBackdrop}
        >
          <Pressable style={styles.modalOverlay} onPress={closeModal} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Enter Code</Text>

            <Text style={styles.modalSubtitle}>
              Enter the 8-character code from your Codex desktop app
            </Text>

            <Pressable
              style={styles.modalCodeRow}
              onPress={() => modalInputRef.current?.focus()}
            >
              <View
                style={[
                  styles.modalCodePill,
                  isCodeInputFocused && styles.modalCodePillFocused,
                ]}
              >
                <Text style={styles.modalCodeText}>{leftCode}</Text>
              </View>
              <Text style={styles.modalCodeDivider}>-</Text>
              <View
                style={[
                  styles.modalCodePill,
                  isCodeInputFocused && styles.modalCodePillFocused,
                ]}
              >
                <Text style={styles.modalCodeText}>{rightCode}</Text>
              </View>
            </Pressable>

            <TextInput
              ref={modalInputRef}
              style={styles.modalHiddenInput}
              keyboardType="default"
              value={manualCode}
              onChangeText={handleManualCodeChange}
              editable={!isProcessing}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              maxLength={8}
              onFocus={() => setIsCodeInputFocused(true)}
              onBlur={() => setIsCodeInputFocused(false)}
              onSubmitEditing={handleManualSubmit}
            />

            <View style={styles.modalButtonRow}>
              <Pressable style={styles.modalCancelButton} onPress={closeModal}>
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.modalConnectButton,
                  (!manualCode.trim() || isProcessing) &&
                    styles.modalConnectButtonDisabled,
                ]}
                onPress={handleManualSubmit}
                disabled={!manualCode.trim() || isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.modalConnectButtonText}>Connect</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Text style={styles.termsCopy}>
        By continuing, you agree to our{" "}
        <Text style={styles.linkText}>Terms of Service</Text> and{" "}
        <Text style={styles.linkText}>Privacy Policy</Text>.
      </Text>
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      paddingHorizontal: 18,
      paddingBottom: 40,
    },
    centerContent: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
    },
    pfpCard: {
      width: "75%",
      maxWidth: 360,
      aspectRatio: 1,
      borderRadius: 18,
      overflow: "hidden",
      backgroundColor: "#f2f2f2",
    },
    pfpImage: {
      width: "100%",
      height: "100%",
    },
    username: {
      color: theme.text,
      fontSize: 22,
      fontWeight: "600",
      fontFamily: FontFamilies.display.spaceGrotesk,
    },
    scanButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      width: "90%",
      maxWidth: 300,
      backgroundColor: "#f2f2f2",
      borderRadius: 16,
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    scanButtonText: {
      color: "#111111",
      fontSize: 18,
      fontWeight: "500",
      fontFamily: FontFamilies.normal.ibmPlexSans,
    },
    manualEntryTriggerButton: {
      width: "90%",
      maxWidth: 300,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.textSecondary + "45",
      paddingHorizontal: 20,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    manualEntryTriggerText: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "500",
      fontFamily: FontFamilies.normal.ibmPlexSans,
    },
    modalBackdrop: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 20,
    },
    modalOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "#00000080",
    },
    modalCard: {
      backgroundColor: theme.background,
      borderRadius: 20,
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 24,
      width: "100%",
      maxWidth: 340,
    },
    modalTitle: {
      color: theme.text,
      fontSize: 22,
      fontWeight: "700",
      textAlign: "center",
      fontFamily: FontFamilies.display.spaceGrotesk,
      marginBottom: 8,
    },
    modalSubtitle: {
      color: theme.textSecondary,
      fontSize: 15,
      lineHeight: 22,
      textAlign: "center",
      marginBottom: 24,
      fontFamily: FontFamilies.normal.ibmPlexSans,
    },
    modalCodeRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginBottom: 24,
    },
    modalCodePill: {
      height: 54,
      minWidth: 132,
      borderRadius: 27,
      borderWidth: 1,
      borderColor: theme.textSecondary + "3a",
      backgroundColor: theme.backgroundElement,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    modalCodePillFocused: {
      borderColor: theme.textSecondary + "80",
      borderWidth: 2,
    },
    modalCodeText: {
      color: theme.text,
      fontSize: 18,
      fontWeight: "600",
      fontFamily: FontFamilies.mono.jetBrainsMono,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    modalCursor: {
      color: theme.text,
      fontSize: 18,
      fontWeight: "600",
      fontFamily: FontFamilies.mono.jetBrainsMono,
    },
    modalCodeDivider: {
      color: theme.textSecondary,
      fontSize: 20,
      fontWeight: "700",
      fontFamily: FontFamilies.mono.jetBrainsMono,
    },
    modalHiddenInput: {
      position: "absolute",
      opacity: 0,
      width: 1,
      height: 1,
    },
    modalButtonRow: {
      flexDirection: "row",
      gap: 12,
      marginTop: 8,
    },
    modalConnectButton: {
      flex: 1,
      backgroundColor: "#2563eb",
      borderRadius: 14,
      height: 52,
      alignItems: "center",
      justifyContent: "center",
    },
    modalConnectButtonDisabled: {
      backgroundColor: theme.textSecondary + "30",
    },
    modalConnectButtonText: {
      color: "#ffffff",
      fontSize: 17,
      fontWeight: "600",
      fontFamily: FontFamilies.normal.ibmPlexSans,
    },
    modalCancelButton: {
      flex: 1,
      height: 52,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 14,
      backgroundColor: theme.backgroundElement,
    },
    modalCancelButtonText: {
      color: theme.text,
      fontSize: 17,
      fontWeight: "600",
      fontFamily: FontFamilies.normal.ibmPlexSans,
    },
    termsCopy: {
      color: theme.textSecondary,
      fontSize: 15,
      lineHeight: 22,
      textAlign: "center",
      fontFamily: FontFamilies.normal.ibmPlexSans,
    },
    linkText: {
      color: theme.text,
      textDecorationLine: "underline",
      fontFamily: FontFamilies.normal.ibmPlexSans,
    },
  });
