import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { TerminalIcon } from "./icons/Icon";
import { useTheme } from "@/hooks/use-theme";

type ApprovalStatus = "approved" | "rejected" | "error";

type Props = {
  status: ApprovalStatus;
  command: string;
  workingDirectory?: string;
  errorMessage?: string;
};

export function ApprovalStatusCard({
  status,
  command,
  workingDirectory,
  errorMessage,
}: Props) {
  const colors = useTheme();
  const themedStyles = useMemo(() => createStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(false);

  const label =
    status === "approved"
      ? "Command approved"
      : status === "rejected"
        ? "Command rejected"
        : "Approval failed";

  return (
    <View style={themedStyles.container}>
      <Pressable
        style={themedStyles.trigger}
        onPress={() => setExpanded((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={
          expanded ? "Collapse approval details" : "Expand approval details"
        }
      >
        <TerminalIcon size={16} color={colors.textSecondary} />
        <Text style={themedStyles.label} numberOfLines={1}>
          {`${label} "${command}"`}
        </Text>
      </Pressable>

      {expanded ? (
        <View style={themedStyles.outputSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Text style={themedStyles.outputText} selectable>
              {buildApprovalDetails({
                command,
                workingDirectory,
                errorMessage,
              })}
            </Text>
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function buildApprovalDetails({
  command,
  workingDirectory,
  errorMessage,
}: {
  command: string;
  workingDirectory?: string;
  errorMessage?: string;
}) {
  const lines = [command.trim()];
  if (workingDirectory?.trim()) {
    lines.push(`cwd: ${workingDirectory.trim()}`);
  }
  if (errorMessage?.trim()) {
    lines.push(`error: ${errorMessage.trim()}`);
  }
  return lines.join("\n");
}

const createStyles = (colors: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      width: "100%",
      alignSelf: "stretch",
      backgroundColor: colors.codeBackground,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.codeBorder,
      overflow: "hidden",
    },
    trigger: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    label: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
      fontFamily: "monospace",
    },
    outputSection: {
      borderTopWidth: 1,
      borderTopColor: colors.codeBorder,
      backgroundColor: colors.codeBackground,
      paddingHorizontal: 14,
      paddingVertical: 12,
      maxHeight: 280,
    },
    outputText: {
      color: colors.codeText,
      fontSize: 13,
      lineHeight: 18,
      fontFamily: "monospace",
    },
  });
