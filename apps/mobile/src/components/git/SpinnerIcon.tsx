import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useTheme } from "@/hooks/use-theme";
import { Loader2 } from "lucide-react-native";

type SpinnerIconProps = {
  size?: number;
  color?: string;
};

export function SpinnerIcon({ size = 16, color }: SpinnerIconProps) {
  const theme = useTheme();
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, {
        duration: 800,
        easing: Easing.linear,
      }),
      -1,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View style={animatedStyle}>
        <Loader2
          size={size}
          color={color || theme.textSecondary}
          strokeWidth={2.5}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
  },
});
