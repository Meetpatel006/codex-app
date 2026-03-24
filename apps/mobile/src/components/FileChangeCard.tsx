import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useDiffStore } from "@/store/diff";
import { useSessionStore } from "@/store/session";
import { useUiStore } from "@/store/ui";
import { parseUnifiedDiff } from "@/utils/diff";
import { DiffBlockView } from "./DiffBlockView";

type FileAction = "created" | "edited" | "deleted" | "renamed" | "moved";

type FileChange = {
  path: string;
  action: FileAction;
  additions?: number;
  deletions?: number;
  diff?: string;
};

type Props = {
  changes: FileChange[];
};

export function FileChangeCard({ changes }: Props) {
  const [selectedFile, setSelectedFile] = useState<FileChange | null>(null);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setDiffSnapshot = useDiffStore((state) => state.setDiffSnapshot);
  const selectFile = useDiffStore((state) => state.selectFile);
  const openDiffPanel = useUiStore((state) => state.openDiffPanel);

  // Group changes by action
  const groupedChanges = changes.reduce(
    (acc, change) => {
      const action = change.action;
      if (!acc[action]) {
        acc[action] = [];
      }
      acc[action].push(change);
      return acc;
    },
    {} as Record<FileAction, FileChange[]>,
  );

  function openInDiffPanel(file: FileChange) {
    if (!activeSessionId || !file.diff) {
      return;
    }

    const parsedFiles = parseUnifiedDiff(file.diff);
    if (parsedFiles.length === 0) {
      return;
    }

    setDiffSnapshot(activeSessionId, parsedFiles, {
      preserveSelection: false,
    });
    const matchedFile =
      parsedFiles.find((item) => item.path === file.path) || parsedFiles[0];
    selectFile(activeSessionId, matchedFile.id);
    openDiffPanel();
  }

  return (
    <>
      <View style={styles.card}>
        {Object.entries(groupedChanges).map(([action, files]) => (
          <View key={action} style={styles.actionGroup}>
            <Text style={styles.actionLabel}>
              {getActionLabel(action as FileAction)}
            </Text>
            {files.map((file, index) => (
              <Pressable
                key={index}
                style={styles.fileRow}
                onPress={() => file.diff && setSelectedFile(file)}
              >
                <Text style={styles.fileName} numberOfLines={1}>
                  {getFileName(file.path)}
                </Text>
                {(file.additions !== undefined ||
                  file.deletions !== undefined) && (
                  <View style={styles.diffStats}>
                    {file.additions !== undefined && (
                      <Text style={styles.additions}>+{file.additions}</Text>
                    )}
                    {file.deletions !== undefined && (
                      <Text style={styles.deletions}>-{file.deletions}</Text>
                    )}
                  </View>
                )}
                {file.diff && (
                  <Pressable
                    style={styles.diffButton}
                    onPress={(event) => {
                      event.stopPropagation();
                      openInDiffPanel(file);
                    }}
                  >
                    <Text style={styles.diffButtonText}>Open</Text>
                  </Pressable>
                )}
              </Pressable>
            ))}
          </View>
        ))}
      </View>

      {/* Diff Modal */}
      {selectedFile && (
        <Modal
          visible={!!selectedFile}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setSelectedFile(null)}
        >
          <View style={styles.modalContainer}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Text style={styles.modalTitle}>
                  {getFileName(selectedFile.path)}
                </Text>
                <Text style={styles.modalSubtitle}>{selectedFile.path}</Text>
              </View>
              <Pressable
                onPress={() => setSelectedFile(null)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>Done</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalContent}>
              {selectedFile.diff && (
                <DiffBlockView
                  language="diff"
                  code={selectedFile.diff}
                  onOpenDiff={() => openInDiffPanel(selectedFile)}
                />
              )}
            </ScrollView>
          </View>
        </Modal>
      )}
    </>
  );
}

function getActionLabel(action: FileAction): string {
  switch (action) {
    case "created":
      return "Created";
    case "edited":
      return "Edited";
    case "deleted":
      return "Deleted";
    case "renamed":
      return "Renamed";
    case "moved":
      return "Moved";
  }
}

function getFileName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    padding: 12,
    marginVertical: 6,
  },
  actionGroup: {
    marginBottom: 12,
  },
  actionLabel: {
    color: "#9f9f9f",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: "#141414",
    borderRadius: 6,
    marginBottom: 4,
    gap: 8,
  },
  fileName: {
    flex: 1,
    color: "#f5f5f5",
    fontSize: 14,
    fontFamily: "monospace",
  },
  diffStats: {
    flexDirection: "row",
    gap: 6,
  },
  additions: {
    color: "#6fdc8c",
    fontSize: 12,
    fontFamily: "monospace",
    fontWeight: "600",
  },
  deletions: {
    color: "#ff9d9d",
    fontSize: 12,
    fontFamily: "monospace",
    fontWeight: "600",
  },
  diffButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#2a2a2a",
    borderRadius: 4,
  },
  diffButtonText: {
    color: "#7fc7ff",
    fontSize: 11,
    fontWeight: "600",
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
  modalTitleContainer: {
    flex: 1,
  },
  modalTitle: {
    color: "#f0f0f0",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  modalSubtitle: {
    color: "#9f9f9f",
    fontSize: 12,
    marginTop: 2,
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
});
