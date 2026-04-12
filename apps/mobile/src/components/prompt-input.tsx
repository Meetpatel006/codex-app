import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  Animated,
  TextInput,
  Text,
  Keyboard,
  KeyboardAvoidingView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SymbolView } from "expo-symbols";
import { FontFamilies } from "@/constants/fonts";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { PromptExtras } from "./prompt-extras";
import { ModelSelector } from "./model-selector";
import { ReasoningSelector } from "./reasoning-selector";

const PILL_HEIGHT = 56;
const EXPANDED_HEIGHT = 130;
const ANIMATION_DURATION = 280;

interface PromptInputProps {
  onSend?: (text: string) => void;
  onFocusChange?: (isFocused: boolean) => void;
  onKeyboardHeightChange?: (height: number) => void;
  onExpandedChange?: (isExpanded: boolean) => void;
}

export function PromptInput({
  onSend,
  onFocusChange,
  onKeyboardHeightChange,
  onExpandedChange,
}: PromptInputProps) {
  const [prompt, setPrompt] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const isFocusedRef = useRef(false);
  const isDropdownOpenRef = useRef(false);
  const theme = useTheme();
  const inputRef = useRef<TextInput>(null);

  // Animation values
  const heightAnim = useRef(new Animated.Value(PILL_HEIGHT)).current;
  const borderRadiusAnim = useRef(new Animated.Value(PILL_HEIGHT / 2)).current;
  const pillOpacity = useRef(new Animated.Value(1)).current;
  const expandedOpacity = useRef(new Animated.Value(0)).current;
  const extrasOpacity = useRef(new Animated.Value(0)).current;
  const extrasTranslate = useRef(new Animated.Value(8)).current;
  const keyboardHeightAnim = useRef(new Animated.Value(0)).current;

  // Sync keyboard height
  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      Animated.spring(keyboardHeightAnim, {
        toValue: e.endCoordinates.height,
        useNativeDriver: false,
        damping: 28,
        stiffness: 200,
      }).start();
      onKeyboardHeightChange?.(e.endCoordinates.height);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      Animated.spring(keyboardHeightAnim, {
        toValue: 0,
        useNativeDriver: false,
        damping: 28,
        stiffness: 200,
      }).start();
      onKeyboardHeightChange?.(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const animateToFocused = useCallback(() => {
    isFocusedRef.current = true;
    setIsFocused(true);
    onFocusChange?.(true);
    Animated.parallel([
      Animated.timing(pillOpacity, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.spring(heightAnim, {
        toValue: EXPANDED_HEIGHT,
        useNativeDriver: false,
        damping: 20,
        stiffness: 200,
      }),
      Animated.spring(borderRadiusAnim, {
        toValue: 28,
        useNativeDriver: false,
        damping: 20,
        stiffness: 200,
      }),
      Animated.sequence([
        Animated.delay(100),
        Animated.timing(expandedOpacity, {
          toValue: 1,
          duration: ANIMATION_DURATION - 100,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(160),
        Animated.parallel([
          Animated.timing(extrasOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(extrasTranslate, {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
  }, []);

  const animateToCollapsed = useCallback(() => {
    if (!isFocusedRef.current) return;
    if (isDropdownOpenRef.current) {
      return;
    }
    isFocusedRef.current = false;
    inputRef.current?.blur();
    Animated.parallel([
      Animated.timing(extrasOpacity, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(extrasTranslate, {
        toValue: 8,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(expandedOpacity, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.spring(heightAnim, {
        toValue: PILL_HEIGHT,
        useNativeDriver: false,
        damping: 22,
        stiffness: 220,
      }),
      Animated.spring(borderRadiusAnim, {
        toValue: PILL_HEIGHT / 2,
        useNativeDriver: false,
        damping: 22,
        stiffness: 220,
      }),
      Animated.sequence([
        Animated.delay(120),
        Animated.timing(pillOpacity, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setIsFocused(false);
      onFocusChange?.(false);
    });
  }, [isDropdownOpenRef]);

  // Collapse when keyboard hides (user taps outside or swipes down)
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidHide", animateToCollapsed);
    return () => sub.remove();
  }, [animateToCollapsed]);

  const handleFocus = useCallback(() => {
    animateToFocused();
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [animateToFocused]);

  const handleSend = () => {
    if (prompt.trim()) {
      onSend?.(prompt);
      setPrompt("");
    }
  };

  return (
    <Animated.View
      style={[styles.keyboardAvoidingView, { bottom: keyboardHeightAnim }]}
    >
      <LinearGradient
        colors={["transparent", theme.background, theme.background]}
        locations={[0, 1, 1]}
        style={styles.gradientContainer}
      >
        <View style={styles.paddingContainer}>
          {/* Animated container */}
          <Animated.View
            style={[
              styles.innerContainer,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.backgroundSelected,
                height: heightAnim,
                borderRadius: borderRadiusAnim,
              },
            ]}
          >
            {/* PILL MODE — unfocused */}
            <Animated.View
              pointerEvents={isFocused ? "none" : "box-none"}
              style={[styles.pillRow, { opacity: pillOpacity }]}
            >
              <Pressable onPress={handleFocus} style={styles.pillButton}>
                <SymbolView
                  name={{ ios: "plus", android: "add", web: "add" }}
                  tintColor={theme.textSecondary}
                  size={20}
                  weight="bold"
                />
              </Pressable>

              <Pressable onPress={handleFocus} style={styles.pillCenter}>
                <Text
                  style={[
                    styles.pillPlaceholder,
                    { color: theme.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  Ask anything...
                </Text>
              </Pressable>

              <Pressable style={styles.pillButton}>
                <SymbolView
                  name={{ ios: "mic.fill", android: "mic", web: "mic" }}
                  tintColor={theme.textSecondary}
                  size={20}
                />
              </Pressable>

              <Pressable
                onPress={handleSend}
                style={[
                  styles.pillSendButton,
                  { backgroundColor: theme.userBubble },
                ]}
              >
                <SymbolView
                  name={{
                    ios: "arrow.up",
                    android: "arrow_upward",
                    web: "arrow_upward",
                  }}
                  tintColor={theme.userText}
                  size={16}
                  weight="bold"
                />
              </Pressable>
            </Animated.View>

            {/* EXPANDED MODE — focused */}
            <Animated.View
              pointerEvents={isFocused ? "box-none" : "none"}
              style={[styles.expandedContent, { opacity: expandedOpacity }]}
            >
              <TextInput
                ref={inputRef}
                placeholder="Type your prompt..."
                value={prompt}
                onChangeText={setPrompt}
                style={[styles.input, { color: theme.text }]}
                placeholderTextColor={theme.textSecondary}
                multiline={true}
                textAlignVertical="top"
              />

              <View style={styles.bottomActions}>
                <View style={styles.leftActions}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.actionButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <SymbolView
                      name={{ ios: "plus", android: "add", web: "add" }}
                      tintColor={theme.textSecondary}
                      size={20}
                      weight="bold"
                    />
                  </Pressable>
                  <ModelSelector
                    onDropdownOpen={() => {
                      isDropdownOpenRef.current = true;
                      onExpandedChange?.(true);
                    }}
                    onDropdownClose={() => {
                      isDropdownOpenRef.current = false;
                      onExpandedChange?.(false);
                    }}
                  />
                  <ReasoningSelector
                    onDropdownOpen={() => {
                      isDropdownOpenRef.current = true;
                      onExpandedChange?.(true);
                    }}
                    onDropdownClose={() => {
                      isDropdownOpenRef.current = false;
                      onExpandedChange?.(false);
                    }}
                  />
                </View>

                <View style={styles.rightActions}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.actionButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <SymbolView
                      name={{ ios: "mic.fill", android: "mic", web: "mic" }}
                      tintColor={theme.textSecondary}
                      size={20}
                    />
                  </Pressable>
                  <Pressable
                    onPress={handleSend}
                    style={({ pressed }) => [
                      styles.sendButton,
                      { backgroundColor: theme.userBubble },
                      pressed && styles.pressed,
                    ]}
                  >
                    <SymbolView
                      name={{
                        ios: "arrow.up",
                        android: "arrow_upward",
                        web: "arrow_upward",
                      }}
                      tintColor={theme.userText}
                      size={18}
                      weight="bold"
                    />
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          </Animated.View>

          {/* Prompt Extras — animated in/out */}
          <Animated.View
            pointerEvents={isFocused ? "box-none" : "none"}
            style={{
              opacity: extrasOpacity,
              transform: [{ translateY: extrasTranslate }],
            }}
          >
            <PromptExtras
              onDropdownOpen={() => {
                isDropdownOpenRef.current = true;
                onExpandedChange?.(true);
              }}
              onDropdownClose={() => {
                isDropdownOpenRef.current = false;
                onExpandedChange?.(false);
              }}
            />
          </Animated.View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  gradientContainer: {
    width: "100%",
  },
  paddingContainer: {
    paddingHorizontal: 10,
    paddingBottom: Platform.OS === "ios" ? 10 : Spacing.two,
  },
  innerContainer: {
    borderWidth: 1,
    overflow: "hidden",
    justifyContent: "center",
  },

  // --- PILL ---
  pillRow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.two,
    gap: Spacing.one,
  },
  pillButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  pillCenter: {
    flex: 1,
    height: "100%",
    justifyContent: "center",
    paddingHorizontal: Spacing.two,
  },
  pillPlaceholder: {
    fontSize: 16,
    fontFamily: FontFamilies.normal.ibmPlexSans,
  },
  pillSendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },

  expandedContent: {
    flex: 1,
    flexDirection: "column",
  },
  input: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    fontSize: 16,
    fontFamily: FontFamilies.normal.ibmPlexSans,
    flex: 1,
    textAlignVertical: "top",
  },
  bottomActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.half,
    paddingBottom: Spacing.one,
    paddingTop: Spacing.one,
  },
  leftActions: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: Spacing.half,
    flexShrink: 1,
    minWidth: 0,
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    marginRight: Spacing.half,
  },
  actionButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  pressed: {
    opacity: 0.7,
  },
});
