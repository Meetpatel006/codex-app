import React, { useState, useMemo, useRef, useEffect } from "react";
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
import { useRouter, useLocalSearchParams } from "expo-router";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  FadeOutUp,
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
  captureTelemetryError,
  trackTelemetryEvent,
} from "@/services/telemetry";
import {
  markOnboardingComplete,
  setUsername,
} from "@/utils/onboarding";

const SCREEN_HEIGHT = Dimensions.get("screen").height;
const DEFAULT_PANEL_HEIGHT = 300;
const INITIAL_BG_BOTTOM = SCREEN_HEIGHT * 0.9;
const INITIAL_BG_PROGRESS = 0.6;
const SIDE_GAP = 50;
const TOP_GAP = 150;
const SIDE_GAP_ANIMATED = 0;
const TOP_GAP_ANIMATED = 0;
const STEP_CONTENT_EXIT_MS = 280;
const STEP_CONTENT_ENTER_DELAY_MS = 40;

const STEPS = [
  {
    label: "Connect",
    title: "Link with Codex Desktop",
    description:
      "Open your Codex Desktop app, go to Settings > Mobile, and scan the QR code or enter the 8-character code to pair your devices.",
    buttonLabel: "Got it, next",
    showImage: true,
    isUsernameStep: false,
  },
{
    label: "Workspace",
    title: "Switch Projects & Models",
    description:
      "Chat with any project. Choose different AI models with varying thinking levels. Navigate between projects effortlessly and track your usage in real-time.",
    buttonLabel: "Next",
    showImage: true,
    isUsernameStep: false,
  },
  {
    label: "Git",
    title: "Git & Branch Management",
    description:
      "Monitor all git activity. View branches, create new branches, and make commits directly from your mobile. Stay connected to your repo anywhere.",
    buttonLabel: "Next",
    showImage: true,
    isUsernameStep: false,
  },
  {
    label: "Username",
    title: "What's your name?",
    description:
      "This will be shown on your Codex Desktop app when you're connected.",
    buttonLabel: "Continue to pairing",
    showImage: false,
    isUsernameStep: true,
  },
];

const pairingImage = require("../../../assets/images/pairing-guide.png");
const phoneImage = require("../../../assets/images/01-chat-en-website-blue-iphone-1284x2778.png");
const switchProjectImage = require("../../../assets/images/02-sidebar-en-website-blue-iphone-1284x2778.png");
const gitImage = require("../../../assets/images/01-git-en-website-blue-iphone-1284x2778.png");

export function OnboardingScreen() {
  const router = useRouter();
  const { step: stepNum } = useLocalSearchParams<{ step?: string }>();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [isColored, setIsColored] = useState(false);
  const [panelHeight, setPanelHeight] = useState(DEFAULT_PANEL_HEIGHT);
  const bgSpillProgress = useSharedValue(INITIAL_BG_PROGRESS);
  const [showIntroPhoneImage, setShowIntroPhoneImage] = useState(true);

const [stepNumber, setStepNumber] = useState(stepNum ? parseInt(stepNum, 10) : 0);
  const [showStepContent, setShowStepContent] = useState(!!stepNum);
  const [isStepTransitioning, setIsStepTransitioning] = useState(false);
  const [username, setUsernameState] = useState("");
  const [isUsernameInputFocused, setIsUsernameInputFocused] = useState(false);
  const isUsernameValid = username.trim().length > 0;
  const step = stepNumber > 0 ? STEPS[stepNumber - 1] : null;
  const usernameInputRef = useRef<TextInput>(null);
  const isUsernameStep = Boolean(step?.isUsernameStep);

  const currentStepLabel = step?.label?.toLowerCase() || "intro";

  const getStepEventProperties = () => ({
    step_number: stepNumber,
    step_label: currentStepLabel,
    is_username_step: isUsernameStep,
    has_username_value: username.trim().length > 0,
  });

useEffect(() => {
    trackTelemetryEvent("onboarding_intro_viewed");
  }, []);

  useEffect(() => {
    if (stepNum) {
      const stepNumVal = parseInt(stepNum, 10);
      if (stepNumVal > 0) {
        setShowIntroPhoneImage(false);
        bgSpillProgress.value = withTiming(1, { duration: 500 });
        setTimeout(() => {
          setStepNumber(stepNumVal);
          setIsColored(true);
          setShowStepContent(true);
        }, 500);
      }
    }
  }, []);

  useEffect(() => {
    if (!step || !showStepContent) {
      return;
    }

    trackTelemetryEvent("onboarding_step_viewed", {
      step_number: stepNumber,
      step_label: currentStepLabel,
      is_username_step: isUsernameStep,
      has_username_value: username.trim().length > 0,
    });
  }, [stepNumber, showStepContent]);

  useEffect(() => {
    if (!isUsernameStep) {
      setIsUsernameInputFocused(false);
      return;
    }

    if (showStepContent) {
      setTimeout(() => {
        usernameInputRef.current?.focus();
      }, 300);
    }
  }, [isUsernameStep, showStepContent]);
   
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
      borderRadius: interpolate(bgSpillProgress.value, [0, 1], [40, 0]),
    };
  });

