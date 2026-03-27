import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MessageBubble } from "@/components/MessageBubble";
import { SessionTranscriptLoader } from "@/components/SessionTranscriptLoader";
import { ProjectSidebar } from "@/components/ProjectSidebar";
import { PromptInput } from "@/components/prompt-input";
import { ChatHeader } from "@/components/chat-header";
import { CodeDiffView } from "@/components/code-diff-view";
import { EmptyChatState } from "@/components/EmptyChatState";
import { GitCommitView } from "@/components/git-commit-view";
import { PairDeviceView } from "@/components/pair-device-view";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { SidePanel } from "@/components/ui/side-panel";
import { buildRequest } from "@/services/jsonrpc";
import { bytesToBase64, hexToBytes } from "@/services/crypto";
import { relayService } from "@/services/relay";
import { resolveTrustedSession } from "@/services/trusted-resolve";
import { useChatStore } from "@/store/chat";
import type {
  ChatMessage,
  CommandExecutionData,
  FileChangeData,
} from "@/store/chat";
import { useDiffStore } from "@/store/diff";
import { useUiStore } from "@/store/ui";
import { parseUnifiedDiff } from "@/utils/diff";
import { getGitCwd, requestGitStatus } from "@/utils/git";
import { useSessionStore } from "@/store/session";
import {
  useRuntimeOptionsStore,
  type RuntimeOptions,
  type ModelOption,
} from "@/store/runtime-options";
import { useTheme } from "@/hooks/use-theme";

type CollaborationModePayload = {
  mode: "auto" | "on-request";
};

type TurnStartRequestParams = {
  threadId?: string;
  input: {
    type: "text";
    text: string;
  }[];
  model?: string;
  effort?: string;
  collaborationMode?: CollaborationModePayload;
};

type CodexSessionSummary = {
  sessionId?: string;
  threadId?: string;
  title?: string;
  cwd?: string;
  updatedAtMs?: number;
  rolloutPath?: string;
};

type CodexSessionsListResult = {
  sessions?: CodexSessionSummary[];
};

type UpsertSystemMessageFn = (
  id: string,
  text: string,
  kind?: "thinking" | "file-change" | "plan" | "command-execution" | "normal",
  options?: { append?: boolean; streaming?: boolean },
) => void;

type RenderItem =
  | {
    type: "message";
    id: string;
    message: ChatMessage;
  }
  | {
    type: "command-group";
    id: string;
    commands: CommandExecutionData[];
  }
  | {
    type: "file-change-group";
    id: string;
    fileChanges: FileChangeData[];
  };

type RelayMessageParams = {
  delta?: string;
  textDelta?: string;
  text_delta?: string;
  text?: string;
  chunk?: string;
  message?: string;
  id?: string;
  threadId?: string;
  turnId?: string;
  itemId?: string;
  item_id?: string;
  call_id?: string;
  callId?: string;
  command?: string | string[];
  cmd?: string | string[];
  raw_command?: string;
  rawCommand?: string;
  cwd?: string;
  working_directory?: string;
  status?:
  | string
  | { type?: string; statusType?: string; status_type?: string };
  phase?: string;
  exitCode?: number;
  exit_code?: number;
  output?: string;
  durationMs?: number;
  duration_ms?: number;
  diff?: string;
  fileChanges?: FileChangeData[];
  item?: {
    id?: string;
    itemId?: string;
    item_id?: string;
    type?: string;
    role?: string;
    text?: string;
    message?: string;
    summary?: string;
  };
  msg?: Record<string, unknown> & RelayMessageParams;
};

function normalizeEventToken(value: unknown) {
  return typeof value === "string"
    ? value.toLowerCase().replace(/[_-\s]+/g, "")
    : "";
}

function incomingItemObject(params?: RelayMessageParams) {
  const eventPayload = params?.msg;
  if (params?.item && typeof params.item === "object") {
    return params.item;
  }
  if (eventPayload?.item && typeof eventPayload.item === "object") {
    return eventPayload.item as RelayMessageParams["item"];
  }
  if (
    eventPayload &&
    typeof eventPayload === "object" &&
    typeof eventPayload.type === "string"
  ) {
    return eventPayload as RelayMessageParams["item"];
  }
  return undefined;
}

function isAssistantMessageItem(item: RelayMessageParams["item"]) {
  if (!item || typeof item !== "object") {
    return false;
  }

  const normalizedType = normalizeEventToken(item.type);
  const normalizedRole = normalizeEventToken(item.role);
  return (
    normalizedType === "agentmessage" ||
    normalizedType === "assistantmessage" ||
    normalizedRole === "assistant"
  );
}

function buildRenderItems(messages: ChatMessage[]): RenderItem[] {
  const items: RenderItem[] = [];

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (
      message.role === "system" &&
      message.kind === "command-execution" &&
      message.commandExecution
    ) {
      const commands: CommandExecutionData[] = [message.commandExecution];
      let nextIndex = index + 1;

      while (nextIndex < messages.length) {
        const nextMessage = messages[nextIndex];
        if (
          nextMessage.role !== "system" ||
          nextMessage.kind !== "command-execution" ||
          !nextMessage.commandExecution
        ) {
          break;
        }

        commands.push(nextMessage.commandExecution);
        nextIndex += 1;
      }

      items.push({
        type: "command-group",
        id: `command-group-${message.id}`,
        commands,
      });
      index = nextIndex - 1;
      continue;
    }

    if (
      message.role === "system" &&
      message.kind === "file-change" &&
      message.fileChanges &&
      message.fileChanges.length > 0
    ) {
      const groupKey = getFileChangeGroupKey(message.fileChanges);
      const groupedFileChanges: FileChangeData[] = [...message.fileChanges];
      let nextIndex = index + 1;

      while (nextIndex < messages.length) {
        const nextMessage = messages[nextIndex];
        if (
          nextMessage.role !== "system" ||
          nextMessage.kind !== "file-change" ||
          !nextMessage.fileChanges ||
          nextMessage.fileChanges.length === 0
        ) {
          break;
        }

        if (getFileChangeGroupKey(nextMessage.fileChanges) !== groupKey) {
          break;
        }

        groupedFileChanges.push(...nextMessage.fileChanges);
        nextIndex += 1;
      }

      items.push({
        type: "file-change-group",
        id: `file-change-group-${message.id}`,
        fileChanges: mergeFileChanges(groupedFileChanges),
      });
      index = nextIndex - 1;
      continue;
    }

    items.push({
      type: "message",
      id: message.id,
      message,
    });
  }

  return items;
}

