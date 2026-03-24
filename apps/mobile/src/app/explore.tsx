import { Link } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ProjectSidebar } from "@/components/ProjectSidebar";
import { GitCommitIcon, CodeDiffIcon } from "@/components/icons/Icon";
import { Colors } from "@/constants/theme";
import { relayService } from "@/services/relay";
import { useDiffStore } from "@/store/diff";
import { useSessionStore } from "@/store/session";
import { parseUnifiedDiff } from "@/utils/diff";
import {
  getGitCwd,
  requestGitDiff,
  requestGitStatus,
  type GitStatusResult,
} from "@/utils/git";

export default function GitScreen() {
  const [commitMessage, setCommitMessage] = useState("WIP: mobile commit");
  const [output, setOutput] = useState(
    "Run git/status to load repository state.",
  );
  const [status, setStatus] = useState<GitStatusResult | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState("");
  const [lastActionLabel, setLastActionLabel] = useState("Status");

  const projects = useSessionStore((state) => state.projects);
  const activeProjectId = useSessionStore((state) => state.activeProjectId);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setDiffSnapshot = useDiffStore((state) => state.setDiffSnapshot);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) || null,
    [activeProjectId, projects],
  );
  const gitCwd = getGitCwd(activeProject?.description);

  const loadStatus = useCallback(async () => {
    if (!gitCwd) {
      setOutput(
        "Git actions require an active project with a local working directory.",
      );
      return;
    }

    setPendingAction("status");
    try {
      const result = await requestGitStatus(gitCwd);
      setStatus(result);
      setOutput("Git status refreshed.");
      setLastActionLabel("Status");
    } catch (error) {
      setOutput(error instanceof Error ? error.message : String(error));
    } finally {
      setPendingAction("");
    }
  }, [gitCwd]);

  useEffect(() => {
    if (!gitCwd || !relayService.isSecureReady()) {
      return;
    }

    void loadStatus();
  }, [gitCwd, loadStatus]);

  async function loadDiffIntoPanel() {
    if (!gitCwd || !activeSessionId) {
      setOutput("Diff requires an active session and local working directory.");
      return;
    }

    setPendingAction("diff");
    try {
      const result = await requestGitDiff(gitCwd);
      const patch = (result?.patch || "").trim();
      const parsedFiles = patch ? parseUnifiedDiff(patch) : [];
      setDiffSnapshot(activeSessionId, parsedFiles, {
        preserveSelection: false,
      });
      setLastActionLabel("Diff");
      setOutput(
        patch
          ? `Loaded ${parsedFiles.length} changed file(s) into Diff Panel.`
          : "No git diff returned for the active project.",
      );
    } catch (error) {
      setOutput(error instanceof Error ? error.message : String(error));
    } finally {
      setPendingAction("");
    }
  }

  async function runGitAction(
    method:
      | "git/pull"
      | "git/push"
      | "git/stash"
      | "git/stashPop"
      | "git/branches"
      | "git/commit",
    params: Record<string, unknown> = {},
  ) {
    if (!gitCwd) {
      setOutput(
        "Git actions require an active project with a local working directory.",
      );
      return;
    }

    setPendingAction(method);
    try {
      const result = await relayService.requestJson(method, {
        cwd: gitCwd,
        ...params,
      });
      setLastActionLabel(actionLabelForMethod(method));
      setOutput(JSON.stringify(result, null, 2));
      if (method !== "git/branches") {
        await loadStatus();
      }
    } catch (error) {
      setOutput(error instanceof Error ? error.message : String(error));
    } finally {
      setPendingAction("");
    }
  }

  return (
    <View style={styles.container}>
      <ProjectSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onProjectSelect={(projectId) =>
          console.log("Project selected:", projectId)
        }
        onSessionSelect={(projectId, sessionId) =>
          console.log("Session selected:", projectId, sessionId)
        }
      />

      <View style={styles.header}>
        <Pressable
          onPress={() => setSidebarOpen(true)}
          style={styles.sessionButton}
        >
          <Text style={styles.sessionButtonText}>Sessions</Text>
        </Pressable>
        <Text style={styles.title}>Git</Text>
        <View style={{ flex: 1 }} />
        <View style={styles.headerIcons}>
          <Link href="/explore" asChild>
            <Pressable
              style={styles.headerIconButton}
              accessibilityRole="link"
              accessibilityLabel="Open git screen"
              hitSlop={8}
            >
              <GitCommitIcon color={Colors.dark.text} size={20} />
            </Pressable>
          </Link>
          <Link href="/diff" asChild>
            <Pressable
              style={styles.headerIconButton}
              accessibilityRole="link"
              accessibilityLabel="Open diff panel"
              hitSlop={8}
            >
              <CodeDiffIcon color={Colors.dark.text} size={20} />
            </Pressable>
          </Link>
        </View>
      </View>

      <View style={styles.heroCard}>
        <Text style={styles.statusPath} numberOfLines={1}>
          {gitCwd || "No local working directory bound"}
        </Text>
        <View style={styles.branchRow}>
          <Text style={styles.branchName}>{status?.branch || "-"}</Text>
          <View
            style={[
              styles.stateBadge,
              status?.dirty ? styles.stateBadgeDirty : styles.stateBadgeClean,
            ]}
          >
            <Text style={styles.stateBadgeText}>
              {status?.dirty ? "dirty" : "clean"}
            </Text>
          </View>
        </View>
        <Text style={styles.statusMeta}>
          {status?.tracking
            ? `Tracking ${status.tracking}`
            : "No upstream configured"}
        </Text>
      </View>

      <View style={styles.summaryGrid}>
        <SummaryCard label="State" value={formatGitState(status?.state)} />
        <SummaryCard
          label="Changed"
          value={String(status?.files?.length || 0)}
        />
        <SummaryCard label="Ahead" value={String(status?.ahead || 0)} />
        <SummaryCard label="Behind" value={String(status?.behind || 0)} />
      </View>

      <View style={styles.actionGroup}>
        <Text style={styles.sectionTitle}>Repository</Text>
        <View style={styles.row}>
          <ActionButton
            label="Status"
            pending={pendingAction === "status"}
            onPress={() => void loadStatus()}
          />
          <ActionButton
            label="Diff"
            pending={pendingAction === "diff"}
            onPress={() => void loadDiffIntoPanel()}
          />
          <ActionButton
            label="Branches"
            pending={pendingAction === "git/branches"}
            onPress={() => void runGitAction("git/branches")}
          />
        </View>
      </View>

      <View style={styles.actionGroup}>
        <Text style={styles.sectionTitle}>Sync</Text>
        <View style={styles.row}>
          <ActionButton
            label="Pull"
            pending={pendingAction === "git/pull"}
            onPress={() => void runGitAction("git/pull")}
          />
          <ActionButton
            label="Push"
            pending={pendingAction === "git/push"}
            onPress={() => void runGitAction("git/push")}
          />
          <ActionButton
            label="Stash"
            pending={pendingAction === "git/stash"}
            onPress={() => void runGitAction("git/stash")}
          />
          <ActionButton
            label="Stash Pop"
            pending={pendingAction === "git/stashPop"}
            onPress={() => void runGitAction("git/stashPop")}
          />
        </View>
      </View>

      <View style={styles.commitRow}>
        <TextInput
          value={commitMessage}
          onChangeText={setCommitMessage}
          style={styles.input}
          placeholder="Commit message"
          placeholderTextColor="#7d7d7d"
        />
        <ActionButton
          label="Commit"
          pending={pendingAction === "git/commit"}
          onPress={() =>
            void runGitAction("git/commit", {
              message: commitMessage,
            })
          }
        />
      </View>

      <View style={styles.filesCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Changed Files</Text>
          <Text style={styles.sectionMeta}>{status?.files?.length || 0}</Text>
        </View>
        <ScrollView style={styles.filesList} nestedScrollEnabled>
          {(status?.files || []).length > 0 ? (
            (status?.files || []).map((file) => (
              <View key={`${file.status}-${file.path}`} style={styles.fileRow}>
                <Text style={styles.fileStatus}>{file.status || "?"}</Text>
                <Text style={styles.filePath} numberOfLines={1}>
                  {file.path}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyFilesText}>No changed files.</Text>
          )}
        </ScrollView>
      </View>

      <View style={styles.outputCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Last Result</Text>
          <Text style={styles.sectionMeta}>{lastActionLabel}</Text>
        </View>
        <ScrollView style={styles.outputBox}>
          <Text style={styles.outputText}>{output}</Text>
        </ScrollView>
      </View>
    </View>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function ActionButton({
  label,
  pending,
  onPress,
}: {
  label: string;
  pending: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Text style={styles.buttonText}>{pending ? "Loading..." : label}</Text>
    </Pressable>
  );
}

function formatGitState(state?: string) {
  if (!state) {
    return "-";
  }

  return state.replace(/_/g, " ");
}

function actionLabelForMethod(method: string) {
  switch (method) {
    case "git/pull":
      return "Pull";
    case "git/push":
      return "Push";
    case "git/stash":
      return "Stash";
    case "git/stashPop":
      return "Stash Pop";
    case "git/branches":
      return "Branches";
    case "git/commit":
      return "Commit";
    default:
      return method;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b0b0b",
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingTop: 48,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  headerIcons: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  headerIconButton: {
    minWidth: 36,
    minHeight: 36,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3a3a3a",
    backgroundColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
  },
  sessionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3a3a3a",
    backgroundColor: "#1a1a1a",
  },
  sessionButtonText: {
    color: "#f0f0f0",
    fontSize: 13,
    fontWeight: "600",
  },
  title: {
    color: "#f0f0f0",
    fontSize: 20,
    fontWeight: "700",
  },
  heroCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2b2b2b",
    backgroundColor: "#121212",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  statusPath: {
    color: "#c8c8c8",
    fontSize: 12,
  },
  branchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  branchName: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
  },
  stateBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  stateBadgeDirty: {
    backgroundColor: "#3a1f1f",
  },
  stateBadgeClean: {
    backgroundColor: "#18311f",
  },
  stateBadgeText: {
    color: "#f5f5f5",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  statusMeta: {
    color: "#9f9f9f",
    fontSize: 12,
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    backgroundColor: "#111111",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  summaryLabel: {
    color: "#8f8f8f",
    fontSize: 10,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  summaryValue: {
    color: "#f0f0f0",
    fontSize: 15,
    fontWeight: "700",
  },
  actionGroup: {
    gap: 8,
  },
  row: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  commitRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionTitle: {
    color: "#f0f0f0",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  sectionMeta: {
    color: "#8f8f8f",
    fontSize: 12,
  },
  input: {
    flex: 1,
    borderRadius: 8,
    borderColor: "#333",
    borderWidth: 1,
    color: "#eee",
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#171717",
  },
  button: {
    borderRadius: 8,
    backgroundColor: "#2f4f8f",
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 84,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
  filesCard: {
    flex: 1,
    minHeight: 170,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2b2b2b",
    backgroundColor: "#111111",
    padding: 12,
  },
  filesList: {
    flex: 1,
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1d1d1d",
  },
  fileStatus: {
    width: 28,
    color: "#7fc7ff",
    fontFamily: "monospace",
    fontSize: 11,
    fontWeight: "700",
  },
  filePath: {
    flex: 1,
    color: "#dddddd",
    fontSize: 13,
    fontFamily: "monospace",
  },
  emptyFilesText: {
    color: "#8f8f8f",
    fontSize: 13,
    paddingVertical: 10,
  },
  outputCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2b2b2b",
    backgroundColor: "#111111",
    padding: 12,
  },
  outputBox: {
    flex: 1,
  },
  outputText: {
    color: "#d9d9d9",
    fontFamily: "monospace",
    fontSize: 12,
  },
});
