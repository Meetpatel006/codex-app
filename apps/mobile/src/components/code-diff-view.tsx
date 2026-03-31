import React, { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SymbolView } from "expo-symbols";
import { Easing, FadeIn, FadeOut, Layout } from "react-native-reanimated";
import Animated from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";

import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { relayService } from "@/services/relay";
import { useDiffStore } from "@/store/diff";
import { useSessionStore } from "@/store/session";
import { parseUnifiedDiff } from "@/utils/diff";
import { getGitCwd, requestGitDiff } from "@/utils/git";
import { getVscodeIconUrlForEntry } from "@/utils/vscode-icons";
import { useColorScheme } from "@/hooks/use-color-scheme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type CodeDiffViewProps = {
  onClose: () => void;
};

export function CodeDiffView({ onClose }: CodeDiffViewProps) {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const projects = useSessionStore((state) => state.projects);
  const activeProjectId = useSessionStore((state) => state.activeProjectId);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const diffSession = useDiffStore((state) =>
    activeSessionId ? state.sessions[activeSessionId] : undefined,
  );
  const setDiffSnapshot = useDiffStore((state) => state.setDiffSnapshot);

  const files = diffSession?.files || [];
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");

  const activeProject =
    projects.find((project) => project.id === activeProjectId) || null;
  const gitCwd = getGitCwd(activeProject?.description);

  useEffect(() => {
    // We no longer auto-expand the first file.
    if (files.length === 0) {
      setExpandedFile(null);
    }
  }, [files]);

  useEffect(() => {
    let isCancelled = false;

    async function refreshDiffFromGit() {
      if (!activeSessionId || !gitCwd || !relayService.isSecureReady()) {
        return;
      }

      setRefreshing(true);
      setLoadError("");

      try {
        const diffResult = await requestGitDiff(gitCwd);
        if (isCancelled) {
          return;
        }

        const patch = (diffResult?.patch || "").trim();
        const parsedFiles = patch ? parseUnifiedDiff(patch) : [];
        setDiffSnapshot(activeSessionId, parsedFiles, {
          preserveSelection: true,
        });
      } catch (error) {
        if (!isCancelled) {
          setLoadError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!isCancelled) {
          setRefreshing(false);
        }
      }
    }

    void refreshDiffFromGit();

    return () => {
      isCancelled = true;
    };
  }, [activeSessionId, gitCwd, setDiffSnapshot]);

  const totals = useMemo(() => {
    return files.reduce(
      (acc, file) => {
        acc.added += file.additions;
        acc.removed += file.deletions;
        return acc;
      },
      { added: 0, removed: 0 },
    );
  }, [files]);

  const toggleExpand = (id: string) => {
    setExpandedFile((current) => (current === id ? null : id));
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.headerBlock}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <ThemedText style={styles.logoText}>Files</ThemedText>
            <View
              style={[
                styles.badge,
                { backgroundColor: theme.backgroundSelected },
              ]}
            >
              <ThemedText
                style={[styles.badgeText, { color: theme.textSecondary }]}
              >
                {files.length}
              </ThemedText>
            </View>
          </View>

          <View style={styles.headerRight}>
            <View style={styles.headerStats}>
              <ThemedText
                style={[styles.pillAdded, { color: theme.successColor }]}
              >
                +{totals.added}
              </ThemedText>
              <ThemedText
                style={[styles.pillRemoved, { color: theme.errorColor }]}
              >
                -{totals.removed}
              </ThemedText>
            </View>

            <View style={styles.headerActions}>
              <View style={styles.actionPill}>
                <Pressable
                  onPress={() => {
                    if (
                      !activeSessionId ||
                      !gitCwd ||
                      !relayService.isSecureReady()
                    ) {
                      return;
                    }
                    setRefreshing(true);
                    setLoadError("");
                    requestGitDiff(gitCwd)
                      .then((diffResult) => {
                        const patch = (diffResult?.patch || "").trim();
                        const parsedFiles = patch
                          ? parseUnifiedDiff(patch)
                          : [];
                        setDiffSnapshot(activeSessionId, parsedFiles, {
                          preserveSelection: true,
                        });
                      })
                      .catch((error) => {
                        setLoadError(
                          error instanceof Error
                            ? error.message
                            : String(error),
                        );
                      })
                      .finally(() => {
                        setRefreshing(false);
                      });
                  }}
                  style={({ pressed }) => [
                    styles.pillButton,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  {refreshing ? (
                    <ThemedText style={styles.pillActiveText}>...</ThemedText>
                  ) : (
                    <SymbolView
                      name={{
                        ios: "arrow.clockwise",
                        android: "refresh",
                        web: "refresh",
                      }}
                      size={20}
                      tintColor={theme.text}
                    />
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </View>

      {loadError ? (
        <ThemedText style={[styles.errorText, { color: theme.errorColor }]}>
          {loadError}
        </ThemedText>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {files.map((file) => (
          <Animated.View
            key={file.id}
            layout={Layout.springify()}
            style={[styles.fileCard, { borderColor: theme.codeBorder }]}
          >
            <Pressable
              onPress={() => toggleExpand(file.id)}
              style={({ pressed }) => [
                styles.pillHeader,
                { backgroundColor: theme.backgroundElement },
                expandedFile === file.id && styles.pillHeaderExpanded,
                pressed && { opacity: 0.9 },
              ]}
            >
              <View style={styles.pillHeaderLeft}>
                <Image
                  source={getVscodeIconUrlForEntry(
                    file.path,
                    "file",
                    colorScheme === "dark" ? "dark" : "light",
                  )}
                  style={styles.fileIcon}
                  contentFit="contain"
                />
                <ThemedText
                  style={[styles.filePath, { color: theme.text }]}
                  numberOfLines={1}
                >
                  {file.path.split("/").pop()}
                </ThemedText>
                <ThemedText
                  style={[styles.fileDir, { color: theme.textSecondary }]}
                  numberOfLines={1}
                >
                  {file.path.split("/").slice(0, -1).join("/")}
                </ThemedText>
              </View>
              <View style={styles.pillStats}>
                <ThemedText
                  style={[styles.pillAdded, { color: theme.successColor }]}
                >
                  +{file.additions}
                </ThemedText>
                <ThemedText
                  style={[styles.pillRemoved, { color: theme.errorColor }]}
                >
                  -{file.deletions}
                </ThemedText>
                <SymbolView
                  name={{
                    ios:
                      expandedFile === file.id ? "chevron.up" : "chevron.down",
                    android:
                      expandedFile === file.id ? "expand_less" : "expand_more",
                    web:
                      expandedFile === file.id ? "expand_less" : "expand_more",
                  }}
                  size={12}
                  tintColor={theme.textSecondary}
                  style={styles.chevron}
                />
              </View>
            </Pressable>

            {expandedFile === file.id && file.hunks.length > 0 ? (
              <Animated.View
                entering={FadeIn}
                style={[
                  styles.diffContent,
                  { backgroundColor: theme.codeBackground },
                ]}
              >
                {file.hunks.map((hunk, hunkIdx) => (
                  <View key={`hunk-${hunkIdx}`}>
                    {hunkIdx > 0 && (
                      <View
                        style={[
                          styles.hunkDivider,
                          { backgroundColor: theme.codeBorder },
                        ]}
                      />
                    )}
                    {hunk.lines.map((line) => (
                      <View
                        key={line.id}
                        style={[
                          styles.line,
                          line.type === "addition" && {
                            backgroundColor: theme.diffAdditionBg,
                          },
                          line.type === "deletion" && {
                            backgroundColor: theme.diffDeletionBg,
                          },
                        ]}
                      >
                        <View style={styles.lineGutter}>
                          <ThemedText
                            style={[
                              styles.lineNumber,
                              { color: theme.textSecondary },
                              line.type === "addition" && {
                                color: theme.diffAdditionText,
                              },
                              line.type === "deletion" && {
                                color: theme.diffDeletionText,
                              },
                            ]}
                          >
                            {line.newLineNumber || line.oldLineNumber || ""}
                          </ThemedText>
                          <View
                            style={[
                              styles.lineMarker,
                              line.type === "addition" && {
                                backgroundColor: theme.successColor,
                              },
                              line.type === "deletion" && {
                                backgroundColor: theme.errorColor,
                              },
                            ]}
                          />
                        </View>
                        <ThemedText
                          style={[
                            styles.codeText,
                            { color: theme.text },
                            line.type === "addition" && {
                              color: theme.diffAdditionText,
                            },
                            line.type === "deletion" && {
                              color: theme.diffDeletionText,
                            },
                          ]}
                        >
                          {line.content}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                ))}
              </Animated.View>
            ) : null}
          </Animated.View>
        ))}

        {files.length === 0 ? (
          <View
            style={[
              styles.emptyState,
              {
                borderColor: theme.backgroundSelected,
                backgroundColor: theme.backgroundElement,
              },
            ]}
          >
            <ThemedText style={styles.emptyTitle}>No diff available</ThemedText>
            <ThemedText
              style={[styles.emptyText, { color: theme.textSecondary }]}
            >
              Make file changes and refresh git status to see code diff.
            </ThemedText>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
  },
  headerBlock: {
    paddingBottom: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    height: 60,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoText: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  headerStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
    borderColor: "rgba(0,0,0,0.05)",
    borderWidth: 1,
    borderRadius: 24,
    overflow: "hidden",
  },
  pillButton: {
    width: 44,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  pillActiveText: {
    fontSize: 14,
    fontWeight: "700",
  },
  globalStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginRight: 4,
  },
  refreshButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  scrollContent: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  errorText: {
    fontSize: 12,
    paddingHorizontal: 20,
    marginBottom: 8,
    fontWeight: "500",
  },
  fileCard: {
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  pillHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    height: 52,
  },
  pillHeaderExpanded: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  pillHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  fileIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  filePath: {
    fontSize: 14,
    fontWeight: "700",
    marginRight: 6,
  },
  fileDir: {
    fontSize: 12,
    opacity: 0.6,
    flex: 1,
  },
  pillStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chevron: {
    marginLeft: 4,
  },
  pillAdded: {
    fontSize: 13,
    fontWeight: "700",
  },
  pillRemoved: {
    fontSize: 13,
    fontWeight: "700",
  },
  diffContent: {
    paddingVertical: 12,
  },
  hunkDivider: {
    height: 1,
    marginVertical: 8,
    opacity: 0.1,
  },
  line: {
    flexDirection: "row",
    paddingHorizontal: 12,
    minHeight: 24,
    alignItems: "center",
  },
  lineGutter: {
    width: 45,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
  },
  lineNumber: {
    flex: 1,
    fontSize: 11,
    textAlign: "right",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    paddingRight: 8,
  },
  lineMarker: {
    width: 3,
    height: 14,
    borderRadius: 2,
  },
  codeText: {
    flex: 1,
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    lineHeight: 18,
  },
  emptyState: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    opacity: 0.7,
  },
});