function getFileChangeGroupKey(fileChanges: FileChangeData[]) {
  const directories = fileChanges
    .map((file) => getFileDirectory(file.path))
    .filter(Boolean);

  if (directories.length === 0) {
    return "root";
  }

  let common = directories[0];
  for (let index = 1; index < directories.length; index += 1) {
    common = getCommonPathPrefix(common, directories[index]);
    if (!common) {
      break;
    }
  }

  return common || directories[0] || "root";
}

function getFileDirectory(filePath: string) {
  const normalized = filePath.replace(/\\/g, "/").trim();
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= 1) {
    return "";
  }

  return parts.slice(0, -1).join("/");
}

function getCommonPathPrefix(left: string, right: string) {
  const leftParts = left.split("/").filter(Boolean);
  const rightParts = right.split("/").filter(Boolean);
  const shared: string[] = [];
  const count = Math.min(leftParts.length, rightParts.length);

  for (let index = 0; index < count; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      break;
    }
    shared.push(leftParts[index]);
  }

  return shared.join("/");
}

function mergeFileChanges(fileChanges: FileChangeData[]) {
  const merged = new Map<string, FileChangeData>();

  for (const fileChange of fileChanges) {
    const key = fileChange.path.replace(/\\/g, "/");
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...fileChange });
      continue;
    }

    existing.additions =
      (existing.additions || 0) + (fileChange.additions || 0);
    existing.deletions =
      (existing.deletions || 0) + (fileChange.deletions || 0);
    existing.diff = fileChange.diff || existing.diff;
    existing.action = resolvePreferredAction(
      existing.action,
      fileChange.action,
    );
  }

  return Array.from(merged.values());
}

function resolvePreferredAction(
  left: FileChangeData["action"],
  right: FileChangeData["action"],
) {
  const rank = {
    created: 5,
    deleted: 4,
    moved: 3,
    renamed: 2,
    edited: 1,
  } satisfies Record<FileChangeData["action"], number>;

  return rank[right] > rank[left] ? right : left;
}

function mapCodexSessionsToProjects(sessions: CodexSessionSummary[]) {
  const byProject = new Map<
    string,
    {
      id: string;
      name: string;
      description?: string;
      createdAt: number;
      sessions: {
        id: string;
        name: string;
        createdAt: number;
        lastActiveAt: number;
      }[];
    }
  >();

  for (const session of sessions) {
    const rawSessionId = normalizeThreadReference(
      (session.sessionId || session.threadId || "").trim(),
    );
    if (!rawSessionId) {
      continue;
    }

    const sessionKey = rawSessionId;

    const lastActiveAt = Number.isFinite(session.updatedAtMs)
      ? Number(session.updatedAtMs)
      : Date.now();
    const cwd = (session.cwd || "").trim();
    const projectKey = cwd ? normalizePathKey(cwd) : "unknown-workspace";
    const projectName = cwd ? humanizeProjectName(cwd) : "Unknown Workspace";

    if (!byProject.has(projectKey)) {
      byProject.set(projectKey, {
        id: projectKey,
        name: projectName,
        description: cwd || undefined,
        createdAt: lastActiveAt,
        sessions: [],
      });
    }

    const project = byProject.get(projectKey);
    if (!project) {
      continue;
    }

    const alreadyExists = project.sessions.some(
      (item) => item.id === sessionKey,
    );
    if (alreadyExists) {
      continue;
    }

    project.createdAt = Math.min(project.createdAt, lastActiveAt);
    const normalizedTitle = sanitizeSessionTitle(session.title || "");
    if (!normalizedTitle) {
      console.log("[mobile][codex/sessions/list] Untitled chat fallback", {
        sessionId: rawSessionId,
        rolloutPath: session.rolloutPath || "",
        projectName,
        rawTitlePreview: String(session.title || "").slice(0, 180),
      });
    }
    project.sessions.push({
      id: sessionKey,
      name: normalizedTitle || "Untitled chat",
      createdAt: lastActiveAt,
      lastActiveAt,
    });
  }

  return Array.from(byProject.values())
    .map((project) => ({
      ...project,
      sessions: project.sessions.sort(
        (lhs, rhs) => rhs.lastActiveAt - lhs.lastActiveAt,
      ),
    }))
    .sort((lhs, rhs) => {
      const lhsLatest = lhs.sessions[0]?.lastActiveAt || lhs.createdAt;
      const rhsLatest = rhs.sessions[0]?.lastActiveAt || rhs.createdAt;
      return rhsLatest - lhsLatest;
    });
}

function sanitizeSessionTitle(rawTitle: string) {
  const lines = String(rawTitle || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (isNoiseTitleLine(line)) {
      continue;
    }

    if (isLowSignalTitleLine(line)) {
      continue;
    }

    const compact = line.replace(/\s+/g, " ").trim();
    if (!compact) {
      continue;
    }

    return compact.length <= 64 ? compact : `${compact.slice(0, 63)}…`;
  }

  return "";
}

