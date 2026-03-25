import React, { useEffect, useState } from "react";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PANEL_WIDTH = SCREEN_WIDTH * 0.85;

type SidePanelProps = {
  isVisible: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export function SidePanel({ isVisible, onClose, children }: SidePanelProps) {
  const [isMounted, setIsMounted] = useState(isVisible);
  const translateX = useSharedValue(SCREEN_WIDTH);
  const opacity = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .enabled(isVisible)
    .activeOffsetX([-20, 20])
    .failOffsetY([-20, 20])
    .onUpdate((event) => {
      const nextX = Math.min(SCREEN_WIDTH, Math.max(0, event.translationX));
      translateX.value = nextX;
      opacity.value = Math.max(0, 1 - nextX / PANEL_WIDTH);
    })
    .onEnd((event) => {
      const shouldClose =
        event.velocityX > 500 || event.translationX > PANEL_WIDTH * 0.35;

      if (shouldClose) {
        runOnJS(onClose)();
        return;
      }

      translateX.value = withTiming(0, {
        duration: 250,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      });
      opacity.value = withTiming(1, { duration: 250 });
    });

  useEffect(() => {
    if (isVisible) {
      setIsMounted(true);
      opacity.value = withTiming(1, { duration: 300 });
      translateX.value = withTiming(0, {
        duration: 300,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      });
    } else {
      opacity.value = withTiming(0, { duration: 250 });
      translateX.value = withTiming(SCREEN_WIDTH, {
        duration: 250,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      });
      const timeout = setTimeout(() => {
        setIsMounted(false);
      }, 260);
      return () => clearTimeout(timeout);
    }
  }, [isVisible, onClose, opacity, translateX]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (!isMounted) {
    return null;
  }

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={isVisible ? "auto" : "none"}
    >
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={styles.flex} onPress={onClose} />
      </Animated.View>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.panel, panelStyle]}>
          <SafeAreaView style={styles.flex} edges={["top", "bottom", "right"]}>
            {children}
          </SafeAreaView>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  panel: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: PANEL_WIDTH,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
});
