import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View, LayoutChangeEvent } from "react-native";

import { useTheme } from "@/hooks/use-theme";
import { FontFamilies } from "@/constants/fonts";

interface Props {
  onPressStart: () => void;
  onLayout?: (height: number) => void;
}

export function OnboardingIntroPanel({ onPressStart, onLayout }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    if (onLayout && height > 0) {
      onLayout(height);
    }
  };

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <View style={styles.contentWrapper}>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Portdex</Text>
          <Text style={styles.subtitle}>Fix bug and do coding </Text>
          <Text style={styles.subtitleAccent}> in your pocket.</Text>
        </View>
      </View>
      <View style={styles.buttonContainer}>
        <Pressable style={styles.button} onPress={onPressStart}>
          <Text style={styles.buttonText}>Get Started</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      padding: 15,
      alignItems: "center",
    },
    contentWrapper: {
      alignItems: "center",
    },
    textContainer: {
      alignItems: "center",
    },
    title: {
      fontFamily: FontFamilies.display.spaceGrotesk,
      fontSize: 40,
      fontWeight: "700",
      color: theme.text,
      bottom: 18,
    },
    subtitle: {
      fontFamily: FontFamilies.normal.ibmPlexSans,
      fontSize: 25,
      fontWeight: "500",
      color: theme.text,
      bottom: 5,
    },
    subtitleAccent: {
      fontFamily: FontFamilies.normal.ibmPlexSans,
      fontSize: 25,
      fontWeight: "500",
      color: theme.accent,
    },
buttonContainer: {
      paddingHorizontal: 40,
      marginTop: 24,
      width: "100%",
    },
    button: {
      backgroundColor: theme.accent,
      paddingVertical: 18,
      borderRadius: 14,
      alignItems: "center",
    },
    buttonText: {
      fontFamily: FontFamilies.normal.ibmPlexSans,
      fontSize: 18,
      fontWeight: "600",
      color: "#ffffff",
    },
  });