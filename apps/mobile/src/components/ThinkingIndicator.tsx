import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { FontFamilies } from "@/constants/fonts";

type Props = {
  visible?: boolean;
};

export function ThinkingIndicator({ visible = true }: Props) {
  const opacity1 = useRef(new Animated.Value(0.3)).current;
  const opacity2 = useRef(new Animated.Value(0.3)).current;
  const opacity3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (!visible) {
      return;
    }

    const createAnimation = (opacityValue: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(opacityValue, {
            toValue: 1,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacityValue, {
            toValue: 0.3,
            duration: 400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );

    const anim1 = createAnimation(opacity1, 0);
    const anim2 = createAnimation(opacity2, 150);
    const anim3 = createAnimation(opacity3, 300);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [visible, opacity1, opacity2, opacity3]);

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.dot, { opacity: opacity1 }]} />
      <Animated.View style={[styles.dot, { opacity: opacity2 }]} />
      <Animated.View style={[styles.dot, { opacity: opacity3 }]} />
    </View>
  );
}

export function ThinkingText({ streaming = false }: { streaming?: boolean }) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!streaming) {
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [streaming, shimmer]);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  return (
    <Animated.View style={{ opacity: streaming ? opacity : 1 }}>
      <Text style={styles.thinkingText}>Thinking...</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#9f9f9f",
  },
  thinkingText: {
    color: "#9f9f9f",
    fontSize: 14,
    fontStyle: "italic",
    fontFamily: FontFamilies.normal.ibmPlexSans,
  },
});
