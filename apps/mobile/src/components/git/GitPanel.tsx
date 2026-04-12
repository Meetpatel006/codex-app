import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  RefreshControl,
  ScrollView,
} from "react-native";
import { Image } from "expo-image";
import {
  GitBranch,
  ArrowDown,
  ArrowUp,
  Plus,
  Trash2,
  X,
  CheckCircle2,
  ChevronDown,
  RefreshCw,
} from "lucide-react-native";
import { useTheme } from "@/hooks/use-theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { ThemedText } from "@/components/themed-text";
import {
  captureTelemetryError,
  trackTelemetryEvent,
} from "@/services/telemetry";
import {
  getGitCwd,
  type GitStatusResult,
  type GitCommit,
  type GitCommitDetails,
  type GitBranchResult,
  requestGitStatus,
  requestGitStage,
  requestGitUnstage,
  requestGitDiscard,
  requestGitCommit,
  requestGitPull,
  requestGitPush,
  requestGitBranches,
  requestGitCheckout,
  requestGitCreateBranch,
  requestGitDeleteBranch,
  requestGitLog,
  requestGitCommitDetails,
} from "@/utils/git";
import { getVscodeIconUrlForEntry } from "@/utils/vscode-icons";
import { useSessionStore } from "@/store/session";
import { StatusBadge } from "./StatusBadge";
import { SpinnerIcon } from "./SpinnerIcon";

type GitPanelProps = {
  onClose?: () => void;
};

type TabId = "changes" | "history" | "branches";

