import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { DiffLineKind, parseDiffLine } from "@/utils/markdown-parser";
import { useTheme } from "@/hooks/use-theme";

type Props = {
  language: string;
  code: string;
  onOpenDiff?: () => void;
};

export function DiffBlockView({ language, code, onOpenDiff }: Props) {
  const colors = useTheme();
  const themedStyles = useMemo(() => createStyles(colors), [colors]);
  const lines = code.split("\n");

  return (
    <View style={themedStyles.container}>
      {/* Header */}
      <View style={themedStyles.header}>
        <Text style={themedStyles.languageLabel}>{language || "diff"}</Text>
        {onOpenDiff && (
          <Pressable onPress={onOpenDiff} style={themedStyles.openButton}>
            <Text style={themedStyles.openButtonText}>Open in Diff</Text>
          </Pressable>
        )}
      </View>

      {/* Diff content */}
      <View style={themedStyles.diffContainer}>
        {lines.map((line, index) => {
          const { kind, content } = parseDiffLine(line);
          return (
            <View
              key={index}
              style={[
                themedStyles.lineContainer,
                getLineStyle(kind, themedStyles),
              ]}
            >
              <Text
                style={[
                  themedStyles.lineText,
                  getTextStyle(kind, themedStyles),
                ]}
                selectable
              >
                {content}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function getLineStyle(
  kind: DiffLineKind,
  styles: ReturnType<typeof createStyles>,
) {
  switch (kind) {
    case "addition":
      return styles.additionLine;
    case "deletion":
      return styles.deletionLine;
    case "hunk":
      return styles.hunkLine;
    case "meta":
      return styles.metaLine;
    default:
      return styles.neutralLine;
  }
}

function getTextStyle(
  kind: DiffLineKind,
  styles: ReturnType<typeof createStyles>,
) {
  switch (kind) {
    case "addition":
      return styles.additionText;
    case "deletion":
      return styles.deletionText;
    case "hunk":
      return styles.hunkText;
    case "meta":
      return styles.metaText;
    default:
      return styles.neutralText;
  }
}

const createStyles = (colors: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      borderRadius: 8,
      overflow: "hidden",
      marginVertical: 8,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.codeHeaderBackground,
    },
    languageLabel: {
      color: colors.textSecondary,
      fontSize: 12,
      fontFamily: "monospace",
      textTransform: "lowercase",
    },
    openButton: {
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    openButtonText: {
      color: colors.linkColor,
      fontSize: 12,
      fontWeight: "600",
    },
    diffContainer: {
      backgroundColor: colors.codeBackground,
    },
    lineContainer: {
      paddingHorizontal: 12,
      paddingVertical: 2,
    },
    lineText: {
      fontSize: 13,
      fontFamily: "monospace",
      lineHeight: 18,
    },
    // Addition line (green)
    additionLine: {
      backgroundColor: colors.diffAdditionBg,
    },
    additionText: {
      color: colors.diffAdditionText,
    },
    // Deletion line (red)
    deletionLine: {
      backgroundColor: colors.diffDeletionBg,
    },
    deletionText: {
      color: colors.diffDeletionText,
    },
    // Hunk line (cyan)
    hunkLine: {
      backgroundColor: colors.diffHunkBg,
    },
    hunkText: {
      color: colors.diffHunkText,
    },
    // Meta line (gray)
    metaLine: {
      backgroundColor: colors.diffMetaBg,
    },
    metaText: {
      color: colors.diffMetaText,
    },
    // Neutral line
    neutralLine: {
      backgroundColor: "transparent",
    },
    neutralText: {
      color: colors.codeText,
    },
  });
