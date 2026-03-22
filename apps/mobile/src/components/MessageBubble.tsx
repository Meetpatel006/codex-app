import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { CodeBlockView } from "./CodeBlockView";
import { CommandExecutionCard } from "./CommandExecutionCard";
import { DiffBlockView } from "./DiffBlockView";
import { FileChangeCard } from "./FileChangeCard";
import { MarkdownText } from "./MarkdownText";
import { ThinkingIndicator, ThinkingText } from "./ThinkingIndicator";
import {
  parseInlineMentions,
  parseMarkdownSegments,
} from "@/utils/markdown-parser";
import type { CommandExecutionData, FileChangeData } from "@/store/chat";

type Props = {
  role: "user" | "assistant" | "system";
  text: string;
  streaming?: boolean;
  kind?: "thinking" | "file-change" | "plan" | "command-execution" | "normal";
  deliveryState?: "sending" | "sent" | "failed";
  commandExecution?: CommandExecutionData;
  fileChanges?: FileChangeData[];
};


export function MessageBubble({
  role,
  text,
  streaming = false,
  kind = "normal",
  deliveryState = "sent",
  commandExecution,
  fileChanges,
}: Props) {
  const isUser = role === "user";
  const isAssistant = role === "assistant";
  const isSystem = role === "system";

  // Render user message
  if (isUser) {
    return (
      <View style={styles.userWrapper}>
        <View style={styles.userBubble}>
          <Text style={styles.userText}>
            {parseInlineMentions(text).map((token, index) => {
              if (token.type === "file") {
                return (
                  <Text key={index} style={styles.userFileMention}>
                    {token.content}
                  </Text>
                );
              }
              if (token.type === "skill") {
                return (
                  <Text key={index} style={styles.userSkillMention}>
                    {token.content}
                  </Text>
                );
              }
              return <Text key={index}>{token.content}</Text>;
            })}
          </Text>
          {deliveryState !== "sent" && (
            <Text
              style={[
                styles.deliveryStatus,
                deliveryState === "failed" && styles.deliveryFailed,
              ]}
            >
              {deliveryState === "sending" ? "sending..." : "send failed"}
            </Text>
          )}
        </View>
      </View>
    );
  }

  // Render system message
  if (isSystem) {
    if (kind === "thinking") {
      return (
        <View style={styles.systemWrapper}>
          {text.trim() && text.trim() !== "Thinking..." ? (
            <Text style={styles.systemText}>{text}</Text>
          ) : (
            <ThinkingText streaming={streaming} />
          )}
        </View>
      );
    }

    if (kind === "command-execution" && commandExecution) {
      return (
        <View style={styles.systemWrapper}>
          <CommandExecutionCard {...commandExecution} />
        </View>
      );
    }

    if (kind === "file-change" && fileChanges && fileChanges.length > 0) {
      return (
        <View style={styles.systemWrapper}>
          <FileChangeCard changes={fileChanges} />
        </View>
      );
    }

    if (kind === "plan") {
      return (
        <View style={styles.systemWrapper}>
          <Text style={styles.systemText}>📋 {text}</Text>
        </View>
      );
    }

    return (
      <View style={styles.systemWrapper}>
        <Text style={styles.systemText}>{text}</Text>
      </View>
    );
  }

  // Render assistant message with markdown
  if (isAssistant) {
    const segments = parseMarkdownSegments(text);

    return (
      <View style={styles.assistantWrapper}>
        {segments.map((segment, index) => {
          if (segment.type === "codeBlock") {
            if (segment.isDiff) {
              return (
                <DiffBlockView
                  key={index}
                  language={segment.language}
                  code={segment.content}
                />
              );
            }
            return (
              <CodeBlockView
                key={index}
                language={segment.language}
                code={segment.content}
              />
            );
          }

          return <MarkdownText key={index} content={segment.content} />;
        })}
        {streaming && <ThinkingIndicator visible={streaming} />}
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  // User message styles
  userWrapper: {
    alignItems: "flex-end",
    marginVertical: 10,
  },
  userBubble: {
    maxWidth: "85%",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: "rgba(47, 79, 143, 0.8)", // tertiarySystemFill equivalent
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  userText: {
    color: "#f5f5f5",
    fontSize: 14,
    lineHeight: 20,
  },
  userFileMention: {
    color: "#7fc7ff",
    fontWeight: "500",
  },
  userSkillMention: {
    color: "#d4a5ff",
    fontWeight: "500",
  },
  deliveryStatus: {
    color: "#9f9f9f",
    fontSize: 11,
    marginTop: 4,
  },
  deliveryFailed: {
    color: "#ff9d9d",
  },

  // Assistant message styles
  assistantWrapper: {
    alignItems: "flex-start",
    marginVertical: 10,
    maxWidth: "95%",
  },

  // System message styles
  systemWrapper: {
    alignItems: "flex-start",
    marginVertical: 6,
    paddingHorizontal: 8,
  },
  systemText: {
    color: "#9f9f9f",
    fontSize: 12,
    fontStyle: "italic",
  },
});
