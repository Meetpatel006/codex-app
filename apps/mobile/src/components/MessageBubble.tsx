import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CodeBlockView } from "./CodeBlockView";
import { CommandExecutionCard } from "./CommandExecutionCard";
import { CommandExecutionGroup } from "./CommandExecutionGroup";
import { DiffBlockView } from "./DiffBlockView";
import { FileChangeCard } from "./FileChangeCard";
import { MarkdownText } from "./MarkdownText";
import { ThinkingIndicator, ThinkingText } from "./ThinkingIndicator";
import {
  parseInlineMentions,
  parseMarkdownSegments,
} from "@/utils/markdown-parser";
import type { CommandExecutionData, FileChangeData } from "@/store/chat";
import { useDiffStore } from "@/store/diff";
import { useSessionStore } from "@/store/session";
import { useUiStore } from "@/store/ui";
import { parseUnifiedDiff } from "@/utils/diff";
import { useTheme } from "@/hooks/use-theme";

type Props = {
  role: "user" | "assistant" | "system";
  text: string;
  streaming?: boolean;
  kind?: "thinking" | "file-change" | "plan" | "command-execution" | "normal";
  deliveryState?: "sending" | "sent" | "failed";
  commandExecution?: CommandExecutionData;
  commandExecutions?: CommandExecutionData[];
  fileChanges?: FileChangeData[];
};

export function MessageBubble({
  role,
  text,
  streaming = false,
  kind = "normal",
  deliveryState = "sent",
  commandExecution,
  commandExecutions,
  fileChanges,
}: Props) {
  const colors = useTheme();
  const isUser = role === "user";
  const isAssistant = role === "assistant";
  const isSystem = role === "system";
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setDiffSnapshot = useDiffStore((state) => state.setDiffSnapshot);
  const openDiffPanel = useUiStore((state) => state.openDiffPanel);

  const themedStyles = useMemo(() => createStyles(colors), [colors]);

  function openAssistantDiff(diffText: string) {
    if (!activeSessionId) {
      return;
    }

    const parsedFiles = parseUnifiedDiff(diffText);
    if (parsedFiles.length === 0) {
      return;
    }

    setDiffSnapshot(activeSessionId, parsedFiles, {
      preserveSelection: false,
    });
    openDiffPanel();
  }

  // Render user message
  if (isUser) {
    return (
      <View style={themedStyles.userWrapper}>
        <View style={themedStyles.userBubble}>
          <Text style={themedStyles.userText}>
            {parseInlineMentions(text).map((token, index) => {
              if (token.type === "file") {
                return (
                  <Text key={index} style={themedStyles.userFileMention}>
                    {token.content}
                  </Text>
                );
              }
              if (token.type === "skill") {
                return (
                  <Text key={index} style={themedStyles.userSkillMention}>
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
                themedStyles.deliveryStatus,
                deliveryState === "failed" && themedStyles.deliveryFailed,
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
        <View style={themedStyles.systemWrapper}>
          {text.trim() && text.trim() !== "Thinking..." ? (
            <Text style={themedStyles.systemText}>{text}</Text>
          ) : (
            <ThinkingText streaming={streaming} />
          )}
        </View>
      );
    }

    if (
      kind === "command-execution" &&
      commandExecutions &&
      commandExecutions.length > 0
    ) {
      return (
        <View style={themedStyles.systemWrapper}>
          <CommandExecutionGroup commands={commandExecutions} />
        </View>
      );
    }

    if (kind === "command-execution" && commandExecution) {
      return (
        <View style={themedStyles.systemWrapper}>
          <CommandExecutionCard {...commandExecution} />
        </View>
      );
    }

    if (kind === "file-change" && fileChanges && fileChanges.length > 0) {
      return (
        <View style={themedStyles.systemWrapper}>
          <FileChangeCard changes={fileChanges} />
        </View>
      );
    }

    if (kind === "plan") {
      return (
        <View style={themedStyles.systemWrapper}>
          <Text style={themedStyles.systemText}>📋 {text}</Text>
        </View>
      );
    }

    return (
      <View style={themedStyles.systemWrapper}>
        <Text style={themedStyles.systemText}>{text}</Text>
      </View>
    );
  }

  // Render assistant message with markdown
  if (isAssistant) {
    const segments = parseMarkdownSegments(text);

    return (
      <View style={themedStyles.assistantWrapper}>
        {segments.map((segment, index) => {
          if (segment.type === "codeBlock") {
            if (segment.isDiff) {
              return (
                <DiffBlockView
                  key={index}
                  language={segment.language}
                  code={segment.content}
                  onOpenDiff={() => openAssistantDiff(segment.content)}
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

const createStyles = (colors: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    // User message styles
    userWrapper: {
      alignItems: "flex-end",
      marginVertical: 0,
    },
    userBubble: {
      maxWidth: "85%",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 24,
      backgroundColor: colors.userBubble,
      borderWidth: 1,
      borderColor: colors.userBubbleBorder,
    },
    userText: {
      color: colors.userText,
      fontSize: 14,
      lineHeight: 20,
    },
    userFileMention: {
      color: colors.fileMention,
      fontWeight: "500",
    },
    userSkillMention: {
      color: colors.skillMention,
      fontWeight: "500",
    },
    deliveryStatus: {
      color: colors.systemText,
      fontSize: 11,
      marginTop: 4,
    },
    deliveryFailed: {
      color: colors.errorColor,
    },

    // Assistant message styles
    assistantWrapper: {
      alignItems: "flex-start",
      marginVertical: 0,
      width: "100%",
      maxWidth: 760,
    },

    // System message styles
    systemWrapper: {
      alignItems: "flex-start",
      marginVertical: 0,
      paddingHorizontal: 8,
    },
    systemText: {
      color: colors.systemText,
      fontSize: 12,
      fontStyle: "italic",
    },
  });