export function GitPanel({ onClose }: GitPanelProps) {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const projects = useSessionStore((state) => state.projects);
  const activeProjectId = useSessionStore((state) => state.activeProjectId);

  const [activeTab, setActiveTab] = useState<TabId>("changes");
  const [status, setStatus] = useState<GitStatusResult | null>(null);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [branches, setBranches] = useState<GitBranchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [commitDetails, setCommitDetails] = useState<GitCommitDetails | null>(
    null,
  );
  const [commitDetailsLoading, setCommitDetailsLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [pullLoading, setPullLoading] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [stagingPaths, setStagingPaths] = useState<Set<string>>(new Set());
  const [discardingPaths, setDiscardingPaths] = useState<Set<string>>(
    new Set(),
  );
  const [creatingBranch, setCreatingBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [showNewBranchInput, setShowNewBranchInput] = useState(false);

  const activeProject = projects.find((p) => p.id === activeProjectId) || null;
  const gitCwd = getGitCwd(activeProject?.description);

  useEffect(() => {
    trackTelemetryEvent("git_panel_viewed", {
      has_git_cwd: Boolean(gitCwd),
    });
  }, [gitCwd]);

  const loadStatus = useCallback(async () => {
    if (!gitCwd) return;
    try {
      const result = await requestGitStatus(gitCwd);
      setStatus(result);
      trackTelemetryEvent("git_status_loaded", {
        staged_count: Array.isArray(result?.staged) ? result.staged.length : 0,
        unstaged_count: Array.isArray(result?.unstaged)
          ? result.unstaged.length
          : 0,
        untracked_count: Array.isArray(result?.untracked)
          ? result.untracked.length
          : 0,
        ahead: Number(result?.ahead || 0),
        behind: Number(result?.behind || 0),
      });
    } catch (err) {
      console.error("Failed to load git status:", err);
      captureTelemetryError(err, {
        area: "git.status.load",
      });
    }
  }, [gitCwd]);

  const loadHistory = useCallback(async () => {
    if (!gitCwd) return;
    setHistoryLoading(true);
    try {
      const result = await requestGitLog(gitCwd, 50);
      setCommits(result.commits || []);
      trackTelemetryEvent("git_history_loaded", {
        commit_count: Array.isArray(result?.commits) ? result.commits.length : 0,
      });
    } catch (err) {
      console.error("Failed to load git log:", err);
      captureTelemetryError(err, {
        area: "git.history.load",
      });
    } finally {
      setHistoryLoading(false);
    }
  }, [gitCwd]);

  const loadBranches = useCallback(async () => {
    if (!gitCwd) return;
    try {
      const result = await requestGitBranches(gitCwd);
      setBranches(result);
      trackTelemetryEvent("git_branches_loaded", {
        branch_count: Array.isArray(result?.branches) ? result.branches.length : 0,
      });
    } catch (err) {
      console.error("Failed to load branches:", err);
      captureTelemetryError(err, {
        area: "git.branches.load",
      });
    }
  }, [gitCwd]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadStatus(), loadHistory(), loadBranches()]);
    setLoading(false);
  }, [loadStatus, loadHistory, loadBranches]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const onRefresh = useCallback(async () => {
    trackTelemetryEvent("git_panel_refreshed");
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const handleStage = useCallback(
    async (paths: string[]) => {
      if (!gitCwd || paths.length === 0) return;
      setStagingPaths(new Set(paths));
      try {
        await requestGitStage(gitCwd, paths);
        trackTelemetryEvent("git_stage_completed", {
          file_count: paths.length,
        });
        await loadStatus();
      } catch (err) {
        console.error("Failed to stage:", err);
        captureTelemetryError(err, {
          area: "git.stage",
          properties: {
            file_count: paths.length,
          },
        });
        Alert.alert(
          "Error",
          err instanceof Error ? err.message : "Failed to stage files",
        );
      } finally {
        setStagingPaths(new Set());
      }
    },
    [gitCwd, loadStatus],
  );

  const handleUnstage = useCallback(
    async (paths: string[]) => {
      if (!gitCwd || paths.length === 0) return;
      setStagingPaths(new Set(paths));
      try {
        await requestGitUnstage(gitCwd, paths);
        trackTelemetryEvent("git_unstage_completed", {
          file_count: paths.length,
        });
        await loadStatus();
      } catch (err) {
        console.error("Failed to unstage:", err);
        captureTelemetryError(err, {
          area: "git.unstage",
          properties: {
            file_count: paths.length,
          },
        });
        Alert.alert(
          "Error",
          err instanceof Error ? err.message : "Failed to unstage files",
        );
      } finally {
        setStagingPaths(new Set());
      }
    },
    [gitCwd, loadStatus],
  );

  const handleDiscard = useCallback(
    async (paths: string[]) => {
      if (!gitCwd || paths.length === 0) return;
      setDiscardingPaths(new Set(paths));
      try {
        await requestGitDiscard(gitCwd, paths);
        trackTelemetryEvent("git_discard_completed", {
          file_count: paths.length,
        });
        await loadStatus();
      } catch (err) {
        console.error("Failed to discard:", err);
        captureTelemetryError(err, {
          area: "git.discard",
          properties: {
            file_count: paths.length,
          },
        });
        Alert.alert(
          "Error",
          err instanceof Error ? err.message : "Failed to discard changes",
        );
      } finally {
        setDiscardingPaths(new Set());
      }
    },
    [gitCwd, loadStatus],
  );

  const handleDiscardAll = useCallback(async () => {
    if (!gitCwd) return;
    Alert.alert(
      "Discard All Changes",
      "Are you sure you want to discard all changes? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: async () => {
            try {
              await requestGitDiscard(gitCwd, undefined, true);
              trackTelemetryEvent("git_discard_all_completed");
              await loadStatus();
            } catch (err) {
              captureTelemetryError(err, {
                area: "git.discard_all",
              });
              Alert.alert(
                "Error",
                err instanceof Error
                  ? err.message
                  : "Failed to discard changes",
              );
            }
          },
        },
      ],
    );
  }, [gitCwd, loadStatus]);

  const handleCommit = useCallback(async () => {
    if (!gitCwd || !message.trim()) return;
    setLoading(true);
    try {
      await requestGitCommit(gitCwd, message.trim());
      trackTelemetryEvent("git_commit_completed", {
        message_length: message.trim().length,
      });
      setMessage("");
      await loadAll();
    } catch (err) {
      captureTelemetryError(err, {
        area: "git.commit",
        properties: {
          message_length: message.trim().length,
        },
      });
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Failed to commit",
      );
    } finally {
      setLoading(false);
    }
  }, [gitCwd, message, loadAll]);

  const handlePull = useCallback(async () => {
    if (!gitCwd) return;
    setPullLoading(true);
    try {
      await requestGitPull(gitCwd);
      trackTelemetryEvent("git_pull_completed");
      await loadAll();
    } catch (err) {
      captureTelemetryError(err, {
        area: "git.pull",
      });
      Alert.alert(
        "Pull Failed",
        err instanceof Error ? err.message : "Failed to pull",
      );
    } finally {
      setPullLoading(false);
    }
  }, [gitCwd, loadAll]);

  const handlePush = useCallback(async () => {
    if (!gitCwd) return;
    setPushLoading(true);
    try {
      await requestGitPush(gitCwd);
      trackTelemetryEvent("git_push_completed");
      await loadAll();
    } catch (err) {
      captureTelemetryError(err, {
        area: "git.push",
      });
      Alert.alert(
        "Push Failed",
        err instanceof Error ? err.message : "Failed to push",
      );
    } finally {
      setPushLoading(false);
    }
  }, [gitCwd, loadAll]);

  const handleCheckout = useCallback(
    async (branch: string) => {
      if (!gitCwd) return;
      setLoading(true);
      try {
        await requestGitCheckout(gitCwd, branch);
        trackTelemetryEvent("git_checkout_completed");
        await loadAll();
      } catch (err) {
        captureTelemetryError(err, {
          area: "git.checkout",
        });
        Alert.alert(
          "Checkout Failed",
          err instanceof Error ? err.message : "Failed to checkout branch",
        );
      } finally {
        setLoading(false);
      }
    },
    [gitCwd, loadAll],
  );

  const handleCreateBranch = useCallback(async () => {
    if (!gitCwd || !newBranchName.trim()) return;
    setCreatingBranch(true);
    try {
      await requestGitCreateBranch(gitCwd, newBranchName.trim());
      trackTelemetryEvent("git_branch_created", {
        branch_name_length: newBranchName.trim().length,
      });
      setNewBranchName("");
      setShowNewBranchInput(false);
      await loadAll();
    } catch (err) {
      captureTelemetryError(err, {
        area: "git.branch_create",
        properties: {
          branch_name_length: newBranchName.trim().length,
        },
      });
      Alert.alert(
        "Create Branch Failed",
        err instanceof Error ? err.message : "Failed to create branch",
      );
    } finally {
      setCreatingBranch(false);
    }
  }, [gitCwd, newBranchName, loadAll]);

  useEffect(() => {
    if (activeTab !== "branches") {
      setShowNewBranchInput(false);
    }
  }, [activeTab]);

  useEffect(() => {
    trackTelemetryEvent("git_tab_selected", {
      tab: activeTab,
    });
  }, [activeTab]);

  const handleDeleteBranch = useCallback(
    async (branch: string) => {
      if (!gitCwd) return;
      Alert.alert(
        "Delete Branch",
        `Are you sure you want to delete branch "${branch}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await requestGitDeleteBranch(gitCwd, branch);
                trackTelemetryEvent("git_branch_deleted");
                await loadBranches();
              } catch (err) {
                captureTelemetryError(err, {
                  area: "git.branch_delete",
                });
                Alert.alert(
                  "Delete Failed",
                  err instanceof Error
                    ? err.message
                    : "Failed to delete branch",
                );
              }
            },
          },
        ],
      );
    },
    [gitCwd, loadBranches],
  );

  const handleCommitDetails = useCallback(
    async (hash: string) => {
      if (!gitCwd) return;
      setCommitDetailsLoading(true);
      try {
        const result = await requestGitCommitDetails(gitCwd, hash);
        setCommitDetails(result);
        trackTelemetryEvent("git_commit_details_viewed");
      } catch (err) {
        captureTelemetryError(err, {
          area: "git.commit_details",
        });
        Alert.alert(
          "Error",
          err instanceof Error ? err.message : "Failed to load commit details",
        );
      } finally {
        setCommitDetailsLoading(false);
      }
    },
    [gitCwd],
  );

  const stagedFiles = useMemo(() => {
    if (Array.isArray(status?.staged)) return status.staged;
    if (!status?.files) return [];
    return status.files
      .filter((f) => {
        const s = f.status[0];
        return s !== " " && s !== "?";
      })
      .map((f) => ({ path: f.path, status: f.status[0] || "M" }));
  }, [status?.staged, status?.files]);

  const unstagedFiles = useMemo(() => {
    if (Array.isArray(status?.unstaged)) return status.unstaged;
    if (!status?.files) return [];
    return status.files
      .filter((f) => {
        const s = f.status[1];
        return s !== " " && s !== "?";
      })
      .map((f) => ({ path: f.path, status: f.status[1] || "M" }));
  }, [status?.unstaged, status?.files]);

  const untrackedFiles = useMemo(() => {
    if (Array.isArray(status?.untracked)) return status.untracked;
    if (!status?.files) return [];
    return status.files.filter((f) => f.status === "??").map((f) => f.path);
  }, [status?.untracked, status?.files]);

  const hasStaged = stagedFiles.length > 0;
  const hasUnstaged = unstagedFiles.length > 0 || untrackedFiles.length > 0;
  const currentBranch = status?.branch || branches?.current || "-";
  const ahead = status?.ahead || 0;
  const behind = status?.behind || 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { borderBottomColor: theme.backgroundSelected + "80" },
        ]}
      >
        <ThemedText style={styles.headerTitle}>Git</ThemedText>
        <Pressable onPress={onRefresh} style={styles.refreshButton}>
          {refreshing ? (
            <SpinnerIcon size={20} color={theme.textSecondary} />
          ) : (
            <RefreshCw size={20} color={theme.textSecondary} strokeWidth={2} />
          )}
        </Pressable>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {(["changes", "history", "branches"] as TabId[]).map((tab) => {
          const isActive = activeTab === tab;
          const uniqueChangeCount = new Set([
            ...stagedFiles.map((f) => f.path),
            ...unstagedFiles.map((f) => f.path),
            ...untrackedFiles,
          ]).size;
          const count =
            tab === "changes"
              ? uniqueChangeCount
              : tab === "history"
                ? commits.length
                : branches?.branches.length || 0;

          return (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[
                styles.tab,
                { borderBottomColor: isActive ? theme.text : "transparent" },
              ]}
            >
              <ThemedText
                style={[
                  styles.tabText,
                  { color: isActive ? theme.text : theme.textSecondary },
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </ThemedText>
              {count > 0 && (
                <View
                  style={[
                    styles.tabBadge,
                    {
                      backgroundColor: isActive
                        ? theme.accent
                        : theme.backgroundSelected,
                    },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.tabBadgeText,
                      { color: isActive ? "#fff" : theme.textSecondary },
                    ]}
                  >
                    {count > 99 ? "99+" : count}
                  </ThemedText>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Tab Content */}
      {activeTab === "changes" && (
        <ChangesTab
          theme={theme}
          colorScheme={colorScheme}
          stagedFiles={stagedFiles}
          unstagedFiles={unstagedFiles}
          untrackedFiles={untrackedFiles}
          stagingPaths={stagingPaths}
          discardingPaths={discardingPaths}
          hasStaged={hasStaged}
          hasUnstaged={hasUnstaged}
          onStage={handleStage}
          onUnstage={handleUnstage}
          onDiscard={handleDiscard}
          onDiscardAll={handleDiscardAll}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      )}

      {activeTab === "history" && (
        <HistoryTab
          theme={theme}
          commits={commits}
          loading={historyLoading}
          onLoadMore={loadHistory}
          onCommitDetails={handleCommitDetails}
          commitDetails={commitDetails}
          commitDetailsLoading={commitDetailsLoading}
        />
      )}

      {activeTab === "branches" && (
        <BranchesTab
          theme={theme}
          branches={branches}
          currentBranch={currentBranch}
          loading={loading}
          onCheckout={handleCheckout}
          onDeleteBranch={handleDeleteBranch}
        />
      )}

      {/* Bottom Bar */}
      <View
        style={[
          styles.bottomBar,
          { borderTopColor: theme.backgroundSelected + "80" },
        ]}
      >
        <View style={styles.branchInfo}>
          <GitBranch size={13} color={theme.gitAdded} strokeWidth={2} />
          <ThemedText style={[styles.branchName, { color: theme.text }]}>
            {currentBranch}
          </ThemedText>
          {ahead > 0 && (
            <View style={styles.syncIndicator}>
              <ArrowUp size={10} color={theme.gitAdded} />
              <ThemedText style={[styles.syncText, { color: theme.gitAdded }]}>
                {ahead}
              </ThemedText>
            </View>
          )}
          {behind > 0 && (
            <View style={styles.syncIndicator}>
              <ArrowDown size={10} color={theme.gitModified} />
              <ThemedText
                style={[styles.syncText, { color: theme.gitModified }]}
              >
                {behind}
              </ThemedText>
            </View>
          )}
        </View>

        {activeTab === "branches" ? (
          <Pressable
            onPress={() => setShowNewBranchInput(true)}
            style={[
              styles.newBranchBottomButton,
              { backgroundColor: theme.gitAdded + "18" },
            ]}
          >
            <Plus size={13} color={theme.gitAdded} />
            <ThemedText
              style={[
                styles.newBranchBottomButtonText,
                { color: theme.gitAdded },
              ]}
            >
              New Branch
            </ThemedText>
          </Pressable>
        ) : (
          <View style={styles.syncButtons}>
            <Pressable
              onPress={handlePull}
              disabled={pullLoading}
              style={[
                styles.syncButton,
                { backgroundColor: theme.gitInfo + "18" },
              ]}
            >
              {pullLoading ? (
                <SpinnerIcon size={13} color={theme.gitInfo} />
              ) : (
                <>
                  <ArrowDown size={13} color={theme.gitInfo} />
                  <ThemedText
                    style={[styles.syncButtonText, { color: theme.gitInfo }]}
                  >
                    Pull
                  </ThemedText>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={handlePush}
              disabled={pushLoading}
              style={[
                styles.syncButton,
                { backgroundColor: theme.gitAdded + "18" },
              ]}
            >
              {pushLoading ? (
                <SpinnerIcon size={13} color={theme.gitAdded} />
              ) : (
                <>
                  <ArrowUp size={13} color={theme.gitAdded} />
                  <ThemedText
                    style={[styles.syncButtonText, { color: theme.gitAdded }]}
                  >
                    Push
                  </ThemedText>
                </>
              )}
            </Pressable>
          </View>
        )}
      </View>

      {activeTab === "branches" && showNewBranchInput && (
        <View
          style={[
            styles.branchInputBar,
            { borderTopColor: theme.backgroundSelected + "80" },
          ]}
        >
          <TextInput
            value={newBranchName}
            onChangeText={setNewBranchName}
            placeholder="feature/my-branch"
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.branchInput,
              {
                color: theme.text,
              },
            ]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            onPress={() => {
              setShowNewBranchInput(false);
              setNewBranchName("");
            }}
            style={[
              styles.branchInputCancel,
              { backgroundColor: theme.backgroundSelected },
            ]}
          >
            <X size={13} color={theme.textSecondary} strokeWidth={2} />
          </Pressable>
          <Pressable
            onPress={handleCreateBranch}
            disabled={creatingBranch || !newBranchName.trim()}
            style={[
              styles.branchInputSubmit,
              {
                backgroundColor: newBranchName.trim()
                  ? theme.gitAdded + "18"
                  : theme.backgroundSelected,
              },
            ]}
          >
            {creatingBranch ? (
              <SpinnerIcon size={14} color={theme.gitAdded} />
            ) : (
              <ArrowUp
                size={14}
                color={
                  newBranchName.trim() ? theme.gitAdded : theme.textSecondary
                }
                strokeWidth={2.5}
              />
            )}
          </Pressable>
        </View>
      )}

      {/* Commit Input Bar */}
      {hasStaged && activeTab !== "branches" && !showNewBranchInput && (
        <View
          style={[
            styles.commitBar,
            { borderTopColor: theme.backgroundSelected + "80" },
          ]}
        >
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Commit message..."
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.commitInput,
              {
                backgroundColor: theme.backgroundSelected,
                color: theme.text,
              },
            ]}
            multiline
          />
          {message.length > 0 && (
            <Pressable
              onPress={() => setMessage("")}
              style={[
                styles.commitClearButton,
                { backgroundColor: theme.backgroundSelected },
              ]}
            >
              <X size={14} color={theme.textSecondary} />
            </Pressable>
          )}
          <Pressable
            onPress={handleCommit}
            disabled={loading || !message.trim()}
            style={[
              styles.commitButton,
              {
                backgroundColor: message.trim()
                  ? theme.gitAdded + "18"
                  : theme.backgroundSelected,
              },
            ]}
          >
            <ArrowUp
              size={14}
              color={message.trim() ? theme.gitAdded : theme.textSecondary}
            />
          </Pressable>
        </View>
      )}
    </View>
  );
}

type ChangesTabProps = {
  theme: any;
  colorScheme: "light" | "dark" | "unspecified" | null | undefined;
  stagedFiles: Array<{ path: string; status: string }>;
  unstagedFiles: Array<{ path: string; status: string }>;
  untrackedFiles: string[];
  stagingPaths: Set<string>;
  discardingPaths: Set<string>;
  hasStaged: boolean;
  hasUnstaged: boolean;
  onStage: (paths: string[]) => void;
  onUnstage: (paths: string[]) => void;
  onDiscard: (paths: string[]) => void;
  onDiscardAll: () => void;
  refreshing: boolean;
  onRefresh: () => void;
};

function ChangesTab({
  theme,
  colorScheme,
  stagedFiles,
  unstagedFiles,
  untrackedFiles,
  stagingPaths,
  discardingPaths,
  hasStaged,
  hasUnstaged,
  onStage,
  onUnstage,
  onDiscard,
  onDiscardAll,
  refreshing,
  onRefresh,
}: ChangesTabProps) {
  if (!hasStaged && !hasUnstaged) {
    return (
      <View style={styles.cleanState}>
        <CheckCircle2 size={48} color={theme.textSecondary} strokeWidth={1.5} />
        <ThemedText style={[styles.cleanText, { color: theme.textSecondary }]}>
          Working tree clean
        </ThemedText>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.tabContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.textSecondary}
        />
      }
    >
      {hasStaged && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText
              style={[styles.sectionTitle, { color: theme.gitAdded }]}
            >
              Staged · {stagedFiles.length}
            </ThemedText>
            <Pressable
              onPress={() => onUnstage(stagedFiles.map((f) => f.path))}
              style={[
                styles.sectionAction,
                { backgroundColor: theme.gitDeleted + "18" },
              ]}
            >
              <ThemedText
                style={[styles.sectionActionText, { color: theme.gitDeleted }]}
              >
                Unstage all
              </ThemedText>
            </Pressable>
          </View>

          {stagedFiles.map((file) => {
            const isStaging = stagingPaths.has(file.path);
            return (
              <Pressable
                key={file.path}
                onPress={() => onUnstage([file.path])}
                style={[
                  styles.fileRow,
                  { backgroundColor: theme.backgroundSelected + "40" },
                ]}
              >
                <StatusBadge status={file.status} />
                <View style={styles.fileTextBlock}>
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
                    style={[styles.fileName, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {getDisplayFileName(file.path)}
                  </ThemedText>
                </View>
                {isStaging ? (
                  <View style={styles.fileAction}>
                    <SpinnerIcon size={12} color={theme.gitDeleted} />
                  </View>
                ) : (
                  <Pressable
                    onPress={() => onUnstage([file.path])}
                    style={[
                      styles.fileActionButton,
                      { backgroundColor: theme.gitDeleted + "18" },
                    ]}
                  >
                    <X size={12} color={theme.gitDeleted} strokeWidth={2.5} />
                  </Pressable>
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      {hasUnstaged && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText
              style={[styles.sectionTitle, { color: theme.gitModified }]}
            >
              Changes · {unstagedFiles.length + untrackedFiles.length}
            </ThemedText>
            <View style={styles.sectionActions}>
              <Pressable
                onPress={() =>
                  onStage([
                    ...unstagedFiles.map((f) => f.path),
                    ...untrackedFiles,
                  ])
                }
                style={[
                  styles.sectionAction,
                  { backgroundColor: theme.gitAdded + "18" },
                ]}
              >
                <ThemedText
                  style={[styles.sectionActionText, { color: theme.gitAdded }]}
                >
                  Stage all
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={onDiscardAll}
                style={[
                  styles.sectionAction,
                  { backgroundColor: theme.gitDeleted + "18" },
                ]}
              >
                <ThemedText
                  style={[
                    styles.sectionActionText,
                    { color: theme.gitDeleted },
                  ]}
                >
                  Discard all
                </ThemedText>
              </Pressable>
            </View>
          </View>

          {unstagedFiles.map((file) => {
            const isDiscarding = discardingPaths.has(file.path);
            return (
              <Pressable
                key={file.path}
                onPress={() => onStage([file.path])}
                style={[
                  styles.fileRow,
                  { backgroundColor: theme.backgroundSelected + "40" },
                ]}
              >
                <StatusBadge status={file.status} />
                <View style={styles.fileTextBlock}>
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
                    style={[styles.fileName, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {getDisplayFileName(file.path)}
                  </ThemedText>
                </View>
                <View style={styles.fileActions}>
                  {isDiscarding ? (
                    <View style={styles.fileAction}>
                      <SpinnerIcon size={12} color={theme.gitDeleted} />
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => onDiscard([file.path])}
                      style={[
                        styles.fileActionButton,
                        { backgroundColor: theme.gitDeleted + "18" },
                      ]}
                    >
                      <Trash2
                        size={12}
                        color={theme.gitDeleted}
                        strokeWidth={2.5}
                      />
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => onStage([file.path])}
                    style={[
                      styles.fileActionButton,
                      { backgroundColor: theme.gitAdded + "18" },
                    ]}
                  >
                    <Plus size={12} color={theme.gitAdded} strokeWidth={2.5} />
                  </Pressable>
                </View>
              </Pressable>
            );
          })}

          {untrackedFiles.map((path) => {
            const isStaging = stagingPaths.has(path);
            return (
              <Pressable
                key={path}
                onPress={() => onStage([path])}
                style={[
                  styles.fileRow,
                  { backgroundColor: theme.backgroundSelected + "40" },
                ]}
              >
                <StatusBadge status="?" />
                <View style={styles.fileTextBlock}>
                  <Image
                    source={getVscodeIconUrlForEntry(
                      path,
                      "file",
                      colorScheme === "dark" ? "dark" : "light",
                    )}
                    style={styles.fileIcon}
                    contentFit="contain"
                  />
                  <ThemedText
                    style={[styles.fileName, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {getDisplayFileName(path)}
                  </ThemedText>
                </View>
                {isStaging ? (
                  <View style={styles.fileAction}>
                    <SpinnerIcon size={12} color={theme.gitAdded} />
                  </View>
                ) : (
                  <Pressable
                    onPress={() => onStage([path])}
                    style={[
                      styles.fileActionButton,
                      { backgroundColor: theme.gitAdded + "18" },
                    ]}
                  >
                    <Plus size={12} color={theme.gitAdded} strokeWidth={2.5} />
                  </Pressable>
                )}
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

type HistoryTabProps = {
  theme: any;
  commits: GitCommit[];
  loading: boolean;
  onLoadMore: () => void;
  onCommitDetails: (hash: string) => void;
  commitDetails: GitCommitDetails | null;
  commitDetailsLoading: boolean;
};

function HistoryTab({
  theme,
  commits,
  loading,
  onLoadMore,
  onCommitDetails,
  commitDetails,
  commitDetailsLoading,
}: HistoryTabProps) {
  const timeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  if (loading && commits.length === 0) {
    return (
      <View style={styles.loadingState}>
        <SpinnerIcon size={24} color={theme.textSecondary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      {commits.map((commit, index) => (
        <Pressable
          key={commit.hash}
          onPress={() => onCommitDetails(commit.hash)}
          style={styles.commitRow}
        >
          <View style={styles.commitGraph}>
            {index > 0 && (
              <View
                style={[
                  styles.graphLineTop,
                  { backgroundColor: theme.textSecondary + "40" },
                ]}
              />
            )}
            {index < commits.length - 1 && (
              <View
                style={[
                  styles.graphLineBottom,
                  { backgroundColor: theme.textSecondary + "40" },
                ]}
              />
            )}
            <View
              style={[
                styles.commitDot,
                {
                  backgroundColor:
                    index === 0 ? theme.gitAdded : theme.background,
                  borderColor:
                    index === 0 ? theme.gitAdded : theme.textSecondary,
                },
              ]}
            />
          </View>

          <View style={styles.commitContent}>
            <View style={styles.commitHeader}>
              {index === 0 && (
                <View
                  style={[
                    styles.headBadge,
                    { backgroundColor: theme.gitAdded + "22" },
                  ]}
                >
                  <ThemedText
                    style={[styles.headBadgeText, { color: theme.gitAdded }]}
                  >
                    HEAD
                  </ThemedText>
                </View>
              )}
              <ThemedText style={[styles.commitMessage, { color: theme.text }]}>
                {commit.message}
              </ThemedText>
            </View>

            <View style={styles.commitMeta}>
              <View
                style={[
                  styles.hashBadge,
                  { backgroundColor: theme.gitInfo + "20" },
                ]}
              >
                <ThemedText style={[styles.hashText, { color: theme.gitInfo }]}>
                  {commit.hash}
                </ThemedText>
              </View>
              <ThemedText
                style={[styles.commitAuthor, { color: theme.textSecondary }]}
                numberOfLines={1}
              >
                {commit.author} {" · "} {timeAgo(commit.date)}
              </ThemedText>
            </View>
          </View>
        </Pressable>
      ))}

      {!loading && commits.length > 0 && (
        <Pressable onPress={onLoadMore} style={styles.loadMoreButton}>
          <ThemedText
            style={[styles.loadMoreText, { color: theme.textSecondary }]}
          >
            Load more
          </ThemedText>
          <ChevronDown size={12} color={theme.textSecondary} strokeWidth={2} />
        </Pressable>
      )}
    </ScrollView>
  );
}

type BranchesTabProps = {
  theme: any;
  branches: GitBranchResult | null;
  currentBranch: string;
  loading: boolean;
  onCheckout: (branch: string) => void;
  onDeleteBranch: (branch: string) => void;
};

function BranchesTab({
  theme,
  branches,
  currentBranch,
  loading,
  onCheckout,
  onDeleteBranch,
}: BranchesTabProps) {
  if (loading && !branches) {
    return (
      <View style={styles.loadingState}>
        <SpinnerIcon size={24} color={theme.textSecondary} />
      </View>
    );
  }

  if ((branches?.branches.length || 0) === 0) {
    return (
      <View style={styles.emptyState}>
        <GitBranch size={48} color={theme.textSecondary} strokeWidth={1.5} />
        <ThemedText
          style={[styles.emptyStateText, { color: theme.textSecondary }]}
        >
          No branches found
        </ThemedText>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      {branches?.branches.map((branch, index) => {
        const isCurrent = branch === currentBranch;
        return (
          <Pressable
            key={branch}
            onPress={() => !isCurrent && onCheckout(branch)}
            style={[
              styles.branchRow,
              {
                backgroundColor: "transparent",
                borderBottomColor:
                  index < branches.branches.length - 1
                    ? theme.backgroundSelected + "80"
                    : "transparent",
              },
            ]}
          >
            <GitBranch
              size={14}
              color={isCurrent ? theme.gitAdded : theme.textSecondary}
            />
            <ThemedText
              style={[
                styles.branchNameItem,
                { color: isCurrent ? theme.gitAdded : theme.text },
              ]}
              numberOfLines={1}
            >
              {branch}
            </ThemedText>

            {isCurrent ? (
              <View
                style={[
                  styles.currentBadge,
                  { backgroundColor: theme.gitAdded + "20" },
                ]}
              >
                <ThemedText
                  style={[styles.currentBadgeText, { color: theme.gitAdded }]}
                >
                  Current
                </ThemedText>
              </View>
            ) : (
              <Pressable onPress={() => onDeleteBranch(branch)} hitSlop={8}>
                <Trash2 size={15} color={theme.gitDeleted} strokeWidth={2} />
              </Pressable>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function getDisplayFileName(filePath: string): string {
  const normalized = (filePath || "").replace(/\\/g, "/");
  if (normalized.endsWith("/")) {
    const dirParts = normalized.split("/").filter(Boolean);
    return dirParts.length > 0
      ? `${dirParts[dirParts.length - 1]}/`
      : normalized;
  }
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0) return filePath;
  if (parts.length === 1) return parts[0];
  if (parts.length <= 3) return normalized;
  return `.../${parts.slice(-3).join("/")}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  refreshButton: {
    padding: 4,
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "#57575760",
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    marginRight: 24,
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  tabBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
    marginLeft: 2,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 14,
  },
  tabContent: {
    padding: 12,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  sectionActions: {
    flexDirection: "row",
    gap: 8,
  },
  sectionAction: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
  },
  sectionActionText: {
    fontSize: 11,
    fontWeight: "500",
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 8,
    borderRadius: 10,
    marginBottom: 4,
  },
  fileName: {
    fontSize: 14,
    flexShrink: 1,
  },
  fileTextBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  fileIcon: {
    width: 14,
    height: 14,
  },
  fileActions: {
    flexDirection: "row",
    gap: 6,
  },
  fileAction: {
    width: 26,
    height: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  fileActionButton: {
    width: 26,
    height: 26,
    borderRadius: 5,
    justifyContent: "center",
    alignItems: "center",
  },
  cleanState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 64,
  },
  cleanText: {
    fontSize: 16,
    marginTop: 16,
  },
  loadingState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 64,
  },
  commitRow: {
    flexDirection: "row",
    minHeight: 48,
    paddingRight: 12,
  },
  commitGraph: {
    width: 44,
    alignItems: "center",
    position: "relative",
  },
  graphLineTop: {
    position: "absolute",
    width: 2,
    top: 0,
    height: 22,
    left: "50%",
    marginLeft: -1,
  },
  graphLineBottom: {
    position: "absolute",
    width: 2,
    top: 29,
    bottom: 0,
    left: "50%",
    marginLeft: -1,
  },
  commitDot: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 2,
    marginTop: 17,
    zIndex: 1,
  },
  commitContent: {
    flex: 1,
    justifyContent: "center",
    paddingTop: 8,
    paddingBottom: 8,
  },
  commitHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  headBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  headBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
  },
  commitMessage: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  commitMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  hashBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  hashText: {
    fontSize: 11,
    fontFamily: "monospace",
  },
  commitAuthor: {
    fontSize: 11,
  },
  loadMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 16,
  },
  loadMoreText: {
    fontSize: 11,
  },
  branchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
  },
  branchNameItem: {
    fontSize: 14,
    flex: 1,
  },
  currentBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  currentBadgeText: {
    fontSize: 11,
    fontWeight: "500",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  emptyStateText: {
    fontSize: 16,
  },
  bottomBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopWidth: 0.5,
  },
  branchInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  branchName: {
    fontSize: 13,
    fontFamily: "monospace",
  },
  syncIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  syncText: {
    fontSize: 11,
    fontFamily: "monospace",
  },
  syncButtons: {
    flexDirection: "row",
    gap: 8,
  },
  newBranchBottomButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 8,
  },
  newBranchBottomButtonText: {
    fontSize: 13,
    fontWeight: "500",
  },
  branchInputBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopWidth: 0.5,
  },
  branchInput: {
    flex: 1,
    fontSize: 13,
    minHeight: 32,
    paddingVertical: 6,
  },
  branchInputCancel: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  branchInputSubmit: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  syncButton: {
    width: 72,
    height: 32,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  syncButtonText: {
    fontSize: 13,
    fontWeight: "500",
  },
  commitBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopWidth: 0.5,
  },
  commitInput: {
    flex: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 13,
    minHeight: 32,
    textAlignVertical: "center",
  },
  commitClearButton: {
    width: 30,
    height: 30,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  commitButton: {
    width: 30,
    height: 30,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
});