function isNoiseTitleLine(line: string) {
  const normalized = line.trim();
  if (!normalized) {
    return true;
  }

  if (normalized.startsWith("# AGENTS.md instructions for")) {
    return true;
  }

  const lowered = normalized.toLowerCase();
  if (
    lowered.startsWith("<environment_context>") ||
    lowered.startsWith("<permissions instructions>") ||
    lowered.startsWith("<app-context>") ||
    lowered.startsWith("<collaboration_mode>") ||
    lowered.startsWith("filesystem sandboxing") ||
    lowered.startsWith("approved command prefixes") ||
    lowered.startsWith("the writable roots are")
  ) {
    return true;
  }

  if (normalized.startsWith("<") && normalized.includes(">")) {
    return true;
  }

  return false;
}

function isLowSignalTitleLine(line: string) {
  const normalized = line
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return (
    normalized === "hi" ||
    normalized === "hello" ||
    normalized === "hey" ||
    normalized === "ok" ||
    normalized === "okay" ||
    normalized === "yo" ||
    normalized === "test" ||
    normalized === "ping"
  );
}

function normalizePathKey(input: string) {
  return input.replace(/\\/g, "/").replace(/\/+$/g, "").toLowerCase();
}

function normalizeThreadReference(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  const uuidSuffix = normalized.match(
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i,
  );
  if (uuidSuffix) {
    return uuidSuffix[1].toLowerCase();
  }

  return normalized;
}

function humanizeProjectName(cwd: string) {
  const normalized = cwd.replace(/\\/g, "/").replace(/\/+$/g, "");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0) {
    return "Workspace";
  }

  const markerIndex = parts.findIndex(
    (part) => part === "apps" || part === "packages",
  );
  if (markerIndex >= 0 && parts[markerIndex + 1]) {
    return `${parts[markerIndex]} / ${parts[markerIndex + 1]}`;
  }

  return parts[parts.length - 1];
}

