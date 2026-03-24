import React, { useEffect } from "react";
import {
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

type BottomSheetProps = {
  isVisible: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export function BottomSheet({
  isVisible,
  onClose,
  children,
}: BottomSheetProps) {
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const opacity = useSharedValue(0);

  const requestClose = () => {
    opacity.value = withTiming(0, { duration: 220 });
    translateY.value = withTiming(
      SCREEN_HEIGHT,
      {
        duration: 220,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      },
      () => {
        runOnJS(onClose)();
      },
    );
  };

  useEffect(() => {
    if (isVisible) {
      opacity.value = withTiming(1, { duration: 300 });
      translateY.value = withTiming(0, {
        duration: 300,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      });
    } else {
      opacity.value = withTiming(0, { duration: 250 });
      translateY.value = withTiming(SCREEN_HEIGHT, {
        duration: 250,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      });
    }
  }, [isVisible, onClose, opacity, translateY]);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
        const nextOpacity = 1 - event.translationY / (SCREEN_HEIGHT * 0.6);
        opacity.value = Math.max(0, Math.min(1, nextOpacity));
      }
    })
    .onEnd((event) => {
      if (event.translationY > 120 || event.velocityY > 800) {
        opacity.value = withTiming(0, { duration: 200 });
        translateY.value = withTiming(
          SCREEN_HEIGHT,
          {
            duration: 200,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          },
          () => {
            runOnJS(onClose)();
          },
        );
      } else {
        opacity.value = withTiming(1, { duration: 200 });
        translateY.value = withTiming(0, {
          duration: 220,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        });
      }
    });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!isVisible && opacity.value === 0) {
    return null;
  }

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={isVisible ? "auto" : "none"}
    >
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={styles.flex} onPress={requestClose} />
      </Animated.View>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.sheetContainer}
      >
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.sheet, sheetStyle]}>
            {children}
          </Animated.View>
        </GestureDetector>
      </KeyboardAvoidingView>
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
  sheetContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: SCREEN_HEIGHT * 0.9,
    backgroundColor: "transparent",
  },
});
