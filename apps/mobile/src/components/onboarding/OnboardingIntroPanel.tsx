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
          <Text style={styles.subtitle}>Fix bugs and ship code</Text>
          <Text style={styles.subtitleAccent}>from your pocket.</Text>
          <Text style={styles.subtitleSupport}>
            Plan, review, and build faster wherever you are.
          </Text>
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
      paddingHorizontal: 16,
      paddingTop: 18,
      alignItems: "center",
    },
    contentWrapper: {
      alignItems: "center",
      width: "100%",
      maxWidth: 360,
    },
    textContainer: {
      alignItems: "center",
      gap: 2,
    },
    // title: {
    //   fontFamily: FontFamilies.display.spaceGrotesk,
    //   fontSize: 25,
    //   lineHeight: 40,
    //   letterSpacing: -0.6,
    //   fontWeight: "700",
    //   color: theme.text,
    //   marginBottom: 12,
    // },
    subtitle: {
      fontFamily: FontFamilies.normal.ibmPlexSans,
      fontSize: 30,
      lineHeight: 36,
      letterSpacing: -0.4,
      fontWeight: "500",
      color: theme.text,
      textAlign: "center",
    },
    subtitleAccent: {
      fontFamily: FontFamilies.normal.ibmPlexSans,
      fontSize: 30,
      lineHeight: 36,
      letterSpacing: -0.4,
      fontWeight: "600",
      color: theme.accent,
      textAlign: "center",
    },
    subtitleSupport: {
      marginTop: 8,
      fontFamily: FontFamilies.normal.ibmPlexSans,
      fontSize: 16,
      lineHeight: 24,
      fontWeight: "400",
      color: theme.text,
      textAlign: "center",
      opacity: 0.85,
      maxWidth: 320,
    },
buttonContainer: {
      paddingHorizontal: 28,
      marginTop: 28,
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
