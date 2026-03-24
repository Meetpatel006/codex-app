import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { relayService } from "@/services/relay";
import { useDiffStore } from "@/store/diff";
import { useSessionStore } from "@/store/session";
import { parseUnifiedDiff } from "@/utils/diff";
import { ThemedText } from "@/components/themed-text";
import { Input } from "@/components/ui/input";
import { getGitCwd, type GitStatusResult } from "@/utils/git";

type CommitNextStep = "commit" | "push";

type GitCommitViewProps = {
  branch: string;
  changedFiles: number;
  additions: number;
  deletions: number;
  isSubmitting?: boolean;
  statusText?: string;
  onCommit: (payload: {
    message: string;
    includeUnstaged: boolean;
    draft: boolean;
    nextStep: CommitNextStep;
  }) => void;
};

type ToggleProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
};

function CustomToggle({ value, onValueChange }: ToggleProps) {
  const translateX = useSharedValue(value ? 16 : 0);

  useEffect(() => {
    translateX.value = withTiming(value ? 16 : 0, {
      duration: 250,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, [value, translateX]);

  const animatedTrackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      translateX.value,
      [0, 16],
      ["#E9E9EB", "#000000"],
    ),
  }));

  const animatedThumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Pressable onPress={() => onValueChange(!value)}>
      <Animated.View style={[styles.toggleTrack, animatedTrackStyle]}>
        <Animated.View style={[styles.toggleThumb, animatedThumbStyle]} />
      </Animated.View>
    </Pressable>
  );
}

