import React, { useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from "react-native";
import { useRouter } from "expo-router";

import { QrCodeIcon } from "@/components/icons/Icon";
import { PairingLegalSheet, type LegalDoc } from "@/components/PairingLegalSheet";
import { FontFamilies } from "@/constants/fonts";
import { getStoredPfpAsset } from "@/constants/pfp-assets";
import { useTheme } from "@/hooks/use-theme";
import { trackTelemetryEvent } from "@/services/telemetry";
import { useSessionStore } from "@/store/session";
import { getUsername } from "@/utils/onboarding";

export function PairingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const beginPairingScan = useSessionStore((state) => state.beginPairingScan);
  const [pfpImageSource, setPfpImageSource] = useState<ImageSourcePropType | null>(null);
  const [username, setUsername] = useState("User");
  const [activeLegalDoc, setActiveLegalDoc] = useState<LegalDoc | null>(null);

  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    let isMounted = true;

    void getUsername()
      .then((storedUsername) => {
        const normalizedUsername = storedUsername?.trim();
        if (!isMounted || !normalizedUsername) {
          return;
        }
        setUsername(normalizedUsername);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    void getStoredPfpAsset().then((pfp) => {
      if (isMounted) {
        setPfpImageSource(pfp);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleScanPress = () => {
    trackTelemetryEvent("pairing_scan_opened");
    beginPairingScan();
    router.push("/pairing-scan");
  };

  return (
    <View style={styles.container}>
      <View style={styles.centerContent}>
        <View style={styles.pfpCard}>
          <Image
            source={pfpImageSource ?? undefined}
            style={styles.pfpImage}
            resizeMode="cover"
          />
        </View>

        <Text style={styles.username}>{username}</Text>

        <Pressable
          style={styles.scanButton}
          onPress={handleScanPress}
        >
          <QrCodeIcon size={22} color="#111111" />
          <Text style={styles.scanButtonText}>Scan with Codex to connect</Text>
        </Pressable>
      </View>

      <Text style={styles.termsCopy}>
        By continuing, you agree to our{" "}
        <Text style={styles.linkText} onPress={() => setActiveLegalDoc("terms")}>
          Terms and Conditions
        </Text>{" "}
        and{" "}
        <Text style={styles.linkText} onPress={() => setActiveLegalDoc("privacy")}>
          Privacy Policy
        </Text>
        .
      </Text>

      <PairingLegalSheet
        activeDoc={activeLegalDoc}
        onClose={() => setActiveLegalDoc(null)}
      />
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
