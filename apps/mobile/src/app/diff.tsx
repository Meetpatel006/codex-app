import React, { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { relayService } from "@/services/relay";
import { useDiffStore } from "@/store/diff";
import { useSessionStore } from "@/store/session";
import { summarizeParsedDiff, type ParsedDiffHunk } from "@/utils/diff";
import { parseUnifiedDiff } from "@/utils/diff";
import { getGitCwd, requestGitDiff, requestGitStatus, type GitStatusResult } from "@/utils/git";

export default function DiffScreen() {
  const projects = useSessionStore((state) => state.projects);
  const activeProjectId = useSessionStore((state) => state.activeProjectId);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const diffSession = useDiffStore((state) =>
    activeSessionId ? state.sessions[activeSessionId] : undefined,
  );
  const selectFile = useDiffStore((state) => state.selectFile);
  const setDiffSnapshot = useDiffStore((state) => state.setDiffSnapshot);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [gitStatus, setGitStatus] = useState<GitStatusResult | null>(null);
  const [loadError, setLoadError] = useState("");

  const files = diffSession?.files ?? [];
  const summary = summarizeParsedDiff(files);
  const selectedFile =
    files.find((file) => file.id === diffSession?.selectedFileId) || files[0] || null;
  const activeProject =
    projects.find((project) => project.id === activeProjectId) || null;
  const gitCwd = getGitCwd(activeProject?.description);

  useEffect(() => {
    let isCancelled = false;

    async function refreshDiffFromGit() {
      if (!activeSessionId || !gitCwd || !relayService.isSecureReady()) {
        return;
      }

      setIsRefreshing(true);
      setLoadError("");

      try {
        const [statusResult, diffResult] = await Promise.all([
          requestGitStatus(gitCwd),
          requestGitDiff(gitCwd),
        ]);

        if (isCancelled) {
          return;
        }

        setGitStatus(statusResult);
        const patch = (diffResult?.patch || "").trim();
        const parsedFiles = patch ? parseUnifiedDiff(patch) : [];
        setDiffSnapshot(activeSessionId, parsedFiles, {
          preserveSelection: true,
        });
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setLoadError(error instanceof Error ? error.message : String(error));
      } finally {
        if (!isCancelled) {
          setIsRefreshing(false);
        }
      }
    }

    void refreshDiffFromGit();

    return () => {
      isCancelled = true;
    };
  }, [activeSessionId, gitCwd, setDiffSnapshot]);

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Diff Panel</Text>
        <Pressable
          onPress={() => {
            if (activeSessionId && gitCwd && relayService.isSecureReady()) {
              setLoadError("");
              setIsRefreshing(true);
              Promise.all([requestGitStatus(gitCwd), requestGitDiff(gitCwd)])
                .then(([statusResult, diffResult]) => {
                  setGitStatus(statusResult);
                  const patch = (diffResult?.patch || "").trim();
                  const parsedFiles = patch ? parseUnifiedDiff(patch) : [];
                  setDiffSnapshot(activeSessionId, parsedFiles, {
                    preserveSelection: true,
                  });
                })
                .catch((error) => {
                  setLoadError(error instanceof Error ? error.message : String(error));
                })
                .finally(() => {
                  setIsRefreshing(false);
                });
            }
          }}
          style={styles.refreshButton}
        >
          <Text style={styles.refreshButtonText}>
            {isRefreshing ? "Loading..." : "Refresh"}
          </Text>
        </Pressable>
      </View>
      <View style={styles.summaryCard}>
        <SummaryPill label="Files" value={String(summary.files)} />
        <SummaryPill label="Additions" value={`+${summary.additions}`} positive />
        <SummaryPill label="Deletions" value={`-${summary.deletions}`} negative />
      </View>
      <View style={styles.statusSummaryRow}>
        <StatusPill label="Branch" value={gitStatus?.branch || "-"} />
        <StatusPill label="State" value={formatGitState(gitStatus?.state)} />
        <StatusPill
          label="Changed"
          value={String(gitStatus?.files?.length || files.length || 0)}
        />
      </View>
      <View style={styles.repoInfo}>
        <Text style={styles.repoInfoText} numberOfLines={1}>
          {gitCwd || "No local project path bound"}
        </Text>
        {gitStatus?.branch ? (
          <Text style={styles.repoInfoMeta}>
            {gitStatus.branch}
            {gitStatus.dirty ? "  dirty" : "  clean"}
          </Text>
        ) : null}
      </View>
      {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}

      <FlatList
        horizontal
        data={files}
        keyExtractor={(item) => item.id}
        style={styles.fileStrip}
        contentContainerStyle={styles.fileStripContent}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => {
          const selected = selectedFile?.id === item.id;
          return (
            <Pressable
              onPress={() => activeSessionId && selectFile(activeSessionId, item.id)}
              style={[styles.fileChip, selected && styles.fileChipSelected]}
            >
              <Text style={[styles.fileChipName, selected && styles.fileChipNameSelected]}>
                {item.path}
              </Text>
              <Text style={styles.fileChipStats}>
                +{item.additions} -{item.deletions}
              </Text>
            </Pressable>
          );
        }}
      />

      {!selectedFile ? (
        <StatusFilesFallback files={gitStatus?.files || []} />
      ) : (
        <>
          <View style={styles.fileHeader}>
            <Text style={styles.fileTitle}>{selectedFile.path}</Text>
            <Text style={styles.fileMeta}>
              {selectedFile.status.toUpperCase()}  +{selectedFile.additions} -{selectedFile.deletions}
            </Text>
          </View>

          <FlatList
            data={selectedFile.hunks}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.hunkList}
            renderItem={({ item }) => <HunkCard hunk={item} />}
          />
        </>
      )}
    </View>
  );
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statusPill}>
      <Text style={styles.statusPillLabel}>{label}</Text>
      <Text style={styles.statusPillValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function StatusFilesFallback({
  files,
}: {
  files: NonNullable<GitStatusResult["files"]>;
}) {
  if (!files.length) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No diff available</Text>
        <Text style={styles.emptyText}>
          No changed files were returned for the active project.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.fallbackCard}>
      <Text style={styles.fallbackTitle}>Changed Files</Text>
      {files.map((file) => (
        <View key={`${file.status}-${file.path}`} style={styles.fallbackRow}>
          <Text style={styles.fallbackStatus}>{file.status || "?"}</Text>
          <Text style={styles.fallbackPath} numberOfLines={1}>
            {file.path}
          </Text>
        </View>
      ))}
      <Text style={styles.fallbackHint}>
        Patch view is unavailable for the selected state, but the current git status file list is shown.
      </Text>
    </View>
  );
}

