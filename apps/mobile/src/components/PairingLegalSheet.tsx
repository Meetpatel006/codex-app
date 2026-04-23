import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { FontFamilies } from "@/constants/fonts";
import { useTheme } from "@/hooks/use-theme";

export type LegalDoc = "terms" | "privacy";

type PairingLegalSheetProps = {
  activeDoc: LegalDoc | null;
  onClose: () => void;
};

export function PairingLegalSheet({ activeDoc, onClose }: PairingLegalSheetProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const legalTitle =
    activeDoc === "terms" ? "Terms and Conditions" : "Privacy Policy";

  const legalBody =
    activeDoc === "terms"
      ? "By using Codex Mobile, you agree to use the app responsibly and in accordance with applicable laws. You are responsible for the activity that happens through your paired desktop session and for keeping your device secure. We may update these terms from time to time, and continued use means you accept the latest version."
      : "Codex Mobile stores required app data such as pairing state and your display name on your device to provide core app functionality. We may collect limited telemetry and diagnostics to improve reliability and product quality. We do not sell your personal data.";

  return (
    <BottomSheet isVisible={activeDoc !== null} onClose={onClose}>
      <View style={styles.legalSheet}>
        <View style={styles.legalHandle} />
        <Text style={styles.legalTitle}>{legalTitle}</Text>
        <ScrollView
          style={styles.legalScroll}
          contentContainerStyle={styles.legalScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.legalBody}>{legalBody}</Text>
        </ScrollView>
      </View>
    </BottomSheet>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    legalSheet: {
      backgroundColor: theme.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 6,
      paddingHorizontal: 20,
      paddingBottom: 12,
      maxHeight: "90%",
    },
    legalHandle: {
      width: 44,
      height: 5,
      borderRadius: 999,
      backgroundColor: theme.textSecondary + "55",
      alignSelf: "center",
      marginBottom: 14,
    },
    legalTitle: {
      color: theme.text,
      fontSize: 24,
      fontWeight: "700",
      textAlign: "center",
      fontFamily: FontFamilies.display.spaceGrotesk,
      marginBottom: 8,
    },
    legalScroll: {
      maxHeight: 520,
    },
    legalScrollContent: {
      paddingBottom: 4,
    },
    legalBody: {
      color: theme.textSecondary,
      fontSize: 15,
      lineHeight: 24,
      fontFamily: FontFamilies.normal.ibmPlexSans,
    },
  });
