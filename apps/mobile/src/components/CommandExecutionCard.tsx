import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

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
  workingDirectory,
  exitCode,
  duration,
  output,
}: Props) {
  const [detailsVisible, setDetailsVisible] = useState(false);

  const accentColor = getAccentColor(status);
  const statusText = getStatusText(status);
  const outputPreview = buildOutputPreview(output);

  return (
    <>
      <Pressable
        style={styles.card}
        onPress={() => setDetailsVisible(true)}
        accessibilityLabel="View command details"
      >
        {/* Accent bar */}
        <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

        {/* Card content */}
        <View style={styles.content}>
          <Text style={styles.statusLabel} numberOfLines={1}>
            {statusText}
          </Text>
          <Text style={styles.command} numberOfLines={2}>
            {command}
          </Text>
          {outputPreview ? (
            <View style={styles.previewBlock}>
              <Text style={styles.previewText} numberOfLines={6}>
                {outputPreview}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      {/* Detail Modal */}
      <Modal
        visible={detailsVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDetailsVisible(false)}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Command Details</Text>
            <Pressable
              onPress={() => setDetailsVisible(false)}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>Done</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Status */}
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Status</Text>
              <View style={styles.statusRow}>
                <View
                  style={[styles.statusDot, { backgroundColor: accentColor }]}
                />
                <Text style={styles.detailValue}>{statusText}</Text>
              </View>
            </View>

            {/* Command */}
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Command</Text>
              <View style={styles.codeBlock}>
                <Text style={styles.codeText} selectable>
                  {command}
                </Text>
              </View>
            </View>

            {/* Working Directory */}
            {workingDirectory && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Working Directory</Text>
                <Text style={styles.detailValue} selectable>
                  {workingDirectory}
                </Text>
              </View>
            )}

            {/* Exit Code */}
            {exitCode !== undefined && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Exit Code</Text>
                <Text
                  style={[
                    styles.detailValue,
                    styles.exitCode,
                    { color: exitCode === 0 ? "#6fdc8c" : "#ff9d9d" },
                  ]}
                >
                  {exitCode}
                </Text>
              </View>
            )}

            {/* Duration */}
            {duration !== undefined && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Duration</Text>
                <Text style={styles.detailValue}>
                  {formatDuration(duration)}
                </Text>
              </View>
            )}

            {/* Output */}
            {output && (
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>Output</Text>
                <View style={styles.outputBlock}>
                  <ScrollView horizontal>
                    <Text style={styles.outputText} selectable>
                      {output}
                    </Text>
                  </ScrollView>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function getAccentColor(status: CommandExecutionStatus): string {
  switch (status) {
    case "running":
      return "#ffcc00"; // Yellow
    case "completed":
      return "#6fdc8c"; // Green
    case "failed":
      return "#ff9d9d"; // Red
    case "stopped":
      return "#9f9f9f"; // Gray
  }
}

function getStatusText(status: CommandExecutionStatus): string {
  switch (status) {
    case "running":
      return "Running command";
    case "completed":
      return "Command completed";
    case "failed":
      return "Command failed";
    case "stopped":
      return "Command stopped";
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = (ms / 1000).toFixed(2);
  return `${seconds}s`;
}

function buildOutputPreview(output?: string) {
  if (!output) {
    return "";
  }

  return output
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .slice(-8)
    .join("\n");
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    marginVertical: 6,
    overflow: "hidden",
  },
  accentBar: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: 12,
  },
  statusLabel: {
    color: "#9f9f9f",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  command: {
    color: "#f5f5f5",
    fontSize: 14,
    fontFamily: "monospace",
  },
  previewBlock: {
    marginTop: 8,
    backgroundColor: "#121212",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#262626",
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  previewText: {
    color: "#cfcfcf",
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "monospace",
  },

  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: "#0b0b0b",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2f2f2f",
  },
  modalTitle: {
    color: "#f0f0f0",
    fontSize: 18,
    fontWeight: "700",
  },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  closeButtonText: {
    color: "#6fdc8c",
    fontSize: 16,
    fontWeight: "600",
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailLabel: {
    color: "#9f9f9f",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  detailValue: {
    color: "#f5f5f5",
    fontSize: 14,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  codeBlock: {
    backgroundColor: "#141414",
    borderRadius: 6,
    padding: 12,
  },
  codeText: {
    color: "#e5e5e5",
    fontSize: 13,
    fontFamily: "monospace",
  },
  exitCode: {
    fontFamily: "monospace",
    fontWeight: "700",
  },
  outputBlock: {
    backgroundColor: "#141414",
    borderRadius: 6,
    padding: 12,
    maxHeight: 300,
  },
  outputText: {
    color: "#e5e5e5",
    fontSize: 13,
    fontFamily: "monospace",
    lineHeight: 18,
  },
});
