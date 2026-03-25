import React, { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  UIManager,
  View,
} from "react-native";
import { SymbolView } from "expo-symbols";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { relayService } from "@/services/relay";
import { useDiffStore } from "@/store/diff";
import { useSessionStore } from "@/store/session";
import { parseUnifiedDiff } from "@/utils/diff";
import { getGitCwd, requestGitDiff } from "@/utils/git";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type CodeDiffViewProps = {
  onClose: () => void;
};

export function CodeDiffView({ onClose }: CodeDiffViewProps) {
  const theme = useTheme();
  const projects = useSessionStore((state) => state.projects);
  const activeProjectId = useSessionStore((state) => state.activeProjectId);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const diffSession = useDiffStore((state) =>
    activeSessionId ? state.sessions[activeSessionId] : undefined,
  );
  const setDiffSnapshot = useDiffStore((state) => state.setDiffSnapshot);

  const files = diffSession?.files || [];
  const [expandedFile, setExpandedFile] = useState<string | null>(
    files[0]?.id || null,
  );
  const translateX = useSharedValue(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");

  const activeProject =
    projects.find((project) => project.id === activeProjectId) || null;
  const gitCwd = getGitCwd(activeProject?.description);

  useEffect(() => {
    if (files.length > 0) {
      setExpandedFile((current) => current || files[0].id);
    } else {
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
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedFile((current) => (current === id ? null : id));
  };

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationX > 0) {
        translateX.value = event.translationX;
      }
    })
    .onEnd((event) => {
      if (event.velocityX > 500 || event.translationX > SCREEN_WIDTH / 3) {
        runOnJS(onClose)();
      } else {
        translateX.value = withTiming(0, {
          duration: 250,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[
          styles.container,
          animatedStyle,
          { backgroundColor: theme.background },
        ]}
      >
        <View style={styles.ideHeader}>
          <View style={styles.ideHeaderLeft}>
            <ThemedText style={styles.unstagedText}>Unstaged</ThemedText>
            <View
              style={[
                styles.badge,
                { backgroundColor: theme.backgroundElement },
              ]}
            >
              <ThemedText
                style={[styles.badgeText, { color: theme.textSecondary }]}
              >
                {files.length}
              </ThemedText>
            </View>
            <SymbolView
              name={{
                ios: "chevron.down",
                android: "expand_more",
                web: "expand_more",
              }}
              size={10}
              tintColor={theme.textSecondary}
            />
          </View>
          <View style={styles.headerStats}>
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
                    const parsedFiles = patch ? parseUnifiedDiff(patch) : [];
                    setDiffSnapshot(activeSessionId, parsedFiles, {
                      preserveSelection: true,
                    });
                  })
                  .catch((error) => {
                    setLoadError(
                      error instanceof Error ? error.message : String(error),
                    );
                  })
                  .finally(() => {
                    setRefreshing(false);
                  });
              }}
              style={[
                styles.refreshPill,
                { backgroundColor: theme.backgroundElement },
              ]}
            >
              <ThemedText
                style={[styles.refreshPillText, { color: theme.textSecondary }]}
              >
                {refreshing ? "Loading..." : "Refresh"}
              </ThemedText>
            </Pressable>
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
            <View key={file.id} style={styles.fileCard}>
              <Pressable
                onPress={() => toggleExpand(file.id)}
                style={[
                  styles.pillHeader,
                  { backgroundColor: theme.backgroundElement },
                  expandedFile === file.id && styles.pillHeaderExpanded,
                  expandedFile === file.id && {
                    backgroundColor: theme.backgroundSelected,
                  },
                ]}
              >
                <ThemedText
                  style={[styles.filePath, { color: theme.textSecondary }]}
                  numberOfLines={1}
                >
                  {file.path}
                </ThemedText>
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
                        expandedFile === file.id
                          ? "chevron.up"
                          : "chevron.down",
                      android:
                        expandedFile === file.id
                          ? "expand_less"
                          : "expand_more",
                      web:
                        expandedFile === file.id
                          ? "expand_less"
                          : "expand_more",
                    }}
                    size={10}
                    tintColor={theme.textSecondary}
                    style={styles.chevron}
                  />
                </View>
              </Pressable>

              {expandedFile === file.id && file.hunks.length > 0 ? (
                <View
                  style={[
                    styles.diffContent,
                    { backgroundColor: theme.backgroundElement },
                  ]}
                >
                  {file.hunks.slice(0, 3).map((hunk) =>
                    hunk.lines.slice(0, 120).map((line) => (
                      <View key={line.id} style={styles.line}>
                        <ThemedText
                          style={[
                            styles.lineNumber,
                            { color: theme.textSecondary },
                            line.type === "addition" && styles.addedLineNumber,
                            line.type === "deletion" &&
                              styles.removedLineNumber,
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
                        <ThemedText
                          style={[
                            styles.codeText,
                            { color: theme.text },
                            line.type === "addition" && styles.addedCodeText,
                            line.type === "deletion" && styles.removedCodeText,
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
                    )),
                  )}
                </View>
              ) : null}
            </View>
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
              <ThemedText style={styles.emptyTitle}>
                No diff available
              </ThemedText>
              <ThemedText
                style={[styles.emptyText, { color: theme.textSecondary }]}
              >
                Make file changes and refresh git status to see code diff.
              </ThemedText>
            </View>
          ) : null}
        </ScrollView>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  ideHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ideHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  refreshPill: {
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  refreshPillText: {
    fontSize: 11,
    fontWeight: "600",
  },
  unstagedText: {
    fontSize: 14,
    fontWeight: "600",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 36,
  },
  errorText: {
    fontSize: 12,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  fileCard: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: "hidden",
  },
  pillHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 8,
  },
  pillHeaderExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  filePath: {
    fontSize: 12,
    flex: 1,
    marginRight: 8,
  },
  pillStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chevron: {
    marginLeft: 8,
  },
  pillAdded: {
    fontSize: 12,
    fontWeight: "600",
  },
  pillRemoved: {
    fontSize: 12,
    fontWeight: "600",
  },
  diffContent: {
    paddingVertical: 8,
  },
  line: {
    flexDirection: "row",
    paddingHorizontal: 16,
    minHeight: 20,
    alignItems: "center",
  },
  lineNumber: {
    width: 38,
    fontSize: 12,
    textAlign: "right",
    marginRight: 14,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  addedLineNumber: {
    fontWeight: "600",
  },
  removedLineNumber: {
    fontWeight: "600",
  },
  codeText: {
    flex: 1,
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  addedCodeText: {},
  removedCodeText: {},
  emptyState: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 12,
    lineHeight: 18,
  },
});
