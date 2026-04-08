import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { FontFamilies } from "@/constants/fonts";
import { useTheme } from "@/hooks/use-theme";

const SPINNER_SIZE = 48;
const SPINNER_STROKE = 4;

const CONNECTING_MESSAGES = [
  "Connecting to Codex... teaching the relay to stop being dramatic.",
  "Establishing secure connection... the handshake is doing paperwork.",
  "Handshaking with bridge... cryptography insists on a formal introduction.",
  "Verifying session... making sure this QR still means something.",
  "Almost there... pulling your last thread back into view.",
];

export function ConnectingScreen() {
  const colors = useTheme();
  const isDark = colors.background === "#000000";
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const rotation = useSharedValue(0);
  const progress = useSharedValue(0);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    rotation.value = 0;
    rotation.value = withRepeat(
      withTiming(360, { duration: 850, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rotation]);

  useEffect(() => {
    requestAnimationFrame(() => {
      progress.value = withTiming(1, {
        duration: 320,
        easing: Easing.out(Easing.cubic),
      });
    });
  }, [progress]);

  useEffect(() => {
    const timer = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % CONNECTING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  const spinnerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${rotation.value}deg` }],
  }));

  const pageAnimStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: interpolate(progress.value, [0, 1], [1.04, 1]) }],
  }));

  const contentAnimStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      {
        translateY: interpolate(progress.value, [0, 1], [18, 0]),
      },
    ],
  }));

  return (
    <Animated.View style={[styles.page, pageAnimStyle]}>
      <Animated.View style={[styles.content, contentAnimStyle]}>
        <View style={styles.spinnerWrap}>
          <View style={styles.glowRing} />
          <Animated.View style={spinnerAnimStyle}>
            <Svg width={SPINNER_SIZE} height={SPINNER_SIZE} viewBox="0 0 48 48">
              <Circle
                cx="24"
                cy="24"
                r="17"
                fill="none"
                stroke={isDark ? "#6AA2FF" : "#2F5ABF"}
                strokeWidth={SPINNER_STROKE}
                strokeLinecap="round"
                strokeDasharray="62 140"
                transform="rotate(-90 24 24)"
              />
            </Svg>
          </Animated.View>
        </View>

        <Text style={styles.title}>Connecting</Text>
        <Text style={styles.subtitle}>{CONNECTING_MESSAGES[messageIndex]}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>, isDark: boolean) =>
  StyleSheet.create({
    page: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 40,
      elevation: 40,
    },
    content: {
      alignItems: "center",
      gap: 28,
      paddingHorizontal: 40,
    },
    spinnerWrap: {
      width: SPINNER_SIZE + 28,
      height: SPINNER_SIZE + 28,
      borderRadius: (SPINNER_SIZE + 28) / 2,
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    },
    glowRing: {
      position: "absolute",
      width: SPINNER_SIZE + 34,
      height: SPINNER_SIZE + 34,
      borderRadius: (SPINNER_SIZE + 34) / 2,
      backgroundColor: isDark ? "rgba(106, 162, 255, 0.08)" : "rgba(47, 90, 191, 0.08)",
    },
    title: {
      color: colors.text,
      fontSize: 24,
      fontWeight: "600",
      fontFamily: FontFamilies.display.spaceGrotesk,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      textAlign: "center",
      fontFamily: FontFamilies.normal.ibmPlexSans,
    },
  });
