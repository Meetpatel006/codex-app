import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { DiffLineKind, parseDiffLine } from "@/utils/markdown-parser";

type Props = {
  language: string;
  code: string;
  onOpenDiff?: () => void;
};

export function DiffBlockView({ language, code, onOpenDiff }: Props) {
  const lines = code.split("\n");

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.languageLabel}>{language || "diff"}</Text>
        {onOpenDiff && (
          <Pressable onPress={onOpenDiff} style={styles.openButton}>
            <Text style={styles.openButtonText}>Open in Diff</Text>
          </Pressable>
        )}
      </View>

      {/* Diff content */}
      <View style={styles.diffContainer}>
        {lines.map((line, index) => {
          const { kind, content } = parseDiffLine(line);
          return (
            <View
              key={index}
              style={[styles.lineContainer, getLineStyle(kind)]}
            >
              <Text style={[styles.lineText, getTextStyle(kind)]} selectable>
                {content}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function getLineStyle(kind: DiffLineKind) {
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

function getTextStyle(kind: DiffLineKind) {
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

const styles = StyleSheet.create({
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
    backgroundColor: "#1a1a1a",
  },
  languageLabel: {
    color: "#9f9f9f",
    fontSize: 12,
    fontFamily: "monospace",
    textTransform: "lowercase",
  },
  openButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  openButtonText: {
    color: "#7fc7ff",
    fontSize: 12,
    fontWeight: "600",
  },
  diffContainer: {
    backgroundColor: "#141414",
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
    backgroundColor: "#1a3a1a",
  },
  additionText: {
    color: "#6fdc8c",
  },
  // Deletion line (red)
  deletionLine: {
    backgroundColor: "#3a1a1a",
  },
  deletionText: {
    color: "#ff9d9d",
  },
  // Hunk line (cyan)
  hunkLine: {
    backgroundColor: "#1a2a3a",
  },
  hunkText: {
    color: "#7fc7ff",
  },
  // Meta line (gray)
  metaLine: {
    backgroundColor: "#1a1a1a",
  },
  metaText: {
    color: "#9f9f9f",
  },
  // Neutral line
  neutralLine: {
    backgroundColor: "transparent",
  },
  neutralText: {
    color: "#e5e5e5",
  },
});