function formatGitState(state?: string) {
  if (!state) {
    return "-";
  }

  return state.replace(/_/g, " ");
}

function SummaryPill({
  label,
  value,
  positive,
  negative,
}: {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <View style={styles.summaryPill}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text
        style={[
          styles.summaryValue,
          positive && styles.positiveText,
          negative && styles.negativeText,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function HunkCard({ hunk }: { hunk: ParsedDiffHunk }) {
  return (
    <View style={styles.hunkCard}>
      <Text style={styles.hunkHeader}>{hunk.header}</Text>
      {hunk.lines.map((line) => (
        <View key={line.id} style={[styles.diffLine, getLineBackground(line.type)]}>
          <Text style={styles.lineNumber}>
            {line.oldLineNumber ?? ""}
          </Text>
          <Text style={styles.lineNumber}>
            {line.newLineNumber ?? ""}
          </Text>
          <Text style={[styles.lineContent, getLineTextStyle(line.type)]}>{line.content}</Text>
        </View>
      ))}
    </View>
  );
}

function getLineBackground(type: "context" | "addition" | "deletion") {
  switch (type) {
    case "addition":
      return styles.additionBackground;
    case "deletion":
      return styles.deletionBackground;
    default:
      return styles.contextBackground;
  }
}

function getLineTextStyle(type: "context" | "addition" | "deletion") {
  switch (type) {
    case "addition":
      return styles.additionText;
    case "deletion":
      return styles.deletionText;
    default:
      return styles.contextText;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b0b0b",
    paddingTop: 48,
    paddingHorizontal: 12,
  },
  title: {
    color: "#f0f0f0",
    fontSize: 24,
    fontWeight: "700",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  refreshButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#1b1b1b",
    borderWidth: 1,
    borderColor: "#2d2d2d",
  },
  refreshButtonText: {
    color: "#b9d5ff",
    fontSize: 12,
    fontWeight: "600",
  },
  summaryCard: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  statusSummaryRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  summaryPill: {
    flex: 1,
    backgroundColor: "#141414",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#262626",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  summaryLabel: {
    color: "#8f8f8f",
    fontSize: 11,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  summaryValue: {
    color: "#f0f0f0",
    fontSize: 16,
    fontWeight: "700",
  },
  positiveText: {
    color: "#6fdc8c",
  },
  negativeText: {
    color: "#ff9d9d",
  },
  statusPill: {
    flex: 1,
    backgroundColor: "#111111",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#262626",
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  statusPillLabel: {
    color: "#8f8f8f",
    fontSize: 10,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  statusPillValue: {
    color: "#f0f0f0",
    fontSize: 13,
    fontWeight: "600",
  },
  fileStrip: {
    maxHeight: 76,
    marginBottom: 12,
    flexGrow: 0,
  },
  fileStripContent: {
    gap: 8,
    paddingRight: 8,
  },
  repoInfo: {
    backgroundColor: "#111111",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#262626",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  repoInfoText: {
    color: "#d7d7d7",
    fontSize: 12,
  },
  repoInfoMeta: {
    color: "#8f8f8f",
    fontSize: 11,
    marginTop: 4,
  },
  errorText: {
    color: "#ff9d9d",
    fontSize: 12,
    marginBottom: 12,
  },
  fileChip: {
    width: 220,
    backgroundColor: "#141414",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#262626",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fileChipSelected: {
    borderColor: "#6aa9ff",
    backgroundColor: "#172133",
  },
  fileChipName: {
    color: "#f0f0f0",
    fontSize: 13,
    fontWeight: "600",
  },
  fileChipNameSelected: {
    color: "#b9d5ff",
  },
  fileChipStats: {
    color: "#8f8f8f",
    fontSize: 11,
    marginTop: 4,
    fontFamily: "monospace",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: "#f0f0f0",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  emptyText: {
    color: "#9f9f9f",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  fallbackCard: {
    backgroundColor: "#111111",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#262626",
    padding: 12,
  },
  fallbackTitle: {
    color: "#f0f0f0",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  fallbackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1e1e1e",
  },
  fallbackStatus: {
    width: 30,
    color: "#7fc7ff",
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  fallbackPath: {
    flex: 1,
    color: "#dcdcdc",
    fontSize: 13,
    fontFamily: "monospace",
  },
  fallbackHint: {
    color: "#8f8f8f",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
  fileHeader: {
    marginBottom: 10,
  },
  fileTitle: {
    color: "#f0f0f0",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  fileMeta: {
    color: "#8f8f8f",
    fontSize: 12,
    marginTop: 4,
  },
  hunkList: {
    paddingBottom: 16,
    gap: 12,
  },
  hunkCard: {
    backgroundColor: "#111111",
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#262626",
  },
  hunkHeader: {
    color: "#7fc7ff",
    backgroundColor: "#152233",
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: "monospace",
    fontSize: 12,
  },
  diffLine: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  lineNumber: {
    width: 36,
    color: "#6c6c6c",
    fontSize: 11,
    lineHeight: 18,
    textAlign: "right",
    marginRight: 8,
    fontFamily: "monospace",
  },
  lineContent: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "monospace",
  },
  contextBackground: {
    backgroundColor: "#111111",
  },
  additionBackground: {
    backgroundColor: "#142818",
  },
  deletionBackground: {
    backgroundColor: "#301717",
  },
  contextText: {
    color: "#dfdfdf",
  },
  additionText: {
    color: "#7de29a",
  },
  deletionText: {
    color: "#ffafaf",
  },
});
