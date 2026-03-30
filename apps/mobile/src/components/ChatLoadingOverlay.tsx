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

import { useTheme } from "@/hooks/use-theme";

const JOKES = [
  "Loading chat... teaching the relay to carry packets, not feelings.",
  "Hydrating thread state. JavaScript still insists this counts as plumbing.",
  "Syncing messages from the terminal dimension. Ctrl+C remains unavailable.",
  "Polishing diffs and decoding chaos. The compiler asked for coffee first.",
  "Waking up the chat engine. It said 'works on my machine' and rolled over.",
];

const SPINNER_SIZE = 48;
const SPINNER_STROKE = 4;

type ChatLoadingOverlayProps = {
  visible: boolean;
  sessionKey?: string | null;
};

export function ChatLoadingOverlay({
  visible,
  sessionKey,
}: ChatLoadingOverlayProps) {
  const colors = useTheme();
  const isDark = colors.background === "#000000";
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const rotation = useSharedValue(0);
  const progress = useSharedValue(visible ? 1 : 0);
  const [jokeIndex, setJokeIndex] = useState(0);
  const [shouldRender, setShouldRender] = useState(visible);

  // Continuous spinner rotation
  useEffect(() => {
    rotation.value = 0;
    rotation.value = withRepeat(
      withTiming(360, { duration: 850, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rotation]);

  // Fade in / fade out with delayed unmount
  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      // Small delay so the mount renders before animating in
      requestAnimationFrame(() => {
        progress.value = withTiming(1, {
          duration: 300,
          easing: Easing.out(Easing.cubic),
        });
      });
      return;
    }

    // Animate out
    progress.value = withTiming(0, {
      duration: 450,
      easing: Easing.in(Easing.cubic),
    });
    // Keep mounted until animation finishes
    const timer = setTimeout(() => setShouldRender(false), 500);
    return () => clearTimeout(timer);
  }, [progress, visible]);

  // Pick initial joke based on session key
  useEffect(() => {
    const baseIndex =
      Math.abs(hashString(String(sessionKey || "chat-loading"))) % JOKES.length;
    setJokeIndex(baseIndex);
  }, [sessionKey]);

  // Rotate jokes
  useEffect(() => {
    if (!visible) {
      return;
    }
    const timer = setInterval(() => {
      setJokeIndex((current) => (current + 1) % JOKES.length);
    }, 2800);
    return () => clearInterval(timer);
  }, [visible]);

  const spinnerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${rotation.value}deg` }],
  }));

  // Page fades + scales down slightly on exit for a visible transition
  const pageAnimStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { scale: interpolate(progress.value, [0, 1], [1.04, 1]) },
    ],
  }));

  // Content fades + slides up on exit
  const contentAnimStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      {
        translateY: interpolate(progress.value, [0, 1], [18, 0]),
      },
    ],
  }));

  if (!shouldRender) {
    return null;
  }

  return (
    <Animated.View
      style={[styles.page, pageAnimStyle]}
      pointerEvents={visible ? "auto" : "none"}
    >
      <Animated.View style={[styles.content, contentAnimStyle]}>
        <View style={styles.spinnerWrap}>
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

        <Text style={styles.subtitle}>{JOKES[jokeIndex]}</Text>
      </Animated.View>
    </Animated.View>
  );
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}

const createStyles = (
  colors: ReturnType<typeof useTheme>,
  isDark: boolean,
) =>
  StyleSheet.create({
    page: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 40,
      elevation: 40,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
    },
    content: {
      alignItems: "center",
      gap: 32,
      paddingHorizontal: 40,
    },
    spinnerWrap: {
      width: SPINNER_SIZE + 20,
      height: SPINNER_SIZE + 20,
      borderRadius: (SPINNER_SIZE + 20) / 2,
      alignItems: "center",
      justifyContent: "center",

    },

    subtitle: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      textAlign: "center",
    },
  });
