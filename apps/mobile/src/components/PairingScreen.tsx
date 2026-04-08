import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
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
  const codeInputRef = useRef<TextInput>(null);

  const styles = useMemo(() => createStyles(theme), [theme]);

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

        <View style={styles.manualEntryBox}>
          <Text style={styles.manualEntryTitle}>Or enter code manually</Text>
          <View style={styles.codeEntryRow}>
            <Pressable
              style={styles.codeBoxes}
              onPress={() => codeInputRef.current?.focus()}
            >
              {codeChars.slice(0, 4).map((char, index) => (
                <View
                  key={`left-${index}`}
                  style={[
                    styles.codeBox,
                    char ? styles.codeBoxFilled : undefined,
                  ]}
                >
                  <Text style={styles.codeBoxText}>{char}</Text>
                </View>
              ))}
              <Text style={styles.codeDivider}>-</Text>
              {codeChars.slice(4).map((char, index) => (
                <View
                  key={`right-${index}`}
                  style={[
                    styles.codeBox,
                    char ? styles.codeBoxFilled : undefined,
                  ]}
                >
                  <Text style={styles.codeBoxText}>{char}</Text>
                </View>
              ))}
            </Pressable>
            <TextInput
              ref={codeInputRef}
              style={styles.hiddenInput}
              keyboardType="default"
              value={manualCode}
              onChangeText={handleManualCodeChange}
              editable={!isProcessing}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              maxLength={12}
              onSubmitEditing={handleManualSubmit}
            />
            <Pressable
              style={[
                styles.pillSubmitButton,
                (!manualCode.trim() || isProcessing) &&
                  styles.pillSubmitButtonDisabled,
              ]}
              onPress={handleManualSubmit}
              disabled={!manualCode.trim() || isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color="#111111" size="small" />
              ) : (
                <Text style={styles.pillSubmitButtonText}>Connect</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>

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
    manualEntryBox: {
      width: "90%",
      maxWidth: 360,
      borderRadius: 16,
      backgroundColor: theme.backgroundElement,
      borderWidth: 1,
      borderColor: theme.textSecondary + "30",
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    manualEntryTitle: {
      color: theme.text,
      fontSize: 14,
      fontWeight: "600",
      marginBottom: 10,
      fontFamily: FontFamilies.normal.ibmPlexSans,
    },
    codeEntryRow: {
      gap: 10,
    },
    codeBoxes: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.background,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.textSecondary + "30",
      paddingHorizontal: 8,
      height: 58,
    },
    codeBox: {
      width: 34,
      height: 40,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.textSecondary + "35",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.backgroundElement,
      marginHorizontal: 3,
    },
    codeBoxFilled: {
      borderColor: theme.textSecondary + "70",
    },
    codeBoxText: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "600",
      fontFamily: FontFamilies.normal.ibmPlexSans,
      textTransform: "uppercase",
    },
    codeDivider: {
      color: theme.textSecondary,
      fontSize: 18,
      fontWeight: "700",
      marginHorizontal: 4,
      fontFamily: FontFamilies.normal.ibmPlexSans,
    },
    hiddenInput: {
      position: "absolute",
      opacity: 0,
      width: 1,
      height: 1,
    },
    pillSubmitButton: {
      backgroundColor: "#f2f2f2",
      borderRadius: 20,
      paddingHorizontal: 16,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 82,
    },
    pillSubmitButtonDisabled: {
      opacity: 0.55,
    },
    pillSubmitButtonText: {
      color: "#111111",
      fontSize: 14,
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
