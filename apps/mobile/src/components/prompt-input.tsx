import React, { useState } from "react";
import { View, StyleSheet, Pressable, Platform } from "react-native";
import { SymbolView } from "expo-symbols";
import { Input } from "./ui/input";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { PromptExtras } from "./prompt-extras";
import { ModelSelector } from "./model-selector";
import { ReasoningSelector } from "./reasoning-selector";

interface PromptInputProps {
  onSend?: (text: string) => void;
}

export function PromptInput({ onSend }: PromptInputProps) {
  const [prompt, setPrompt] = useState("");
  const theme = useTheme();

  const handleSend = () => {
    if (prompt.trim()) {
      onSend?.(prompt);
      setPrompt("");
    }
  };

  return (
    <View style={styles.paddingContainer}>
      <View
        style={[
          styles.innerContainer,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.backgroundSelected,
          },
        ]}
      >
        <Input
          placeholder="Type your prompt..."
          value={prompt}
          onChangeText={setPrompt}
          style={styles.input}
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
            <ModelSelector />
            <ReasoningSelector />
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
                { backgroundColor: theme.text },
                pressed && styles.pressed,
              ]}
            >
              <SymbolView
                name={{
                  ios: "arrow.up",
                  android: "arrow_upward",
                  web: "arrow_upward",
                }}
                tintColor={theme.background}
                size={18}
                weight="bold"
              />
            </Pressable>
          </View>
        </View>
      </View>
      <PromptExtras />
    </View>
  );
}

const styles = StyleSheet.create({
  paddingContainer: {
    paddingHorizontal: 10,
    paddingBottom: Platform.OS === "ios" ? 20 : Spacing.four,
  },
  innerContainer: {
    flexDirection: "column",
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.one,
    minHeight: 100,
    maxHeight: 250,
    justifyContent: "flex-start",
  },
  input: {
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.one,
    fontSize: 16,
    minHeight: 50,
  },
  bottomActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "auto",
    paddingTop: Spacing.one,
  },
  leftActions: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: Spacing.half,
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    marginRight: Spacing.half,
  },
  actionButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  pressed: {
    opacity: 0.7,
  },
});
