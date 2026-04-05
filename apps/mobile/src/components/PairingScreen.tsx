import React, { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { QrCodeIcon } from "@/components/icons/Icon";
import { getRandomPfpAsset } from "@/constants/pfp-assets";
import { useTheme } from "@/hooks/use-theme";

export function PairingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [pfpImageSource] = useState(getRandomPfpAsset);

  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <View style={styles.centerContent}>
        <View style={styles.pfpCard}>
          <Image source={pfpImageSource} style={styles.pfpImage} resizeMode="cover" />
        </View>

        <Text style={styles.username}>User</Text>

        <Pressable
          style={styles.scanButton}
          onPress={() => router.push("/pairing-scan")}
        >
          <QrCodeIcon size={22} color="#111111" />
          <Text style={styles.scanButtonText}>Scan with Codex to connect</Text>
        </Pressable>
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
      gap: 20,
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
    },
    termsCopy: {
      color: theme.textSecondary,
      fontSize: 15,
      lineHeight: 22,
      textAlign: "center",
    },
    linkText: {
      color: theme.text,
      textDecorationLine: "underline",
    },
  });
