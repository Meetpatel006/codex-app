import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { FolderIcon } from "@/components/icons/Icon";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import type { FileChangeData } from "@/store/chat";
import { useDiffStore } from "@/store/diff";
import { useSessionStore } from "@/store/session";
import { useUiStore } from "@/store/ui";
import { parseUnifiedDiff } from "@/utils/diff";

type Props = {
  changes: FileChangeData[];
};

type DisplayChange = FileChangeData & {
  normalizedPath: string;
  directory: string;
  fileName: string;
};

type FileGroup = {
  key: string;
  label: string;
  files: DisplayChange[];
  additions: number;
  deletions: number;
};

export function FileChangeCard({ changes }: Props) {
  const colors = useTheme();
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const diffSession = useDiffStore((state) =>
    activeSessionId ? state.sessions[activeSessionId] : undefined,
  );
  const setDiffSnapshot = useDiffStore((state) => state.setDiffSnapshot);
  const openDiffPanel = useUiStore((state) => state.openDiffPanel);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {},
  );
  const styles = useMemo(() => createStyles(colors), [colors]);

  const displayChanges = useMemo(() => {
    const snapshotFiles = diffSession?.files || [];
    if (snapshotFiles.length > 0) {
      const snapshotChanges = snapshotFiles.map((file) => ({
        path: file.path,
        action: file.status,
        additions: file.additions,
        deletions: file.deletions,
        diff: file.diff,
      }));
      const snapshotPaths = new Set(
        snapshotChanges.map((file) => normalizePath(file.path)),
      );
      const messagePaths = changes.map((file) => normalizePath(file.path));
      const sameFiles =
        messagePaths.length > 0 &&
        messagePaths.every((path) => snapshotPaths.has(path)) &&
        snapshotChanges.length === messagePaths.length;

      if (sameFiles || changes.length === 0) {
        return snapshotChanges;
      }
    }

    return changes;
  }, [changes, diffSession?.files]);

  const normalizedChanges = useMemo<DisplayChange[]>(
    () =>
      displayChanges.map((change) => {
        const normalizedPath = normalizePath(change.path);
        return {
          ...change,
          normalizedPath,
          directory: getFileDirectory(normalizedPath),
          fileName: getFileName(normalizedPath),
        };
      }),
    [displayChanges],
  );

  const summary = useMemo(
    () =>
      normalizedChanges.reduce(
        (acc, change) => {
          acc.additions += change.additions || 0;
          acc.deletions += change.deletions || 0;
          return acc;
        },
        { additions: 0, deletions: 0 },
      ),
    [normalizedChanges],
  );

  const groups = useMemo(
    () => buildGroups(normalizedChanges),
    [normalizedChanges],
  );

  function handleOpenFileDiff(file: DisplayChange) {
    if (!file.diff) {
      return;
    }

    if (activeSessionId) {
      const parsedFiles = parseUnifiedDiff(file.diff);
      if (parsedFiles.length > 0) {
        setDiffSnapshot(activeSessionId, parsedFiles, {
          preserveSelection: false,
        });
      }
    }

    openDiffPanel();
  }

  function toggleGroup(groupKey: string) {
    setExpandedGroups((current) => ({
      ...current,
      [groupKey]: !(current[groupKey] ?? true),
    }));
  }

  return (
    <>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.titleBlock}>
            <ThemedText style={styles.kicker}>
              CHANGED FILES ({normalizedChanges.length})
            </ThemedText>
            <View style={styles.summaryRow}>
              <ThemedText style={styles.additions}>
                +{summary.additions}
              </ThemedText>
              <ThemedText style={styles.separator}>/</ThemedText>
              <ThemedText style={styles.deletions}>
                -{summary.deletions}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.groupList}>
          {groups.map((group) => {
            const isExpanded = expandedGroups[group.key] ?? true;

            return (
              <View key={group.key} style={styles.groupCard}>
                <Pressable
                  style={styles.groupHeader}
                  onPress={() => toggleGroup(group.key)}
                >
                  <View style={styles.groupHeaderLeft}>
                    <FolderIcon size={15} color={colors.systemText} />
                    <View style={styles.groupTextBlock}>
                      <ThemedText style={styles.groupTitle}>
                        {group.label}
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.groupStats}>
                    <ThemedText style={styles.additions}>
                      +{group.additions}
                    </ThemedText>
                    <ThemedText style={styles.deletions}>
                      -{group.deletions}
                    </ThemedText>
                  </View>
                </Pressable>

                {isExpanded ? (
                  <View style={styles.fileList}>
                    {group.files.map((file, index) => (
                      <View
                        key={file.normalizedPath}
                        style={index > 0 ? styles.fileDivider : undefined}
                      >
                        <Pressable
                          style={styles.fileRow}
                          onPress={() => handleOpenFileDiff(file)}
                          disabled={!file.diff}
                        >
                          <View style={styles.fileMain}>
                            <View style={styles.fileTextBlock}>
                              <ThemedText style={styles.fileName}>
                                {file.fileName}
                              </ThemedText>
                            </View>
                          </View>
                          <View style={styles.fileRight}>
                            <View style={styles.fileStats}>
                              <ThemedText style={styles.additions}>
                                +{file.additions || 0}
                              </ThemedText>
                              <ThemedText style={styles.deletions}>
                                -{file.deletions || 0}
                              </ThemedText>
                            </View>
                            {file.diff ? (
                              <ThemedText style={styles.previewHint}>
                                Preview
                              </ThemedText>
                            ) : null}
                          </View>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </View>
    </>
  );
}

function buildGroups(changes: DisplayChange[]): FileGroup[] {
  const groups = new Map<string, FileGroup>();

  for (const change of changes) {
    const groupKey = change.directory || "workspace";
    const existing = groups.get(groupKey);
    if (!existing) {
      groups.set(groupKey, {
        key: groupKey,
        label: groupKey,
        files: [change],
        additions: change.additions || 0,
        deletions: change.deletions || 0,
      });
      continue;
    }

    existing.files.push(change);
    existing.additions += change.additions || 0;
    existing.deletions += change.deletions || 0;
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      files: group.files.sort((left, right) =>
        left.normalizedPath.localeCompare(right.normalizedPath),
      ),
    }))
    .sort((left, right) => {
      if (right.files.length !== left.files.length) {
        return right.files.length - left.files.length;
      }
      return left.label.localeCompare(right.label);
    });
}

function getFileName(path: string) {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || path;
}

function getFileDirectory(path: string) {
  const parts = path.split("/").filter(Boolean);
  if (parts.length <= 1) {
    return "";
  }
  return parts.slice(0, -1).join("/");
}

function normalizePath(path: string) {
  return path.replace(/\\/g, "/");
}

const createStyles = (colors: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    card: {
      width: "100%",
      alignSelf: "stretch",
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.codeBorder,
      backgroundColor: colors.codeBackground,
      padding: 14,
      gap: 12,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 10,
    },
    titleBlock: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "nowrap",
      gap: 8,
      flex: 1,
    },
    kicker: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "700",
      letterSpacing: 0.8,
      color: colors.systemText,
    },
    summaryRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    additions: {
      color: colors.successColor,
      fontSize: 11,
      fontWeight: "700",
    },
    separator: {
      color: colors.systemText,
      fontSize: 11,
    },
    deletions: {
      color: colors.errorColor,
      fontSize: 11,
      fontWeight: "700",
    },
    groupList: {
      gap: 10,
    },
    groupCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.backgroundSelected,
      backgroundColor: colors.background,
      overflow: "hidden",
    },
    groupHeader: {
      minHeight: 52,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    groupHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flex: 1,
      minWidth: 0,
    },
    groupTextBlock: {
      flex: 1,
      minWidth: 0,
    },
    groupTitle: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "700",
      fontFamily: "monospace",
    },
    groupStats: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    fileList: {
      borderTopWidth: 1,
      borderTopColor: colors.backgroundSelected,
      paddingBottom: 2,
    },
    fileDivider: {
      borderTopWidth: 1,
      borderTopColor: colors.backgroundSelected,
    },
    fileRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingLeft: 16,
      paddingRight: 12,
      paddingVertical: 8,
    },
    fileMain: {
      flexDirection: "row",
      alignItems: "center",
      gap: 0,
      flex: 1,
      minWidth: 0,
    },
    fileTextBlock: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    fileName: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "700",
      fontFamily: "monospace",
    },
    fileRight: {
      alignItems: "flex-end",
      gap: 3,
    },
    fileStats: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    previewHint: {
      color: colors.fileMention,
      fontSize: 10,
      fontWeight: "600",
    },
  });
