import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { TerminalIcon } from "./icons/Icon";
import { useTheme } from "@/hooks/use-theme";

type CommandExecutionStatus = "running" | "completed" | "failed" | "stopped";

type Props = {
  command: string;
  status: CommandExecutionStatus;
  workingDirectory?: string;
  exitCode?: number;
  duration?: number;
  output?: string;
};

export function CommandExecutionCard({
  command,
  status,
  output,
}: Props) {
  const colors = useTheme();
  const themedStyles = useMemo(() => createStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(false);
  const statusText = getStatusText(status);
  const outputText = useMemo(() => buildOutputText(output, status), [output, status]);

  return (
    <View style={themedStyles.container}>
      <Pressable
        style={themedStyles.trigger}
        onPress={() => setExpanded((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={expanded ? "Collapse command output" : "Expand command output"}
      >
        <TerminalIcon size={16} color={colors.textSecondary} />
        <Text style={themedStyles.commandLabel} numberOfLines={1}>
          {statusText} "{command}"
        </Text>
      </Pressable>

      {expanded ? (
        <View style={themedStyles.outputSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Text style={themedStyles.outputText} selectable>
              {outputText}
            </Text>
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function getStatusText(status: CommandExecutionStatus): string {
  switch (status) {
    case "running":
      return "Command running";
    case "completed":
      return "Command run";
    case "failed":
      return "Command failed";
    case "stopped":
      return "Command stopped";
  }
}

function buildOutputText(output: string | undefined, status: CommandExecutionStatus) {
  const normalizedOutput = output?.trim();
  if (normalizedOutput) {
    return sanitizeCommandOutput(normalizedOutput);
  }

  if (status === "running") {
    return "Waiting for command output...";
  }

  return "No output captured.";
}

function sanitizeCommandOutput(text: string): string {
  const lines = text.split(/\r?\n/);
  const cleanedLines: string[] = [];
  let outputSectionSeen = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const lower = trimmed.toLowerCase();

    if (/^exit\s*code\s*:/.test(lower) || /^wall\s*time\s*:/.test(lower)) {
      continue;
    }

    if (lower === "output" || lower === "output:") {
      outputSectionSeen = true;
      continue;
    }

    if (/^output\s*:/.test(lower)) {
      outputSectionSeen = true;
      const content = line.replace(/^\s*output\s*:\s*/i, "");
      if (content.length > 0) {
        cleanedLines.push(content);
      }
      continue;
    }

    cleanedLines.push(line);
  }

  const cleaned = cleanedLines.join("\n").trim();
  if (cleaned.length > 0) {
    return cleaned;
  }

  return outputSectionSeen ? "No output captured." : text;
}

const createStyles = (colors: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      width: "100%",
      alignSelf: "stretch",
    },
    trigger: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    commandLabel: {
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
      fontFamily: "monospace",
      lineHeight: 18,
    },
  });