export default function ChatScreen() {
  const theme = useTheme();
  const [assistantMessageId, setAssistantMessageId] = useState<string | null>(
    null,
  );
  const [sessionLoadTick, setSessionLoadTick] = useState(0);

  // Track command IDs by itemId across renders
  const commandIdMapRef = useRef(new Map<string, string>());
  const thinkingIdMapRef = useRef(new Map<string, string>());
  const codexInitializedRef = useRef(false);

  const pairing = useSessionStore((state) => state.pairing);
  const loadSession = useSessionStore((state) => state.load);
  const privateKey = useSessionStore(
    (state) => state.mobileIdentityPrivateKeyHex,
  );
  const publicKey = useSessionStore(
    (state) => state.mobileIdentityPublicKeyHex,
  );
  const setIdentity = useSessionStore((state) => state.setMobileIdentity);
  const setPairing = useSessionStore((state) => state.setPairing);
  const replaceProjects = useSessionStore((state) => state.replaceProjects);
  const projects = useSessionStore((state) => state.projects);
  const activeProjectId = useSessionStore((state) => state.activeProjectId);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setActiveProject = useSessionStore((state) => state.setActiveProject);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commitSheetOpen, setCommitSheetOpen] = useState(false);
  const [pairSheetOpen, setPairSheetOpen] = useState(false);
  const [commitStatusText, setCommitStatusText] = useState("");
  const [commitSubmitting, setCommitSubmitting] = useState(false);
  const [commitBranch, setCommitBranch] = useState("-");
  const [commitChangedFiles, setCommitChangedFiles] = useState(0);
  const [commitAdditions, setCommitAdditions] = useState(0);
  const [commitDeletions, setCommitDeletions] = useState(0);
  const setActiveDiffSession = useDiffStore((state) => state.setActiveSession);
  const setDiffSnapshot = useDiffStore((state) => state.setDiffSnapshot);
  const isDiffPanelOpen = useUiStore((state) => state.isDiffPanelOpen);
  const openDiffPanel = useUiStore((state) => state.openDiffPanel);
  const closeDiffPanel = useUiStore((state) => state.closeDiffPanel);

  const setRuntimeOptions = useRuntimeOptionsStore((state) => state.setOptions);
  const setRuntimeOptionsLoading = useRuntimeOptionsStore((state) => state.setLoading,);
  const setModelOptions = useRuntimeOptionsStore((state) => state.setModelOptions,);
  const setRuntimeOptionsError = useRuntimeOptionsStore((state) => state.setError,);
  const selectedModel = useRuntimeOptionsStore((state) => state.selectedModel);
  const selectedThinking = useRuntimeOptionsStore((state) => state.selectedThinking,);
  const threadSelections = useRuntimeOptionsStore((state) => state.threadSelections,);
  const loadRuntimeSelections = useRuntimeOptionsStore((state) => state.loadSelections,);
  const runtimePermission = useRuntimeOptionsStore((state) => state.options.permission,);
  const runtimeModel = useRuntimeOptionsStore((state) => state.options.model);
  const runtimeThinking = useRuntimeOptionsStore((state) => state.options.thinking,);

  const fetchCodexModelOptions = useCallback(async () => {
    if (!relayService.isSecureReady()) {
      return;
    }

    try {
      const result = await relayService.requestJson<{
        data?: ModelOption[];
      }>("model/list", {}, 20_000);
      const data = Array.isArray(result?.data) ? result.data : [];
      setModelOptions(data);
      console.log("[mobile][model/list] received options", {
        count: data.length,
      });
    } catch (error) {
      console.warn("[mobile][model/list] fetch failed", error);
    }
  }, [setModelOptions]);

  const fetchCodexModelOptionsFallback = useCallback(async () => {
    if (!relayService.isSecureReady()) {
      return;
    }

    try {
      const result = await relayService.requestJson<{
        config?: {
          model?: string;
          model_reasoning_effort?: string;
        };
      }>("config/read", {}, 15_000);
      const model = String(result?.config?.model || "").trim();
      const effort = String(
        result?.config?.model_reasoning_effort || "",
      ).trim();
      if (!model) {
        return;
      }

      const fallbackModel: ModelOption = {
        id: model,
        model,
        displayName: model,
        hidden: false,
        supportedReasoningEfforts: effort
          ? [{ reasoningEffort: effort, description: "Configured default" }]
          : [],
        defaultReasoningEffort: effort || undefined,
      };
      setModelOptions([fallbackModel]);
      console.log("[mobile][config/read] using fallback model option", {
        model,
        effort: effort || null,
      });
    } catch (error) {
      console.warn("[mobile][config/read] fallback fetch failed", error);
    }
  }, [setModelOptions]);

  const ensureCodexInitialized = useCallback(async () => {
    if (!relayService.isSecureReady()) {
      return false;
    }

    if (codexInitializedRef.current) {
      return true;
    }

    try {
      await relayService.requestJson<{ bridgeManaged?: boolean }>(
        "initialize",
        {
          protocolVersion: "2024-11-05",
          capabilities: {
            experimentalApi: true,
          },
          clientInfo: {
            name: "remodex-mobile",
            version: "1.0.0",
          },
        },
        20_000,
      );
      console.log("[mobile][initialize] initialize response received");
      await relayService.sendJson(buildRequest("initialized", {}));
      codexInitializedRef.current = true;
      console.log("[mobile][initialize] codex protocol initialized");
      return true;
    } catch (error) {
      console.warn("[mobile][initialize] failed", error);
      return false;
    }
  }, []);

  const messages = useChatStore((state) => state.messages);
  const renderItems = useMemo(() => buildRenderItems(messages), [messages]);
  const addUserMessage = useChatStore((state) => state.addUserMessage);
  const appendAssistantDelta = useChatStore(
    (state) => state.appendAssistantDelta,
  );
  const completeAssistantMessage = useChatStore(
    (state) => state.completeAssistantMessage,
  );
  const addSystemMessage = useChatStore((state) => state.addSystemMessage);
  const maybeUpsertSystemMessage = useChatStore(
    (state) =>
      (state as unknown as { upsertSystemMessage?: UpsertSystemMessageFn })
        .upsertSystemMessage,
  );
  const upsertSystemMessage: UpsertSystemMessageFn =
    maybeUpsertSystemMessage ||
    ((_id, text, kind) => {
      addSystemMessage(text, kind);
    });
  const updateMessageDeliveryState = useChatStore(
    (state) => state.updateMessageDeliveryState,
  );
  const addCommandExecution = useChatStore(
    (state) => state.addCommandExecution,
  );
  const updateCommandExecution = useChatStore(
    (state) => state.updateCommandExecution,
  );
  const addFileChanges = useChatStore((state) => state.addFileChanges);

  const activeProject =
    projects.find((project) => project.id === activeProjectId) || null;
  const gitCwd = getGitCwd(activeProject?.description);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    void loadRuntimeSelections().catch((error) => {
      console.warn(
        "[mobile][runtime-options] failed to load selections",
        error,
      );
    });
  }, [loadRuntimeSelections]);

  useEffect(() => {
    setActiveDiffSession(activeSessionId);
  }, [activeSessionId, setActiveDiffSession]);

  const loadCommitStatus = useCallback(async () => {
    if (!gitCwd || !relayService.isSecureReady()) {
      setCommitStatusText("Git status unavailable for current project.");
      return;
    }

    try {
      setCommitStatusText("Loading repository status...");
      const status = await requestGitStatus(gitCwd);
      const files = status?.files || [];
      const diff = status?.diff || {};

      setCommitBranch((status?.branch || "-").trim() || "-");
      setCommitChangedFiles(files.length);
      setCommitAdditions(Number(diff.additions || 0));
      setCommitDeletions(Number(diff.deletions || 0));
      setCommitStatusText("");
    } catch (error) {
      setCommitStatusText(
        error instanceof Error ? error.message : "Failed to load git status.",
      );
    }
  }, [gitCwd]);

  useEffect(() => {
    if (!commitSheetOpen) {
      return;
    }

    void loadCommitStatus();
  }, [commitSheetOpen, loadCommitStatus]);

  const runCommit = useCallback(
    async (payload: {
      message: string;
      includeUnstaged: boolean;
      draft: boolean;
      nextStep: "commit" | "push";
    }) => {
      if (!gitCwd) {
        setCommitStatusText("Git commit requires an active project path.");
        return;
      }

      setCommitSubmitting(true);
      setCommitStatusText("Running commit...");

      try {
        await relayService.requestJson("git/commit", {
          cwd: gitCwd,
          message: payload.message,
          includeUnstaged: payload.includeUnstaged,
          draft: payload.draft,
        });

        if (payload.nextStep === "push") {
          setCommitStatusText("Commit complete. Pushing...");
          await relayService.requestJson("git/push", { cwd: gitCwd });
        }

        setCommitStatusText(
          payload.nextStep === "push"
            ? "Commit and push completed."
            : "Commit completed.",
        );
        await loadCommitStatus();
        setCommitSheetOpen(false);
      } catch (error) {
        setCommitStatusText(
          error instanceof Error ? error.message : "Commit failed.",
        );
      } finally {
        setCommitSubmitting(false);
      }
    },
    [gitCwd, loadCommitStatus],
  );

  const refreshCodexSessions = useCallback(async () => {
    if (!relayService.isSecureReady()) {
      console.log(
        "[mobile][codex/sessions/list] secure not ready; skipping refresh",
      );
      return;
    }

    console.log(
      "[mobile][codex/sessions/list] requesting sessions from bridge...",
    );
    const rpcResult = await relayService.requestJson<CodexSessionsListResult>(
      "codex/sessions/list",
      {
        limit: 150,
      },
    );
    const sessions = Array.isArray(rpcResult?.sessions)
      ? rpcResult.sessions
      : [];
    console.log(
      `[mobile][codex/sessions/list] received ${sessions.length} sessions`,
      sessions.slice(0, 3).map((session) => ({
        sessionId: session.sessionId || session.threadId || "",
        cwd: session.cwd || "",
        updatedAtMs: session.updatedAtMs || 0,
      })),
    );
    const mappedProjects = mapCodexSessionsToProjects(sessions);
    if (mappedProjects.length === 0) {
      console.log("[mobile][codex/sessions/list] no real sessions found");
    }
    console.log(
      `[mobile][codex/sessions/list] mapped ${mappedProjects.length} projects`,
      mappedProjects.map((project) => ({
        id: project.id,
        name: project.name,
        sessionCount: project.sessions.length,
      })),
    );

    let nextActiveProjectId = activeProjectId;
    let nextActiveSessionId = activeSessionId;

    if (
      !nextActiveProjectId ||
      !mappedProjects.some((project) => project.id === nextActiveProjectId)
    ) {
      nextActiveProjectId = mappedProjects[0]?.id || null;
    }

    if (nextActiveProjectId) {
      const activeProject =
        mappedProjects.find((project) => project.id === nextActiveProjectId) ||
        null;
      const hasActiveSession =
        !!nextActiveSessionId &&
        !!activeProject?.sessions.some(
          (session) =>
            normalizeThreadReference(session.id) ===
            normalizeThreadReference(nextActiveSessionId),
        );
      if (!hasActiveSession) {
        nextActiveSessionId = activeProject?.sessions[0]?.id || null;
      }
    }

    replaceProjects(mappedProjects, nextActiveProjectId, nextActiveSessionId);
    console.log(
      `[mobile][codex/sessions/list] store updated activeProject=${nextActiveProjectId || "none"} activeSession=${nextActiveSessionId || "none"}`,
    );
  }, [activeProjectId, activeSessionId, replaceProjects]);

  const resumeThread = useCallback(
    async (threadId: string | null | undefined) => {
      const normalizedThreadId = normalizeThreadReference(threadId);
      if (!normalizedThreadId || !relayService.isSecureReady()) {
        return;
      }

      try {
        await relayService.requestJson(
          "thread/resume",
          {
            threadId: normalizedThreadId,
          },
          20_000,
        );
        console.log("[mobile][thread/resume] sent", {
          threadId: normalizedThreadId,
        });
      } catch (error) {
        console.warn("[mobile][thread/resume] failed", {
          threadId: normalizedThreadId,
          error,
        });
      }
    },
    [],
  );

  const fetchRuntimeOptions = useCallback(async () => {
    if (!relayService.isSecureReady()) {
      console.log(
        "[mobile][bridge/runtimeOptions/get] secure not ready; skipping fetch",
      );
      return;
    }

    try {
      setRuntimeOptionsLoading(true);
      console.log(
        "[mobile][bridge/runtimeOptions/get] requesting from bridge...",
      );

      const result = await relayService.requestJson<RuntimeOptions>(
        "bridge/runtimeOptions/get",
        {},
      );

      console.log("[mobile][bridge/runtimeOptions/get] received:", result);
      setRuntimeOptions(result);
    } catch (error) {
      console.warn("[mobile][bridge/runtimeOptions/get] fetch failed", error);
      setRuntimeOptionsError(
        error instanceof Error
          ? error.message
          : "Failed to fetch runtime options",
      );
    }
  }, [setRuntimeOptions, setRuntimeOptionsLoading, setRuntimeOptionsError]);

  useEffect(() => {
    const onError = relayService.on("error", (error) => {
      console.warn("[mobile][relay/error]", error?.message || String(error));
    });

    const onReady = relayService.on("ready", () => {
      codexInitializedRef.current = false;
      void (async () => {
        void refreshCodexSessions().catch((error) => {
          console.warn("[mobile][codex/sessions/list] refresh failed", error);
        });
        void fetchRuntimeOptions().catch((error) => {
          console.warn(
            "[mobile][bridge/runtimeOptions/get] fetch failed",
            error,
          );
        });

        const initialized = await ensureCodexInitialized();
        if (!initialized) {
          return;
        }

        void fetchCodexModelOptions().catch((error) => {
          console.warn("[mobile][model/list] fetch failed", error);
        });
        void fetchCodexModelOptionsFallback().catch((fallbackError) => {
          console.warn(
            "[mobile][config/read] fallback fetch failed",
            fallbackError,
          );
        });
      })();
    });

    const onMessage = relayService.on("message", (payload) => {
      const message = payload as {
        method?: string;
        params?: RelayMessageParams;
      };

      console.log("[mobile][message]", message.method, message.params);

      const params = message.params;
      const eventPayload = params?.msg || params;

      const resolveItemId = () =>
        String(
          eventPayload?.itemId ||
          eventPayload?.item_id ||
          eventPayload?.call_id ||
          eventPayload?.callId ||
          "",
        );

      const getExistingAssistantText = (id: string | null | undefined) => {
        const normalizedId = String(id || "").trim();
        if (!normalizedId) {
          return "";
        }
        const existing = useChatStore
          .getState()
          .messages.find(
            (item) => item.id === normalizedId && item.role === "assistant",
          );
        return existing?.text || "";
      };

      const ensureCommandMessage = (
        itemId: string,
        seed?: {
          command?: string;
          cwd?: string;
        },
      ) => {
        let commandId = commandIdMapRef.current.get(itemId);
        if (!commandId) {
          commandId = addCommandExecution({
            command: seed?.command || "Running command...",
            status: "running",
            workingDirectory: seed?.cwd,
          });
          commandIdMapRef.current.set(itemId, commandId);
        } else if (seed?.command || seed?.cwd) {
          updateCommandExecution(commandId, {
            command: seed?.command,
            workingDirectory: seed?.cwd,
          });
        }
        return commandId;
      };

      // Handle message streaming
      if (message.method === "message/stream") {
        const id =
          params?.id || assistantMessageId || `assistant-${Date.now()}`;
        setAssistantMessageId(id);
        appendAssistantDelta(id, params?.delta || "");
      }

      if (
        message.method === "item/agentMessage/delta"
      ) {
        const itemObject = incomingItemObject(params);
        const id =
          resolveItemId() ||
          String(
            itemObject?.id || itemObject?.itemId || itemObject?.item_id || "",
          ).trim() ||
          assistantMessageId ||
          `assistant-${Date.now()}`;
        const delta =
          params?.delta ||
          params?.textDelta ||
          params?.text_delta ||
          eventPayload?.delta ||
          eventPayload?.text ||
          "";

        if (delta) {
          setAssistantMessageId(id);
          appendAssistantDelta(id, delta);
        }
      }

      // Handle message completion
      if (message.method === "message/complete") {
        const id = params?.id || assistantMessageId;
        if (id) {
          completeAssistantMessage(id);
        }
      }

      if (
        message.method === "item/completed" ||
        message.method === "codex/event/item_completed"
      ) {
        const itemObject = incomingItemObject(params);
        if (isAssistantMessageItem(itemObject)) {
          const id =
            resolveItemId() ||
            String(
              itemObject?.id || itemObject?.itemId || itemObject?.item_id || "",
            ).trim() ||
            assistantMessageId;
          const text = String(
            itemObject?.message ||
            itemObject?.text ||
            itemObject?.summary ||
            params?.message ||
            eventPayload?.message ||
            eventPayload?.text ||
            "",
          ).trim();

          if (id && text) {
            if (!getExistingAssistantText(id)) {
              appendAssistantDelta(id, text);
            }
            setAssistantMessageId(id);
          }
          if (id) {
            completeAssistantMessage(id);
          }
        }
      }

      if (message.method === "item/reasoning/textDelta") {
        const itemId = resolveItemId();
        const delta = params?.delta || params?.textDelta || "";
        if (itemId && delta && delta.trim() !== "Thinking...") {
          const messageId = thinkingIdMapRef.current.get(itemId) || itemId;
          thinkingIdMapRef.current.set(itemId, messageId);
          upsertSystemMessage(messageId, delta, "thinking", {
            append: true,
            streaming: true,
          });
        }
      }

      if (message.method === "codex/event/background_event") {
        const itemId = resolveItemId() || `background-${Date.now()}`;
        const text = params?.message || "Running background task";
        upsertSystemMessage(itemId, text, "normal");
      }

      // Handle command execution - new protocol
      if (message.method === "item/commandExecution/outputDelta") {
        const itemId = resolveItemId();
        const delta = params?.delta || params?.textDelta || params?.chunk || "";
        const command = String(
          eventPayload?.command ||
          eventPayload?.cmd ||
          eventPayload?.raw_command ||
          eventPayload?.rawCommand ||
          "",
        );
        const cwd = String(
          eventPayload?.cwd || eventPayload?.working_directory || "",
        );

        if (itemId && delta) {
          const commandId = ensureCommandMessage(itemId, { command, cwd });
          updateCommandExecution(commandId, {
            output: delta,
          });
        }
      }

      // Handle legacy command execution - begin
      if (message.method === "codex/event/exec_command_begin") {
        const itemId = resolveItemId();
        const commandArray = eventPayload?.command || eventPayload?.cmd;
        const command = Array.isArray(commandArray)
          ? commandArray.join(" ")
          : String(commandArray || "");
        const cwd = String(
          eventPayload?.cwd || eventPayload?.working_directory || "",
        );

        if (itemId) {
          ensureCommandMessage(itemId, {
            command: command || "Running command...",
            cwd,
          });
          console.log("[mobile][command] Started:", command, "itemId:", itemId);
        }
      }

      // Handle legacy command execution - output delta
      if (message.method === "codex/event/exec_command_output_delta") {
        const itemId = resolveItemId();
        const delta =
          eventPayload?.delta ||
          eventPayload?.chunk ||
          eventPayload?.output ||
          "";
        const command = String(
          eventPayload?.command ||
          eventPayload?.cmd ||
          eventPayload?.raw_command ||
          eventPayload?.rawCommand ||
          "",
        );
        const cwd = String(
          eventPayload?.cwd || eventPayload?.working_directory || "",
        );

        if (itemId && delta) {
          const commandId = ensureCommandMessage(itemId, { command, cwd });
          updateCommandExecution(commandId, {
            output: delta,
          });
        }
      }

      // Handle legacy command execution - end
      if (message.method === "codex/event/exec_command_end") {
        const itemId = resolveItemId();
        const exitCode = eventPayload?.exit_code ?? eventPayload?.exitCode;
        const durationMs =
          eventPayload?.duration_ms ?? eventPayload?.durationMs;
        const output = String(eventPayload?.output || "");

        if (itemId) {
          const commandId = ensureCommandMessage(itemId);
          updateCommandExecution(commandId, {
            output,
            status: exitCode === 0 ? "completed" : "failed",
            exitCode,
            duration: durationMs,
          });
          console.log(
            "[mobile][command] Ended:",
            "exitCode:",
            exitCode,
            "itemId:",
            itemId,
          );
        }
      }

      // Handle turn diff updates (file changes)
      if (message.method === "turn/diff/updated") {
        const incomingFileChanges = Array.isArray(params?.fileChanges)
          ? params.fileChanges
          : [];
        if (incomingFileChanges.length > 0) {
          addFileChanges(incomingFileChanges);
        }

        const diff = params?.diff || "";
        if (!diff) {
          return;
        }

        const parsedFiles = parseUnifiedDiff(diff);
        const fileChanges = parsedFiles.map((file) => ({
          path: file.path,
          action: file.status,
          additions: file.additions,
          deletions: file.deletions,
          diff: file.diff,
        }));

        if (fileChanges.length > 0) {
          addFileChanges(fileChanges);
          if (activeSessionId) {
            setDiffSnapshot(activeSessionId, parsedFiles, {
              preserveSelection: true,
            });
          }
        }
      }

      // Handle file change deltas
      if (message.method === "item/fileChange/outputDelta") {
        const delta = params?.delta || params?.textDelta || "";

        if (delta) {
          console.log("[mobile][file-change]", delta);
          const parsedFiles = parseUnifiedDiff(delta);
          if (parsedFiles.length > 0 && activeSessionId) {
            setDiffSnapshot(activeSessionId, parsedFiles, {
              preserveSelection: true,
            });
          }
        }
      }
    });

    return () => {
      onError();
      onReady();
      onMessage();
    };
  }, [
    assistantMessageId,
    appendAssistantDelta,
    completeAssistantMessage,
    addCommandExecution,
    upsertSystemMessage,
    updateCommandExecution,
    addFileChanges,
    activeSessionId,
    refreshCodexSessions,
    fetchRuntimeOptions,
    ensureCodexInitialized,
    fetchCodexModelOptions,
    fetchCodexModelOptionsFallback,
    setDiffSnapshot,
  ]);

  useEffect(() => {
    if (!pairing) {
      return;
    }

    const shouldRetry = projects.length === 0;
    if (!shouldRetry) {
      return;
    }

    const retryTimer = setTimeout(() => {
      void refreshCodexSessions().catch((error) => {
        console.warn("[mobile][codex/sessions/list] retry failed", error);
      });
    }, 2500);

    return () => {
      clearTimeout(retryTimer);
    };
  }, [pairing, projects, refreshCodexSessions]);

  useEffect(() => {
    async function connect() {
      if (!pairing) {
        setPairSheetOpen(true);
        return;
      }

      let identityPrivate = privateKey;
      let identityPublic = publicKey;
      if (!identityPrivate || !identityPublic) {
        const generated = await relayService.ensureIdentityPair();
        identityPrivate = generated.privateKeyHex;
        identityPublic = generated.publicKeyHex;
        await setIdentity(identityPrivate, identityPublic);
      }

      const canUseTrustedResolve = Boolean(pairing.macDeviceId);
      const resolveSessionId = async () => {
        if (!canUseTrustedResolve || !identityPrivate || !identityPublic) {
          return null;
        }

        const phoneDeviceId = `phone-${identityPublic.toLowerCase().slice(0, 16)}`;
        const phoneIdentityPublicKey = bytesToBase64(
          hexToBytes(identityPublic),
        );

        try {
          const result = await resolveTrustedSession({
            relayBaseUrl: pairing.relayUrl,
            macDeviceId: pairing.macDeviceId || "",
            phoneDeviceId,
            phoneIdentityPublicKey,
            phoneIdentityPrivateKeyHex: identityPrivate,
          });

          const nextSessionId = String(result?.sessionId || "").trim();
          if (!result?.ok || !nextSessionId) {
            return null;
          }

          if (nextSessionId !== pairing.sessionId) {
            await setPairing({
              ...pairing,
              sessionId: nextSessionId,
            });
          }

          return nextSessionId;
        } catch {
          return null;
        }
      };

      const connectWithSession = async (sessionId: string) => {
        await relayService.connect({
          relayUrl: pairing.relayUrl,
          sessionId,
          identityPrivateKeyHex: identityPrivate,
          bridgeIdentityPublicKey: pairing.bridgeIdentityPublicKey,
          resolveSessionId,
        });
      };

      let sessionIdToUse = pairing.sessionId;
      const resolvedSessionId = await resolveSessionId();
      if (resolvedSessionId) {
        sessionIdToUse = resolvedSessionId;
      }

      if (pairing.expiryMs < Date.now()) {
        if (!resolvedSessionId) {
          setPairSheetOpen(true);
          return;
        }
      }

      try {
        await connectWithSession(sessionIdToUse);
      } catch {
        const retriedSessionId = await resolveSessionId();
        if (!retriedSessionId) {
          throw new Error(
            "Unable to connect and trusted resolve did not return a live session.",
          );
        }

        await connectWithSession(retriedSessionId);
      }
    }

    void connect().catch((error) => {
      console.warn("[mobile][relay/connect] failed", error);
      setPairSheetOpen(true);
    });
  }, [pairing, privateKey, publicKey, setIdentity, setPairing]);

  useEffect(() => {
    return () => {
      relayService.disconnect();
    };
  }, []);

  async function send(text: string) {
    if (!text.trim()) {
      return;
    }

    const messageId = addUserMessage(text);
    setAssistantMessageId(null);

    try {
      const initialized = await ensureCodexInitialized();
      if (!initialized) {
        throw new Error("Codex initialize failed.");
      }

      const normalizedActiveSessionId =
        normalizeThreadReference(activeSessionId);
      const selectedThreadRuntime = normalizedActiveSessionId
        ? threadSelections[normalizedActiveSessionId] || null
        : null;
      const collaborationMode: CollaborationModePayload | undefined =
        runtimePermission === "full"
          ? { mode: "auto" }
          : runtimePermission === "on-request"
            ? { mode: "on-request" }
            : undefined;

      const requestParams: TurnStartRequestParams = {
        threadId: normalizedActiveSessionId || undefined,
        input: [
          {
            type: "text",
            text,
          },
        ],
        model:
          selectedThreadRuntime?.model ||
          selectedModel ||
          runtimeModel ||
          undefined,
        effort:
          selectedThreadRuntime?.thinking ||
          selectedThinking ||
          runtimeThinking ||
          undefined,
        collaborationMode,
      };

      if (normalizedActiveSessionId) {
        await resumeThread(normalizedActiveSessionId);
      }

      console.log("[mobile][send] payload runtime", {
        model:
          selectedThreadRuntime?.model || selectedModel || runtimeModel || null,
        effort:
          selectedThreadRuntime?.thinking ||
          selectedThinking ||
          runtimeThinking ||
          null,
        collaborationMode: collaborationMode || null,
        threadId: requestParams.threadId || null,
      });
      const turnStartResult = await relayService.requestJson<{
        turnId?: string;
        threadId?: string;
      }>("turn/start", requestParams, 20_000);
      console.log("[mobile][send] turn/start acknowledged", {
        threadId:
          String(turnStartResult?.threadId || "").trim() ||
          requestParams.threadId ||
          null,
        turnId: String(turnStartResult?.turnId || "").trim() || null,
      });
      updateMessageDeliveryState(messageId, "sent");
    } catch (error) {
      console.error("[mobile][send] Failed to send message", error);
      updateMessageDeliveryState(messageId, "failed");
    }
  }
  return (
    <>
      <ProjectSidebar
        isOpen={sidebarOpen}
        gesturesEnabled={!pairSheetOpen && !isDiffPanelOpen}
        onOpen={() => setSidebarOpen(true)}
        onClose={() => setSidebarOpen(false)}
        onProjectSelect={(projectId) => {
          console.log("[mobile][sidebar] project selected", { projectId });
        }}
        onSessionSelect={(projectId, sessionId) => {
          console.log("[mobile][sidebar] session selected", {
            projectId,
            sessionId,
          });
          void resumeThread(sessionId);
          setSessionLoadTick((value) => value + 1);
        }}
      >
        <SafeAreaView
          style={StyleSheet.flatten([
            styles.container,
            { backgroundColor: theme.background },
          ])}
          edges={["top", "left", "right"]}
        >
          <SessionTranscriptLoader
            sessionRef={activeSessionId}
            loadTick={sessionLoadTick}
          />

          <ChatHeader
            onOpenSidebar={() => setSidebarOpen(true)}
            onOpenCommitSheet={() => setCommitSheetOpen(true)}
            onOpenDiffPanel={openDiffPanel}
            onOpenPairSheet={() => setPairSheetOpen(true)}
          />

          <ScrollView
            style={styles.messages}
            contentContainerStyle={[
              styles.messageContent,
              renderItems.length === 0 && { flexGrow: 1, justifyContent: 'center' }
            ]}
          >
            {renderItems.length === 0 ? (
              <EmptyChatState 
                projectName={activeProject?.name} 
                projects={projects}
                onProjectSelect={(projectId) => {
                  setActiveProject(projectId);
                  // Optionally find the most recent session for this project
                  const proj = projects.find(p => p.id === projectId);
                  if (proj?.sessions.length) {
                    resumeThread(proj.sessions[0].id);
                    setSessionLoadTick((v) => v + 1);
                  }
                }}
              />
            ) : (
              renderItems.map((item) => {
                if (item.type === "command-group") {
                  return (
                    <MessageBubble
                      key={item.id}
                      role="system"
                      text=""
                      kind="command-execution"
                      commandExecutions={item.commands}
                    />
                  );
                }

                if (item.type === "file-change-group") {
                  return (
                    <MessageBubble
                      key={item.id}
                      role="system"
                      text=""
                      kind="file-change"
                      fileChanges={item.fileChanges}
                    />
                  );
                }

                const { message } = item;
                return (
                  <MessageBubble
                    key={message.id}
                    role={message.role}
                    text={message.text}
                    streaming={message.isStreaming}
                    kind={message.kind}
                    deliveryState={message.deliveryState}
                    commandExecution={message.commandExecution}
                    fileChanges={message.fileChanges}
                  />
                );
              })
            )}
          </ScrollView>

          <PromptInput onSend={send} />
        </SafeAreaView>
      </ProjectSidebar>

      <BottomSheet
        isVisible={commitSheetOpen}
        onClose={() => setCommitSheetOpen(false)}
      >
        <GitCommitView
          branch={commitBranch}
          changedFiles={commitChangedFiles}
          additions={commitAdditions}
          deletions={commitDeletions}
          isSubmitting={commitSubmitting}
          statusText={commitStatusText}
          onCommit={(payload) => {
            void runCommit(payload);
          }}
        />
      </BottomSheet>

      <SidePanel
        isVisible={pairSheetOpen}
        onClose={() => setPairSheetOpen(false)}
      >
        <PairDeviceView onPaired={() => setPairSheetOpen(false)} />
      </SidePanel>

      <SidePanel isVisible={isDiffPanelOpen} onClose={closeDiffPanel}>
        <CodeDiffView onClose={closeDiffPanel} />
      </SidePanel>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 10,
  },
  sessionButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    flex: 1,
    minWidth: 0,
  },
  messages: {
    flex: 1,
  },
  messageContent: {
    paddingHorizontal: 10,
    paddingTop: 56,
    paddingBottom: 200,
    gap: 20,
  },
});
