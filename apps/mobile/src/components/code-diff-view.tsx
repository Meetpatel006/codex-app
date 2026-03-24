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
      <Animated.View style={[styles.container, animatedStyle]}>
        <View style={styles.ideHeader}>
          <View style={styles.ideHeaderLeft}>
            <ThemedText style={styles.unstagedText}>Unstaged</ThemedText>
            <View style={styles.badge}>
              <ThemedText style={styles.badgeText}>{files.length}</ThemedText>
            </View>
            <SymbolView
              name={{
                ios: "chevron.down",
                android: "expand_more",
                web: "expand_more",
              }}
              size={10}
              tintColor="#666"
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
              style={styles.refreshPill}
            >
              <ThemedText style={styles.refreshPillText}>
                {refreshing ? "Loading..." : "Refresh"}
              </ThemedText>
            </Pressable>
            <ThemedText style={styles.pillAdded}>+{totals.added}</ThemedText>
            <ThemedText style={styles.pillRemoved}>
              -{totals.removed}
            </ThemedText>
          </View>
        </View>

        {loadError ? (
          <ThemedText style={styles.errorText}>{loadError}</ThemedText>
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
                  expandedFile === file.id && styles.pillHeaderExpanded,
                ]}
              >
                <ThemedText style={styles.filePath} numberOfLines={1}>
                  {file.path}
                </ThemedText>
                <View style={styles.pillStats}>
                  <ThemedText style={styles.pillAdded}>
                    +{file.additions}
                  </ThemedText>
                  <ThemedText style={styles.pillRemoved}>
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
                    tintColor="#666"
                    style={styles.chevron}
                  />
                </View>
              </Pressable>

              {expandedFile === file.id && file.hunks.length > 0 ? (
                <View style={styles.diffContent}>
                  {file.hunks.slice(0, 3).map((hunk) =>
                    hunk.lines.slice(0, 120).map((line) => (
                      <View key={line.id} style={styles.line}>
                        <ThemedText
                          style={[
                            styles.lineNumber,
                            line.type === "addition" && styles.addedLineNumber,
                            line.type === "deletion" &&
                              styles.removedLineNumber,
                          ]}
                        >
                          {line.newLineNumber || line.oldLineNumber || ""}
                        </ThemedText>
                        <ThemedText
                          style={[
                            styles.codeText,
                            line.type === "addition" && styles.addedCodeText,
                            line.type === "deletion" && styles.removedCodeText,
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
            <View style={styles.emptyState}>
              <ThemedText style={styles.emptyTitle}>
                No diff available
              </ThemedText>
              <ThemedText style={styles.emptyText}>
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
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#ECECEC",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  refreshPillText: {
    fontSize: 11,
    color: "#444",
    fontWeight: "600",
  },
  unstagedText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111",
  },
  badge: {
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    color: "#666",
    fontWeight: "600",
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 36,
  },
  errorText: {
    color: "#A33A3A",
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
    backgroundColor: "#ECECEC",
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 8,
  },
  pillHeaderExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: "#E5E5E5",
  },
  filePath: {
    fontSize: 12,
    color: "#444",
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
    color: "#4CAF50",
    fontSize: 12,
    fontWeight: "600",
  },
  pillRemoved: {
    color: "#FF5252",
    fontSize: 12,
    fontWeight: "600",
  },
  diffContent: {
    backgroundColor: "#EEF6F0",
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
    color: "#666",
    textAlign: "right",
    marginRight: 14,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  addedLineNumber: {
    color: "#2E7D32",
    fontWeight: "600",
  },
  removedLineNumber: {
    color: "#B33A3A",
    fontWeight: "600",
  },
  codeText: {
    flex: 1,
    fontSize: 12,
    color: "#222",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  addedCodeText: {
    color: "#1F5D2F",
  },
  removedCodeText: {
    color: "#7A2B2B",
  },
  emptyState: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E4E4E4",
    backgroundColor: "#FAFAFA",
    padding: 14,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 12,
    color: "#777",
    lineHeight: 18,
  },
});
