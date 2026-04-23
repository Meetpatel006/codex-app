import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/hooks/use-theme";
import { FontFamilies } from "@/constants/fonts";

interface OnboardingStepPanelProps {
  label: string;
  title: string;
  description: string;
  buttonLabel: string;
  onBackPress?: () => void;
  onNextPress: () => void;
}

export function OnboardingStepPanel({
  label,
  title,
  description,
  buttonLabel,
  onBackPress,
  onNextPress,
}: OnboardingStepPanelProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <View style={styles.textContainer}>
        <View style={styles.labelBadge}>
          <Text style={styles.labelText}>{label}</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <View style={styles.buttonRow}>
        {onBackPress && (
          <Pressable style={styles.backButton} onPress={onBackPress}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        )}
        <Pressable
          style={styles.nextButton}
          onPress={onNextPress}
        >
          <Text style={styles.nextButtonText}>{buttonLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.backgroundElement,
      padding: 16,
      borderRadius: 18,
      gap: 24,
    },
    textContainer: {
      alignItems: "center",
      gap: 16,
    },
    labelBadge: {
      backgroundColor: theme.backgroundSelected,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
    },
    labelText: {
      fontFamily: FontFamilies.normal.ibmPlexSans,
      fontSize: 12,
      fontWeight: "500",
      color: theme.text,
    },
    title: {
      fontFamily: FontFamilies.display.spaceGrotesk,
      fontSize: 22,
      fontWeight: "600",
      color: theme.text,
      textAlign: "center",
    },
    description: {
      fontFamily: FontFamilies.normal.ibmPlexSans,
      fontSize: 16,
      color: theme.textSecondary,
      textAlign: "center",
      lineHeight: 24,
    },
    buttonRow: {
      flexDirection: "row",
      gap: 12,
    },
    backButton: {
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: theme.backgroundSelected,
    },
    backButtonText: {
      fontFamily: FontFamilies.normal.ibmPlexSans,
      fontSize: 16,
      fontWeight: "600",
      color: theme.text,
    },
    nextButton: {
      flex: 1,
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: theme.accent,
      alignItems: "center",
    },
    nextButtonText: {
      fontFamily: FontFamilies.normal.ibmPlexSans,
      fontSize: 16,
      fontWeight: "600",
      color: "#ffffff",
    },
  });