export function GitCommitView({
  branch,
  changedFiles,
  additions,
  deletions,
  isSubmitting,
  statusText,
  onCommit,
}: GitCommitViewProps) {
  const projects = useSessionStore((state) => state.projects);
  const activeProjectId = useSessionStore((state) => state.activeProjectId);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setDiffSnapshot = useDiffStore((state) => state.setDiffSnapshot);

  const [liveBranch, setLiveBranch] = useState<string | null>(null);
  const [liveChangedFiles, setLiveChangedFiles] = useState<number | null>(null);
  const [liveAdditions, setLiveAdditions] = useState<number | null>(null);
  const [liveDeletions, setLiveDeletions] = useState<number | null>(null);
  const [liveStatusText, setLiveStatusText] = useState("");

  const [message, setMessage] = useState("");
  const [includeUnstaged, setIncludeUnstaged] = useState(false);
  const [isDraft, setIsDraft] = useState(false);
  const [nextStep, setNextStep] = useState<CommitNextStep>("commit");

  const activeProject =
    projects.find((project) => project.id === activeProjectId) || null;
  const gitCwd = getGitCwd(activeProject?.description);

  useEffect(() => {
    let isCancelled = false;

    async function refreshLiveGitInfo() {
      if (!gitCwd || !relayService.isSecureReady()) {
        if (!isCancelled) {
          setLiveStatusText("Git status unavailable for current project.");
        }
        return;
      }

      if (!isCancelled) {
        setLiveStatusText("Loading repository status...");
      }

      try {
        const [status, diffResult] = await Promise.all([
          relayService.requestJson<GitStatusResult>("git/status", {
            cwd: gitCwd,
          }),
          relayService.requestJson<{ patch?: string }>("git/diff", {
            cwd: gitCwd,
          }),
        ]);

        if (isCancelled) {
          return;
        }

        const patch = (diffResult?.patch || "").trim();
        const parsedFiles = patch ? parseUnifiedDiff(patch) : [];
        const additionsFromPatch = parsedFiles.reduce(
          (sum, file) => sum + file.additions,
          0,
        );
        const deletionsFromPatch = parsedFiles.reduce(
          (sum, file) => sum + file.deletions,
          0,
        );

        if (activeSessionId) {
          setDiffSnapshot(activeSessionId, parsedFiles, {
            preserveSelection: true,
          });
        }

        const statusDiff = status?.diff || {};
        setLiveBranch((status?.branch || "-").trim() || "-");
        setLiveChangedFiles(parsedFiles.length || status?.files?.length || 0);
        setLiveAdditions(
          parsedFiles.length > 0
            ? additionsFromPatch
            : Number(statusDiff.additions || 0),
        );
        setLiveDeletions(
          parsedFiles.length > 0
            ? deletionsFromPatch
            : Number(statusDiff.deletions || 0),
        );
        setLiveStatusText("");
      } catch (error) {
        if (!isCancelled) {
          setLiveStatusText(
            error instanceof Error
              ? error.message
              : "Failed to load live git details.",
          );
        }
      }
    }

    void refreshLiveGitInfo();

    return () => {
      isCancelled = true;
    };
  }, [activeSessionId, gitCwd, setDiffSnapshot]);

  const nextLabel = useMemo(() => {
    if (isSubmitting) {
      return nextStep === "push" ? "Committing + pushing..." : "Committing...";
    }
    return "Continue";
  }, [isSubmitting, nextStep]);

  const branchValue = liveBranch ?? branch;
  const changedFilesValue = liveChangedFiles ?? changedFiles;
  const additionsValue = liveAdditions ?? additions;
  const deletionsValue = liveDeletions ?? deletions;
  const statusLabel = statusText || liveStatusText;

  return (
    <View style={styles.container}>
      <View style={styles.header} />

      <ThemedText style={styles.title}>Commit your changes</ThemedText>

      <View style={styles.infoRow}>
        <ThemedText style={styles.label}>Branch</ThemedText>
        <ThemedText style={styles.value}>{branchValue || "-"}</ThemedText>
      </View>

      <View style={styles.infoRow}>
        <ThemedText style={styles.label}>Changes</ThemedText>
        <View style={styles.rightInfo}>
          <ThemedText style={styles.smallLabel}>
            {changedFilesValue} files
          </ThemedText>
          <ThemedText style={styles.addedText}>+{additionsValue}</ThemedText>
          <ThemedText style={styles.removedText}>-{deletionsValue}</ThemedText>
        </View>
      </View>

      <View style={styles.toggleRow}>
        <CustomToggle
          value={includeUnstaged}
          onValueChange={setIncludeUnstaged}
        />
        <ThemedText style={styles.toggleLabel}>Include unstaged</ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionLabel}>Commit message</ThemedText>
        <Input
          placeholder="Leave blank to autogenerate a commit message"
          placeholderTextColor="#666"
          value={message}
          onChangeText={setMessage}
          multiline
          style={styles.input}
        />
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionLabel}>Next steps</ThemedText>

        <Pressable
          onPress={() => setNextStep("commit")}
          style={[
            styles.stepItem,
            nextStep === "commit" && styles.stepItemActive,
          ]}
        >
          <ThemedText style={styles.stepText}>Commit</ThemedText>
        </Pressable>

        <Pressable
          onPress={() => setNextStep("push")}
          style={[
            styles.stepItem,
            nextStep === "push" && styles.stepItemActive,
          ]}
        >
          <ThemedText style={styles.stepText}>Commit and push</ThemedText>
        </Pressable>

        <View style={[styles.stepItem, styles.stepItemDisabled]}>
          <ThemedText style={[styles.stepText, styles.stepTextDisabled]}>
            Commit and create PR
          </ThemedText>
        </View>
      </View>

      {statusLabel ? (
        <ThemedText style={styles.statusText}>{statusLabel}</ThemedText>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.draftToggle}>
          <CustomToggle value={isDraft} onValueChange={setIsDraft} />
          <ThemedText style={styles.draftLabel}>Draft</ThemedText>
        </View>
        <Pressable
          onPress={() =>
            onCommit({
              message: message.trim(),
              includeUnstaged,
              draft: isDraft,
              nextStep,
            })
          }
          disabled={!!isSubmitting}
          style={[
            styles.continueButton,
            isSubmitting && styles.continueDisabled,
          ]}
        >
          <ThemedText style={styles.continueText}>{nextLabel}</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: 40,
    backgroundColor: "#FFFFFF",
  },
  header: {
    marginBottom: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 28,
    color: "#000",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  rightInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  value: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  smallLabel: {
    fontSize: 12,
    color: "#666",
  },
  addedText: {
    color: "#4CAF50",
    fontSize: 12,
    fontWeight: "600",
  },
  removedText: {
    color: "#F44336",
    fontSize: 12,
    fontWeight: "600",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
    marginBottom: 32,
  },
  toggleTrack: {
    width: 36,
    height: 20,
    borderRadius: 10,
    padding: 2,
    justifyContent: "center",
  },
  toggleThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#FFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#000",
  },
  section: {
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 12,
    color: "#000",
  },
  input: {
    height: 64,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    textAlignVertical: "top",
    paddingTop: 12,
    backgroundColor: "#F5F5F7",
    color: "#000",
    borderColor: "transparent",
  },
  stepItem: {
    height: 48,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 2,
  },
  stepItemActive: {
    backgroundColor: "#F5F5F7",
  },
  stepItemDisabled: {
    opacity: 0.3,
  },
  stepText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  stepTextDisabled: {
    color: "#666",
  },
  statusText: {
    color: "#666",
    fontSize: 12,
    marginTop: -12,
    marginBottom: 16,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  draftToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  draftLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  continueButton: {
    paddingHorizontal: 36,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: "#000",
  },
  continueDisabled: {
    opacity: 0.7,
  },
  continueText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFF",
  },
});
