import React, { useMemo } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { EnrichedMarkdownText } from "react-native-enriched-markdown";
import type { MarkdownStyle } from "react-native-enriched-markdown";
import { CodeBlockView } from "./CodeBlockView";
import { CommandExecutionCard } from "./CommandExecutionCard";
import { CommandExecutionGroup } from "./CommandExecutionGroup";
import { DiffBlockView } from "./DiffBlockView";
import { FileChangeCard } from "./FileChangeCard";
import { ApprovalCard } from "./ApprovalCard";
import { ApprovalStatusCard } from "./ApprovalStatusCard";
import { ThinkingIndicator, ThinkingText } from "./ThinkingIndicator";
import { FontFamilies } from "@/constants/fonts";
import {
  parseInlineMentions,
  parseMarkdownSegments,
} from "@/utils/markdown-parser";
import type {
  CommandExecutionData,
  FileChangeData,
  ApprovalRequestData,
} from "@/store/chat";
import { useDiffStore } from "@/store/diff";
import { useSessionStore } from "@/store/session";
import { useUiStore } from "@/store/ui";
import { parseUnifiedDiff } from "@/utils/diff";
import { useTheme } from "@/hooks/use-theme";

type Props = {
  role: "user" | "assistant" | "system";
  text: string;
  streaming?: boolean;
  kind?:
    | "thinking"
    | "file-change"
    | "plan"
    | "command-execution"
    | "approval"
    | "normal";
  deliveryState?: "sending" | "sent" | "failed";
  commandExecution?: CommandExecutionData;
  commandExecutions?: CommandExecutionData[];
  fileChanges?: FileChangeData[];
  approvalRequest?: ApprovalRequestData;
  onApprove?: () => void;
  onReject?: () => void;
};

function processMentionsForMarkdown(text: string): string {
  return text
    .replace(/@([\w\-./]+)/g, "[$1](file://$1)")
    .replace(/\$([\w\-]+)/g, "[$1](skill://$1)");
}

export function MessageBubble({
  role,
  text,
  streaming = false,
  kind = "normal",
  deliveryState = "sent",
  commandExecution,
  commandExecutions,
  fileChanges,
  approvalRequest,
  onApprove,
  onReject,
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

    if (kind === "approval" && approvalRequest) {
      const status = approvalRequest.status;
      const suffix =
        status === "submitting"
          ? "(sending approval...)"
          : status === "approved"
            ? "(approved)"
            : status === "rejected"
              ? "(rejected)"
              : status === "error"
                ? "(failed)"
                : "";
      const title = suffix ? `Approve command ${suffix}` : "Approve command";

      if (status === "pending" || status === "submitting") {
        return (
          <View style={themedStyles.approvalWrapper}>
            <ApprovalCard
              title={title}
              command={approvalRequest.command}
              workingDirectory={approvalRequest.workingDirectory}
              filePaths={approvalRequest.filePaths}
              pending={status === "submitting"}
              onApprove={onApprove || (() => {})}
              onReject={onReject || (() => {})}
            />
          </View>
        );
      }

      return (
        <View style={themedStyles.systemWrapper}>
          <ApprovalStatusCard
            status={
              status === "approved"
                ? "approved"
                : status === "rejected"
                  ? "rejected"
                  : "error"
            }
            command={approvalRequest.command || "Approval command"}
            workingDirectory={approvalRequest.workingDirectory}
            errorMessage={approvalRequest.errorMessage}
          />
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

    const markdownStyle = useMemo(
      () =>
        ({
          paragraph: {
            color: colors.assistantText,
            fontSize: 15,
            lineHeight: 24,
            fontFamily: FontFamilies.normal.ibmPlexSans,
          },
          h1: {
            color: colors.assistantText,
            fontSize: 24,
            lineHeight: 32,
            fontFamily: FontFamilies.display.spaceGrotesk,
            fontWeight: "bold" as const,
          },
          h2: {
            color: colors.assistantText,
            fontSize: 21,
            lineHeight: 28,
            fontFamily: FontFamilies.display.spaceGrotesk,
            fontWeight: "bold" as const,
          },
          h3: {
            color: colors.assistantText,
            fontSize: 18,
            lineHeight: 25,
            fontFamily: FontFamilies.normal.ibmPlexSans,
            fontWeight: "bold" as const,
          },
          strong: {
            fontWeight: "bold" as const,
          },
          em: {
            fontStyle: "italic",
          },
          code: {
            fontFamily: FontFamilies.mono.jetBrainsMono,
            fontSize: 12.5,
            color: colors.codeText,
            backgroundColor: colors.codeHeaderBackground,
            borderColor: colors.codeBorder,
          },
          codeBlock: {
            fontFamily: FontFamilies.mono.jetBrainsMono,
            fontSize: 13,
            backgroundColor: colors.codeBackground,
            borderColor: colors.codeBorder,
          },
          link: {
            color: colors.linkColor,
          },
          blockquote: {
            borderLeftColor: colors.backgroundSelected,
            backgroundColor: colors.backgroundElement,
          },
          list: {
            color: colors.assistantText,
          },
          taskList: {
            color: colors.assistantText,
          },
        }) as unknown as MarkdownStyle,
      [colors],
    );

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

          const processedContent = processMentionsForMarkdown(segment.content);

          return (
            <EnrichedMarkdownText
              key={index}
              markdown={processedContent}
              markdownStyle={markdownStyle}
              onLinkPress={({ url }) => {
                if (/^https?:\/\//i.test(url)) {
                  void Linking.openURL(url);
                }
              }}
            />
          );
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
      fontFamily: FontFamilies.normal.ibmPlexSans,
    },
    userFileMention: {
      color: colors.fileMention,
      fontWeight: "500",
      fontFamily: FontFamilies.normal.ibmPlexSans,
    },
    userSkillMention: {
      color: colors.skillMention,
      fontWeight: "500",
      fontFamily: FontFamilies.normal.ibmPlexSans,
    },
    deliveryStatus: {
      color: colors.systemText,
      fontSize: 11,
      marginTop: 4,
      fontFamily: FontFamilies.normal.ibmPlexSans,
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
    approvalWrapper: {
      width: "100%",
      alignItems: "center",
      marginVertical: 0,
      paddingHorizontal: 8,
    },
    systemText: {
      color: colors.systemText,
      fontSize: 12,
      fontStyle: "italic",
      fontFamily: FontFamilies.normal.ibmPlexSans,
    },
  });