const handleClose = () => {
    trackTelemetryEvent("onboarding_skipped", getStepEventProperties());
    void markOnboardingComplete().catch((error) => {
      captureTelemetryError(error, {
        area: "onboarding_skip_persist_completion",
        properties: getStepEventProperties(),
      });
      console.warn("[mobile][onboarding] failed to persist completion on skip", error);
    });
    router.push("/onboarding?step=4");
  };

  const handleNext = async () => {
    if (isStepTransitioning) {
      return;
    }

    if (isUsernameStep && !isUsernameValid) {
      trackTelemetryEvent("onboarding_username_validation_failed", {
        ...getStepEventProperties(),
        username_length: username.trim().length,
      });
      return;
    }

    if (stepNumber === STEPS.length) {
      trackTelemetryEvent("onboarding_completed", {
        ...getStepEventProperties(),
        username_length: username.trim().length,
      });

      if (isUsernameStep) {
        await setUsername(username.trim()).catch((error) => {
          captureTelemetryError(error, {
            area: "onboarding_persist_username",
            properties: {
              ...getStepEventProperties(),
              username_length: username.trim().length,
            },
          });
          console.warn("[mobile][onboarding] failed to persist username", error);
        });
      }

      await markOnboardingComplete().catch((error) => {
        captureTelemetryError(error, {
          area: "onboarding_persist_completion",
          properties: getStepEventProperties(),
        });
        console.warn("[mobile][onboarding] failed to persist completion", error);
      });
      router.replace("/");
    } else {
      trackTelemetryEvent("onboarding_step_next", getStepEventProperties());
      setIsStepTransitioning(true);
      setShowStepContent(false);
      setTimeout(() => {
        setStepNumber((current) => current + 1);
        setTimeout(() => {
          setShowStepContent(true);
          setIsStepTransitioning(false);
        }, STEP_CONTENT_ENTER_DELAY_MS);
      }, STEP_CONTENT_EXIT_MS);
    }
  };

  const handleBack = () => {
    if (isStepTransitioning) {
      return;
    }

    if (stepNumber === 1) {
      trackTelemetryEvent("onboarding_step_back", getStepEventProperties());
      setIsStepTransitioning(true);
      setShowStepContent(false);
      setTimeout(() => {
        setStepNumber(0);
        setIsColored(false);
        setShowIntroPhoneImage(true);
        bgSpillProgress.value = withTiming(INITIAL_BG_PROGRESS, { duration: 500 });
        setTimeout(() => {
          setIsStepTransitioning(false);
        }, 500);
      }, STEP_CONTENT_EXIT_MS);
    } else if (stepNumber > 1) {
      trackTelemetryEvent("onboarding_step_back", getStepEventProperties());
      setIsStepTransitioning(true);
      setShowStepContent(false);
      setTimeout(() => {
        setStepNumber((current) => current - 1);
        setTimeout(() => {
          setShowStepContent(true);
          setIsStepTransitioning(false);
        }, STEP_CONTENT_ENTER_DELAY_MS);
      }, STEP_CONTENT_EXIT_MS);
    }
  };

  const handleStart = () => {
    trackTelemetryEvent("onboarding_started", getStepEventProperties());
    setShowIntroPhoneImage(false);
    bgSpillProgress.value = withTiming(1, { duration: 500 });
    setTimeout(() => {
      setStepNumber(1);
      setIsColored(true);
      setShowStepContent(true);
    }, 500);
  };

  const handlePanelLayout = (height: number) => {
    if (height > 0) {
      setPanelHeight(height);
    }
  };

  const showImage = step?.showImage;

  const stepImage = stepNumber === 2 ? switchProjectImage : stepNumber === 3 ? gitImage : pairingImage;

  const textColor = isColored ? "#ffffff" : theme.text;
  const textSecondaryColor = isColored ? "rgba(255, 255, 255, 0.8)" : theme.textSecondary;
  const backgroundElement = isColored ? "#1f2b63" : theme.backgroundElement;
  const backgroundSelected = isColored ? "#3a4f9d" : theme.backgroundSelected;
  const buttonBg = isColored ? "#f3f5ff" : theme.accent;
  const buttonText = isColored ? "#3a4f9d" : "#ffffff";
  const introPurpleBottomInset = INITIAL_BG_BOTTOM * (1 - INITIAL_BG_PROGRESS);
  const introImageBottomOffset = introPurpleBottomInset;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.introPanelWrapper,
          { top: SCREEN_HEIGHT - introPurpleBottomInset + 15 },
        ]}
      >
        <OnboardingIntroPanel 
          onPressStart={handleStart} 
          onLayout={handlePanelLayout}
        />
      </View>

      <Animated.View style={[styles.colorBg, colorBgAnimation]} />

      {!step && showIntroPhoneImage && (
        <Animated.View 
          entering={FadeIn.duration(240)}
          exiting={FadeOutUp.duration(280)}
          style={[styles.phoneImageWrapper, { bottom: introImageBottomOffset }]}
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

      {step && showStepContent && (
        <>
          <Animated.View
            entering={FadeIn}
            exiting={FadeOut.duration(200)}
            style={styles.close}
          >
            <Pressable style={styles.closeButton} onPress={handleClose} hitSlop={10}>
              <Text style={[styles.closeButtonText, { color: textColor }]}>Skip</Text>
            </Pressable>
          </Animated.View>

          {showImage && (
            <Animated.View
              entering={FadeIn.delay(200)}
              exiting={FadeOutUp.duration(280)}
              style={styles.imageContainer}
            >
              <Image
                source={stepImage}
                style={styles.stepImageFixed}
                resizeMode="contain"
              />
            </Animated.View>
          )}

          <Animated.View
            entering={FadeInDown}
            exiting={FadeOutDown.duration(260)}
            style={
              isUsernameStep
                ? [
                    styles.usernameStepContainer,
                    isUsernameInputFocused && styles.usernameStepContainerFocused,
                  ]
                : styles.stepContainer
            }
          >
            {isUsernameStep ? (
              <View style={[styles.usernamePanel, { backgroundColor: backgroundElement }]}>
                <View style={styles.usernameHeader}>
                  <Text style={[styles.usernameTitle, { color: textColor }]}>
                    What's your name?
                  </Text>
                  <Text style={[styles.usernameSubtitle, { color: textSecondaryColor }]}>
                    This will be shown on your Codex Desktop app
                  </Text>
                </View>

                <View style={styles.usernameInputWrapper}>
                  <TextInput
                    ref={usernameInputRef}
                    style={[
                      styles.usernameInput,
                      {
                        backgroundColor: isColored ? "rgba(255,255,255,0.1)" : theme.background,
                        color: textColor,
                        borderColor: isColored ? "rgba(255,255,255,0.2)" : theme.backgroundSelected,
                      },
                    ]}
                    placeholder="Enter your name"
                    placeholderTextColor={textSecondaryColor}
                    value={username}
                    onChangeText={setUsernameState}
                    autoCapitalize="words"
                    autoCorrect={false}
                    maxLength={30}
                    selectionColor={theme.accent}
                    onFocus={() => setIsUsernameInputFocused(true)}
                    onBlur={() => setIsUsernameInputFocused(false)}
                  />
                  <Text style={[styles.usernameCharCount, { color: textSecondaryColor }]}>
                    {username.length}/30
                  </Text>
                </View>

                <View style={styles.usernameButtonRow}>
                  <Pressable
                    style={[
                      styles.usernameBackButton,
                      { backgroundColor: backgroundSelected },
                    ]}
                    onPress={handleBack}
                  >
                    <Text style={[styles.usernameBackText, { color: textColor }]}>
                      Go back
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.usernameContinueButton,
                      { backgroundColor: buttonBg },
                      !isUsernameValid && styles.usernameContinueButtonDisabled,
                    ]}
                    onPress={handleNext}
                    disabled={!isUsernameValid || isStepTransitioning}
                  >
                    <Text style={[styles.usernameContinueText, { color: buttonText }]}>{step.buttonLabel}</Text>
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
      left: 0,
      right: 0,
      paddingBottom: Platform.OS === "ios" ? 26 : 18,
    },
    colorBg: {
      position: "absolute",
      backgroundColor: theme.accent,
    },
    phoneImageWrapper: {
      position: "absolute",
      left: 20,
      right: 20,
      alignItems: "center",
    },
    imageClip: {
      width: "100%",
      maxWidth: 360,
      height: 470,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "flex-start",
    },
    phoneImage: {
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
    stepImageFixed: {
      width: 550,
      height: 700,
    },
    stepImageLarge: {
      width: 550,
      height: 700,
    },
    stepContainer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      padding: 16,
      paddingBottom: Platform.OS === "ios" ? 40 : 24,
    },
    usernameStepContainer: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 16,
      right: 16,
      justifyContent: "center",
    },
    usernameStepContainerFocused: {
      justifyContent: "flex-end",
      paddingBottom: 370,
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
    usernamePanel: {
      padding: 20,
      borderRadius: 20,
      gap: 16,
    },
    usernameButtonRow: {
      flexDirection: "row",
      gap: 12,
    },
    usernameHeader: {
      alignItems: "center",
      gap: 8,
    },
    usernameTitle: {
      fontFamily: FontFamilies.display.spaceGrotesk,
      fontSize: 26,
      fontWeight: "700",
      textAlign: "center",
    },
    usernameSubtitle: {
      fontFamily: FontFamilies.normal.ibmPlexSans,
      fontSize: 15,
      textAlign: "center",
      lineHeight: 22,
    },
    usernameInputWrapper: {
      gap: 8,
    },
    usernameCharCount: {
      fontFamily: FontFamilies.normal.ibmPlexSans,
      fontSize: 12,
      textAlign: "right",
    },
    usernameContinueButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
    },
    usernameContinueButtonDisabled: {
      opacity: 0.55,
    },
    usernameContinueText: {
      fontFamily: FontFamilies.normal.ibmPlexSans,
      fontSize: 16,
      fontWeight: "600",
    },
    usernameBackButton: {
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderRadius: 12,
    },
    usernameBackText: {
      fontFamily: FontFamilies.normal.ibmPlexSans,
      fontSize: 16,
      fontWeight: "600",
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
