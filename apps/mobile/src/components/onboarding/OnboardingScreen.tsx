import React, { useState, useMemo } from "react";
import {
  StyleSheet,
  View,
  TextInput,
  Pressable,
  Text,
  Image,
  Platform,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolate,
  useDerivedValue,
  runOnJS,
} from "react-native-reanimated";

import { useTheme } from "@/hooks/use-theme";
import { FontFamilies } from "@/constants/fonts";
import { OnboardingIntroPanel } from "./OnboardingIntroPanel";
import {
  markOnboardingComplete,
  setUsername,
} from "@/utils/onboarding";

const SCREEN_HEIGHT = Dimensions.get("screen").height;
const DEFAULT_PANEL_HEIGHT = 300;
const INITIAL_BG_BOTTOM = SCREEN_HEIGHT * 0.9;
const SIDE_GAP = 24;
const TOP_GAP = 60;
const SIDE_GAP_ANIMATED = 12;
const TOP_GAP_ANIMATED = 30;

const STEPS = [
  {
    label: "Connect",
    title: "Link with Codex Desktop",
    description:
      "Open your Codex Desktop app, go to Settings > Mobile, and scan the QR code or enter the 8-character code to pair your devices.",
    buttonLabel: "Got it, next",
    showImage: true,
  },
  {
    label: "Username",
    title: "What's your name?",
    description:
      "This will be shown on your Codex Desktop app when you're connected.",
    buttonLabel: "Continue",
    showImage: false,
  },
];

const pairingImage = require("../../../assets/images/pairing-guide.png");
const phoneImage = require("../../../assets/images/01-chat-en-website-blue-iphone-1284x2778.png");

export function OnboardingScreen() {
  const router = useRouter();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [isColored, setIsColored] = useState(false);
  const [panelHeight, setPanelHeight] = useState(DEFAULT_PANEL_HEIGHT);
  const bgSpillProgress = useSharedValue(0.6);

  const [stepNumber, setStepNumber] = useState(0);
  const [username, setUsernameState] = useState("");
  const step = stepNumber > 0 ? STEPS[stepNumber - 1] : null;
   
  const bgDistance = useDerivedValue(() =>
    interpolate(bgSpillProgress.value, [0, 1], [0, INITIAL_BG_BOTTOM])
  );

  const divider = useDerivedValue(
    () => interpolate(bgSpillProgress.value, [0, 1], [SCREEN_HEIGHT - INITIAL_BG_BOTTOM, 0])
  );

  const colorBgAnimation = useAnimatedStyle(() => {
    const topEdge = interpolate(bgSpillProgress.value, [0, 1], [TOP_GAP, TOP_GAP_ANIMATED]);
    const sideEdge = interpolate(bgSpillProgress.value, [0, 1], [SIDE_GAP, SIDE_GAP_ANIMATED]);
    const bottomValue = interpolate(bgSpillProgress.value, [0, 1], [INITIAL_BG_BOTTOM, 0]);

    return {
      position: "absolute",
      top: topEdge,
      left: sideEdge,
      right: sideEdge,
      bottom: bottomValue,
      borderRadius: interpolate(bgSpillProgress.value, [0, 1], [8, 0]),
    };
  });

  const handleClose = async () => {
    await markOnboardingComplete();
    router.replace("/");
  };

  const handleNext = async () => {
    if (stepNumber === STEPS.length) {
      if (username.trim()) {
        await setUsername(username.trim());
      }
      await markOnboardingComplete();
      router.replace("/");
    } else {
      setStepNumber(stepNumber + 1);
    }
  };

  const handleBack = () => {
    if (stepNumber === 1) {
      bgSpillProgress.value = withTiming(0, { duration: 500 });
      setTimeout(() => {
        setStepNumber(0);
        setIsColored(false);
      }, 500);
    } else if (stepNumber > 1) {
      setStepNumber(stepNumber - 1);
    }
  };

  const handleStart = () => {
    bgSpillProgress.value = withTiming(1, { duration: 500 });
    setTimeout(() => {
      setStepNumber(1);
      setIsColored(true);
    }, 500);
  };

  const handlePanelLayout = (height: number) => {
    if (height > 0) {
      setPanelHeight(height);
    }
  };

  const isUsernameStep = step?.title === "What's your name?";
  const showImage = step?.showImage;

  const textColor = isColored ? "#ffffff" : theme.text;
  const textSecondaryColor = isColored ? "rgba(255, 255, 255, 0.8)" : theme.textSecondary;
  const backgroundElement = isColored ? "rgba(255, 255, 255, 0.2)" : theme.backgroundElement;
  const backgroundSelected = isColored ? "rgba(255, 255, 255, 0.3)" : theme.backgroundSelected;
  const buttonBg = isColored ? "#ffffff" : theme.accent;
  const buttonText = isColored ? theme.accent : "#ffffff";

  return (
    <View style={styles.container}>
      <View style={styles.introPanelWrapper}>
        <OnboardingIntroPanel 
          onPressStart={handleStart} 
          onLayout={handlePanelLayout}
        />
      </View>

      <Animated.View style={[styles.colorBg, colorBgAnimation]} />

      {!step && (
        <Animated.View 
          entering={FadeIn.delay(200)} 
          style={styles.phoneImageWrapper}
        >
          <View style={styles.imageClip}>
            <Image
              source={phoneImage}
              style={styles.phoneImage}
              resizeMode="contain"
            />
          </View>
        </Animated.View>
      )}

      {step && (
        <>
          <Animated.View entering={FadeIn} style={styles.close}>
            <Pressable style={styles.closeButton} onPress={handleClose}>
              <Text style={[styles.closeButtonText, { color: textColor }]}>Skip</Text>
            </Pressable>
          </Animated.View>

          {showImage && (
            <Animated.View style={styles.imageContainer}>
              <Image
                source={pairingImage}
                style={styles.stepImage}
                resizeMode="contain"
              />
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown} style={styles.stepContainer}>
            {isUsernameStep ? (
              <View style={[styles.panel, { backgroundColor: backgroundElement }]}>
                <View style={styles.textContainer}>
                  <View style={[styles.labelBadge, { backgroundColor: backgroundSelected }]}>
                    <Text style={[styles.labelText, { color: textColor }]}>{step.label}</Text>
                  </View>
                  <Text style={[styles.title, { color: textColor }]}>{step.title}</Text>
                  <Text style={[styles.description, { color: textSecondaryColor }]}>{step.description}</Text>
                </View>

                <TextInput
                  style={[
                    styles.usernameInput,
                    {
                      backgroundColor: isColored ? "rgba(255,255,255,0.15)" : theme.background,
                      color: textColor,
                      borderColor: backgroundSelected,
                    },
                  ]}
                  placeholder="Enter your name"
                  placeholderTextColor={textSecondaryColor}
                  value={username}
                  onChangeText={setUsernameState}
                  autoCapitalize="words"
                  autoCorrect={false}
                />

                <View style={styles.buttonRow}>
                  <Pressable
                    style={[
                      styles.backButton,
                      { backgroundColor: backgroundSelected },
                    ]}
                    onPress={handleBack}
                  >
                    <Text style={[styles.backButtonText, { color: textColor }]}>Back</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.nextButton,
                      styles.usernameNextButton,
                      { backgroundColor: buttonBg },
                    ]}
                    onPress={handleNext}
                  >
                    <Text style={[styles.nextButtonText, { color: buttonText }]}>
                      {step.buttonLabel}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={[styles.panel, { backgroundColor: backgroundElement }]}>
                <View style={styles.textContainer}>
                  <View style={[styles.labelBadge, { backgroundColor: backgroundSelected }]}>
                    <Text style={[styles.labelText, { color: textColor }]}>{step.label}</Text>
                  </View>
                  <Text style={[styles.title, { color: textColor }]}>{step.title}</Text>
                  <Text style={[styles.description, { color: textSecondaryColor }]}>{step.description}</Text>
                </View>
                <View style={styles.buttonRow}>
                  <Pressable
                    style={[
                      styles.backButton,
                      { backgroundColor: backgroundSelected },
                    ]}
                    onPress={handleBack}
                  >
                    <Text style={[styles.backButtonText, { color: textColor }]}>Back</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.nextButton,
                      { backgroundColor: buttonBg },
                    ]}
                    onPress={handleNext}
                  >
                    <Text style={[styles.nextButtonText, { color: buttonText }]}>
                      {step.buttonLabel}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </Animated.View>
        </>
      )}
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    introPanelWrapper: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingBottom: Platform.OS === "ios" ? 40 : 24,
    },
    colorBg: {
      position: "absolute",
      backgroundColor: theme.accent,
    },
