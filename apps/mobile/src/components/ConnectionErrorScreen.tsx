import React, { useEffect, useMemo, useRef } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  Animated,
} from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { FontFamilies } from "@/constants/fonts";
import { useTheme } from "@/hooks/use-theme";
import { useSessionStore } from "@/store/session";

type ConnectionErrorScreenProps = {
  title?: string;
  error: string;
  onRetry: () => void;
  autoReturnMs?: number;
  onAutoReturn?: () => void;
};

export function ConnectionErrorScreen({
  title = "Connection Failed",
  error,
  onRetry,
  autoReturnMs,
  onAutoReturn,
}: ConnectionErrorScreenProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const clearPairing = useSessionStore((state) => state.clearPairing);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!autoReturnMs || !onAutoReturn) {
      return;
    }

    const timer = setTimeout(() => {
      onAutoReturn();
    }, autoReturnMs);

    return () => clearTimeout(timer);
  }, [autoReturnMs, onAutoReturn]);

  const ERROR_COLOR = "#E53935";

  const handleGoBack = () => {
    Alert.alert(
      "Go Back to Pairing",
      "This will clear your current connection. You'll need to scan a new QR code.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Go Back",
          style: "destructive",
          onPress: async () => {
            await clearPairing();
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Enhanced icon with gradient background */}
        <View style={styles.iconContainer}>
          <View style={styles.iconOuterCircle}>
            <View style={styles.iconWrap}>
              <Svg width={56} height={56} viewBox="0 0 24 24" fill="none">
                <Circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke={ERROR_COLOR}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                />
                <Path
                  d="M15 9L9 15M9 9L15 15"
                  stroke={ERROR_COLOR}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
          </View>
        </View>

        {/* Text content */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{error}</Text>
        </View>

        {/* Improved button group */}
        <View style={styles.buttonGroup}>
          <Pressable
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.retryButtonPressed,
            ]}
            onPress={onRetry}
          >
            {({ pressed }) => (
              <>
                <Svg
                  width={20}
                  height={20}
                  viewBox="0 0 24 24"
                  fill="none"
                  style={styles.buttonIcon}
                >
                  <Path
                    d="M21 12C21 16.9706 16.9706 21 12 21C9.69494 21 7.59227 20.1334 6 18.7083L3 16M3 12C3 7.02944 7.02944 3 12 3C14.3051 3 16.4077 3.86656 18 5.29168L21 8M3 21V16M3 16H8M21 3V8M21 8H16"
                    stroke={pressed ? "rgba(255,255,255,0.8)" : theme.userText}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                <Text
                  style={[
                    styles.retryButtonText,
                    pressed && styles.retryButtonTextPressed,
                  ]}
                >
                  Try Again
                </Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
            onPress={handleGoBack}
          >
            {({ pressed }) => (
              <>
                <Svg
                  width={20}
                  height={20}
                  viewBox="0 0 24 24"
                  fill="none"
                  style={styles.buttonIcon}
                >
                  <Path
                    d="M9 14L4 9L9 4"
                    stroke={pressed ? theme.text : theme.textSecondary}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <Path
                    d="M4 9H14C17.3137 9 20 11.6863 20 15C20 18.3137 17.3137 21 14 21H13"
                    stroke={pressed ? theme.text : theme.textSecondary}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                <Text
                  style={[
                    styles.backButtonText,
                    pressed && styles.backButtonTextPressed,
                  ]}
                >
                  Back to Pairing
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      alignItems: "center",
      justifyContent: "center",
    },
    content: {
      alignItems: "center",
      paddingHorizontal: 32,
      maxWidth: 400,
      width: "100%",
    },
    iconContainer: {
      marginBottom: 8,
    },
    iconOuterCircle: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: "#E5393508",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "#E5393515",
    },
    iconWrap: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: "#E5393512",
      alignItems: "center",
      justifyContent: "center",
    },
    textContainer: {
      alignItems: "center",
      gap: 8,
      marginTop: 24,
      marginBottom: 32,
    },
    title: {
      color: theme.text,
      fontSize: 24,
      fontWeight: "700",
      fontFamily: FontFamilies.display.spaceGrotesk,
      letterSpacing: -0.5,
    },
    subtitle: {
      color: theme.textSecondary,
      fontSize: 15,
      lineHeight: 22,
      textAlign: "center",
      fontFamily: FontFamilies.normal.ibmPlexSans,
      maxWidth: 280,
    },
    buttonGroup: {
      gap: 14,
      width: "100%",
    },
    retryButton: {
      backgroundColor: theme.userBubble,
      borderRadius: 16,
      paddingVertical: 16,
      paddingHorizontal: 24,
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
      gap: 10,
      shadowColor: theme.userBubble,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    retryButtonPressed: {
      opacity: 0.8,
      transform: [{ scale: 0.98 }],
    },
    retryButtonText: {
      color: theme.userText,
      fontSize: 17,
      fontWeight: "600",
      fontFamily: FontFamilies.normal.ibmPlexSans,
      letterSpacing: 0.2,
    },
    retryButtonTextPressed: {
      opacity: 0.8,
    },
    backButton: {
      backgroundColor: "transparent",
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: theme.textSecondary + "40",
      paddingVertical: 16,
      paddingHorizontal: 24,
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
      gap: 10,
    },
    backButtonPressed: {
      backgroundColor: theme.textSecondary + "10",
      borderColor: theme.text + "60",
    },
    backButtonText: {
      color: theme.textSecondary,
      fontSize: 17,
      fontWeight: "500",
      fontFamily: FontFamilies.normal.ibmPlexSans,
      letterSpacing: 0.2,
    },
    backButtonTextPressed: {
      color: theme.text,
    },
    buttonIcon: {
      marginRight: -2,
    },
  });