phoneImageWrapper: {
      position: "absolute",
      top: 42,
      left: 20,
      right: 20,
      alignItems: "center",
    },
    imageClip: {
      height: 470,
      overflow: "hidden",
    },
    phoneImage: {
      top: 18,
      width: 350,
      height: 650,
    },
    imageContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 40,
    },
    stepImage: {
      width: "100%",
      height: "60%",
    },
    stepContainer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      padding: 16,
      paddingBottom: Platform.OS === "ios" ? 40 : 24,
    },
    close: {
      position: "absolute",
      top: Platform.OS === "ios" ? 60 : 40,
      right: 16,
      zIndex: 10,
    },
    closeButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    closeButtonText: {
      fontFamily: FontFamilies.normal.ibmPlexSans,
      fontSize: 16,
    },
    panel: {
      padding: 16,
      borderRadius: 18,
      gap: 20,
    },
    textContainer: {
      alignItems: "center",
      gap: 12,
    },
    labelBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
    },
    labelText: {
      fontFamily: FontFamilies.normal.ibmPlexSans,
      fontSize: 12,
      fontWeight: "500",
    },
    title: {
      fontFamily: FontFamilies.display.spaceGrotesk,
      fontSize: 22,
      fontWeight: "600",
      textAlign: "center",
    },
    description: {
      fontFamily: FontFamilies.normal.ibmPlexSans,
      fontSize: 16,
      textAlign: "center",
      lineHeight: 24,
    },
    usernameInput: {
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontFamily: FontFamilies.normal.ibmPlexSans,
      fontSize: 18,
      borderWidth: 1,
    },
    buttonRow: {
      flexDirection: "row",
      gap: 12,
    },
    backButton: {
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderRadius: 12,
    },
    backButtonText: {
      fontFamily: FontFamilies.normal.ibmPlexSans,
      fontSize: 16,
      fontWeight: "600",
    },
    nextButton: {
      flex: 1,
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
    },
    usernameNextButton: {
      flex: 1,
    },
    nextButtonText: {
      fontFamily: FontFamilies.normal.ibmPlexSans,
      fontSize: 16,
      fontWeight: "600",
    },
  });