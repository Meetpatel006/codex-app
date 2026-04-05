import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MessageBubble } from "@/components/MessageBubble";
import { ChatLoadingOverlay } from "@/components/ChatLoadingOverlay";
import { SessionTranscriptLoader } from "@/components/SessionTranscriptLoader";
import {
  ProjectSidebar,
  type SidebarUsageItem,
} from "@/components/ProjectSidebar";
import { PairingScreen } from "@/components/PairingScreen";
import { PromptInput } from "@/components/prompt-input";
import { ChatHeader } from "@/components/chat-header";
import { CodeDiffView } from "@/components/code-diff-view";
import { EmptyChatState } from "@/components/EmptyChatState";
import { GitCommitView } from "@/components/git-commit-view";
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
  ApprovalRequestData,
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

type ThreadStartResponse = {
  threadId?: string;
  thread?: {
    id?: string;
    threadId?: string;
  };
};

type ThreadStartRequestParams = {
  cwd?: string;
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
    }
  | {
      type: "approval-group";
      id: string;
      approvals: ApprovalRequestData[];
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
  thread?: {
    id?: string;
    threadId?: string;
  };
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
  availableDecisions?: unknown[];
  available_decisions?: unknown[];
  proposedExecpolicyAmendment?: unknown;
  proposed_execpolicy_amendment?: unknown;
  requestId?: string | number;
  grantRoot?: string | null;
  grant_root?: string | null;
  reason?: string | null;
  changes?: Record<string, unknown>;
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

type ThreadUsageSnapshot = {
  threadId: string;
  tokensUsed: number;
  tokenLimit: number;
  updatedAt: number;
};

type RateLimitWindowSnapshot = {
  id: string;
  usedPercent: number;
  windowMinutes: number | null;
  resetsAtMs: number | null;
  label?: string;
};

type AccountUsageSnapshot = {
  planType: string | null;
  windows: RateLimitWindowSnapshot[];
  updatedAt: number;
};

function normalizeEventToken(value: unknown) {
  return typeof value === "string"
    ? value.toLowerCase().replace(/[_-\s]+/g, "")
    : "";
}

function stringifyCommandValue(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join(" ")
      .trim();
  }
  return typeof value === "string" ? value.trim() : "";
}

function extractCommandFromActions(actions: unknown) {
  if (!Array.isArray(actions)) {
    return "";
  }

  for (const action of actions) {
    if (!action || typeof action !== "object") {
      continue;
    }
    const command = stringifyCommandValue(
      (action as { command?: unknown }).command,
    );
    if (command) {
      return command;
    }
  }

  return "";
}

function normalizeAvailableDecisions(raw: unknown) {
  return Array.isArray(raw) ? raw : [];
}

function pickApproveDecision(
  availableDecisions: unknown[],
  proposedExecpolicyAmendment: unknown,
) {
  const normalizedLabels = new Set(
    availableDecisions
      .map((decision) => {
        if (typeof decision === "string") {
          return normalizeEventToken(decision);
        }
        if (decision && typeof decision === "object") {
          const key = Object.keys(decision as Record<string, unknown>)[0] || "";
          return normalizeEventToken(key);
        }
        return "";
      })
      .filter(Boolean),
  );

  if (normalizedLabels.has("accept")) {
    return "accept";
  }
  if (normalizedLabels.has("approved")) {
    return "approved";
  }
  if (normalizedLabels.has("acceptforsession")) {
    return "acceptForSession";
  }

  if (
    normalizedLabels.has("acceptwithexecpolicyamendment") &&
    proposedExecpolicyAmendment
  ) {
    return {
      acceptWithExecpolicyAmendment: proposedExecpolicyAmendment,
    };
  }

  return "accept";
}

function pickRejectDecision(availableDecisions: unknown[]) {
  const normalizedLabels = new Set(
    availableDecisions
      .map((decision) => {
        if (typeof decision === "string") {
          return normalizeEventToken(decision);
        }
        if (decision && typeof decision === "object") {
          const key = Object.keys(decision as Record<string, unknown>)[0] || "";
          return normalizeEventToken(key);
        }
        return "";
      })
      .filter(Boolean),
  );

  if (normalizedLabels.has("cancel")) {
    return "cancel";
  }
  if (normalizedLabels.has("abort")) {
    return "abort";
  }
  if (normalizedLabels.has("decline")) {
    return "decline";
  }

  return "cancel";
}

function pickFileRejectDecision(availableDecisions: unknown[]) {
  const normalizedLabels = new Set(
    availableDecisions
      .map((decision) => {
        if (typeof decision === "string") {
          return normalizeEventToken(decision);
        }
        if (decision && typeof decision === "object") {
          const key = Object.keys(decision as Record<string, unknown>)[0] || "";
          return normalizeEventToken(key);
        }
        return "";
      })
      .filter(Boolean),
  );

  if (normalizedLabels.has("decline")) {
    return "decline";
  }
  if (normalizedLabels.has("cancel")) {
    return "cancel";
  }
  return "decline";
}

function normalizeRequestId(value: unknown): string | number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return null;
}

function summarizePatchApprovalChanges(changes: unknown): string {
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    return "Approve file changes";
  }

  const paths = Object.keys(changes as Record<string, unknown>).filter(Boolean);
  if (paths.length === 0) {
    return "Approve file changes";
  }

  const names = paths.map((filePath) => {
    const normalized = filePath.replace(/\\/g, "/");
    const segments = normalized.split("/").filter(Boolean);
    return segments[segments.length - 1] || normalized;
  });

  if (names.length === 1) {
    return `Apply patch to ${names[0]}`;
  }
  if (names.length === 2) {
    return `Apply patch to ${names[0]} and ${names[1]}`;
  }

  return `Apply patch to ${names[0]}, ${names[1]} +${names.length - 2} files`;
}

function extractPatchApprovalFilePaths(changes: unknown): string[] {
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    return [];
  }

  return Object.keys(changes as Record<string, unknown>)
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .slice(0, 20);
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
      message.kind === "approval" &&
      message.approvalRequest &&
      isFinalApprovalStatus(message.approvalRequest.status)
    ) {
      const approvals: ApprovalRequestData[] = [message.approvalRequest];
      let nextIndex = index + 1;

      while (nextIndex < messages.length) {
        const nextMessage = messages[nextIndex];
        if (
          nextMessage.role !== "system" ||
          nextMessage.kind !== "approval" ||
          !nextMessage.approvalRequest ||
          !isFinalApprovalStatus(nextMessage.approvalRequest.status)
        ) {
          break;
        }

        approvals.push(nextMessage.approvalRequest);
        nextIndex += 1;
      }

      items.push({
        type: "approval-group",
        id: `approval-group-${message.id}`,
        approvals,
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

function isFinalApprovalStatus(
  status: ApprovalRequestData["status"] | undefined,
) {
  return status === "approved" || status === "rejected" || status === "error";
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

const WEEKLY_WINDOW_MINUTES = 7 * 24 * 60;
const MONTHLY_WINDOW_MINUTES = 30 * 24 * 60;

function readFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function readTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function normalizePlanType(value: unknown) {
  const plan = readTrimmedString(value).toLowerCase();
  return plan || null;
}

function formatLimitLabel(windowMinutes: number | null, fallbackIndex: number) {
  if (windowMinutes == null) {
    return fallbackIndex === 0 ? "Primary limit" : `Limit ${fallbackIndex + 1}`;
  }

  if (Math.abs(windowMinutes - WEEKLY_WINDOW_MINUTES) <= 120) {
    return "Weekly limit";
  }

  if (Math.abs(windowMinutes - MONTHLY_WINDOW_MINUTES) <= 1440) {
    return "Monthly limit";
  }

  if (windowMinutes < 60) {
    return `${windowMinutes}m limit`;
  }

  if (windowMinutes < 24 * 60) {
    return `${Math.round(windowMinutes / 60)}h limit`;
  }

  return `${Math.round(windowMinutes / (24 * 60))}d limit`;
}

function parseThreadUsageSnapshot(
  rawPayload: unknown,
): ThreadUsageSnapshot | null {
  if (!rawPayload || typeof rawPayload !== "object") {
    return null;
  }

  const payload = rawPayload as Record<string, unknown>;
  const usageCandidate =
    payload.usage && typeof payload.usage === "object"
      ? (payload.usage as Record<string, unknown>)
      : payload;

  const threadId = normalizeThreadReference(
    readTrimmedString(payload.threadId || payload.thread_id),
  );
  const tokenLimit =
    readFiniteNumber(
      usageCandidate.tokenLimit ||
        usageCandidate.token_limit ||
        usageCandidate.model_context_window ||
        usageCandidate.modelContextWindow ||
        usageCandidate.context_window ||
        usageCandidate.contextWindow,
    ) ?? 0;
  const directTokensUsed = readFiniteNumber(
    usageCandidate.tokensUsed ||
      usageCandidate.tokens_used ||
      usageCandidate.total_tokens ||
      usageCandidate.totalTokens,
  );
  const fallbackTokensUsed =
    (readFiniteNumber(
      usageCandidate.input_tokens || usageCandidate.inputTokens,
    ) || 0) +
    (readFiniteNumber(
      usageCandidate.output_tokens || usageCandidate.outputTokens,
    ) || 0) +
    (readFiniteNumber(
      usageCandidate.reasoning_output_tokens ||
        usageCandidate.reasoningOutputTokens,
    ) || 0);
  const tokensUsed = directTokensUsed ?? fallbackTokensUsed;

  if (!threadId || tokenLimit <= 0 || tokensUsed < 0) {
    return null;
  }

  return {
    threadId,
    tokenLimit,
    tokensUsed: Math.min(tokensUsed, tokenLimit),
    updatedAt: Date.now(),
  };
}

function parseRateLimitWindow(
  rawWindow: unknown,
  fallbackId: string,
): RateLimitWindowSnapshot | null {
  if (!rawWindow || typeof rawWindow !== "object") {
    return null;
  }

  const window = rawWindow as Record<string, unknown>;
  const usedPercent = readFiniteNumber(
    window.used_percent || window.usedPercent,
  );
  if (usedPercent == null) {
    return null;
  }

  const windowMinutesRaw = readFiniteNumber(
    window.windowDurationMins ||
      window.window_duration_mins ||
      window.window_minutes ||
      window.windowMinutes,
  );
  const windowMinutes =
    windowMinutesRaw != null ? Math.max(0, Math.trunc(windowMinutesRaw)) : null;
  const resetsAtRaw = readFiniteNumber(window.resets_at || window.resetsAt);
  const resetsAtMs =
    resetsAtRaw == null
      ? null
      : resetsAtRaw > 1_000_000_000_000
        ? Math.trunc(resetsAtRaw)
        : Math.trunc(resetsAtRaw * 1000);

  return {
    id: fallbackId,
    usedPercent: clampPercent(usedPercent),
    windowMinutes,
    resetsAtMs,
  };
}

function parseAccountUsageSnapshot(
  rawPayload: unknown,
): AccountUsageSnapshot | null {
  if (!rawPayload || typeof rawPayload !== "object") {
    return null;
  }

  const payload = rawPayload as Record<string, unknown>;
  const snapshotCandidate =
    (payload.rateLimits as Record<string, unknown>) ||
    (payload.rate_limits as Record<string, unknown>) ||
    (payload.snapshot as Record<string, unknown>) ||
    payload;

  const primary = parseRateLimitWindow(
    snapshotCandidate.primary,
    "primary-window",
  );
  const secondary = parseRateLimitWindow(
    snapshotCandidate.secondary,
    "secondary-window",
  );
  const windows = [primary, secondary].filter(
    (item): item is RateLimitWindowSnapshot => !!item,
  );

  if (windows.length === 0) {
    return null;
  }

  return {
    planType: normalizePlanType(
      snapshotCandidate.plan_type ||
        snapshotCandidate.planType ||
        payload.plan_type ||
        payload.planType,
    ),
    windows,
    updatedAt: Date.now(),
  };
}

function isFreeOrGoPlan(planType: string | null) {
  if (!planType) {
    return false;
  }
  return planType === "free" || planType === "go";
}

function buildSidebarUsageItems(params: {
  accountUsage: AccountUsageSnapshot | null;
  threadUsage: ThreadUsageSnapshot | null;
}): SidebarUsageItem[] {
  const { accountUsage, threadUsage } = params;

  if (accountUsage && accountUsage.windows.length > 0) {
    const sortedWindows = [...accountUsage.windows].sort((left, right) => {
      const leftMinutes = left.windowMinutes ?? Number.MAX_SAFE_INTEGER;
      const rightMinutes = right.windowMinutes ?? Number.MAX_SAFE_INTEGER;
      return leftMinutes - rightMinutes;
    });

    const windowsToUse = isFreeOrGoPlan(accountUsage.planType)
      ? [
          sortedWindows.reduce((best, next) => {
            const bestDistance = Math.abs(
              (best.windowMinutes ?? WEEKLY_WINDOW_MINUTES) -
                WEEKLY_WINDOW_MINUTES,
            );
            const nextDistance = Math.abs(
              (next.windowMinutes ?? WEEKLY_WINDOW_MINUTES) -
                WEEKLY_WINDOW_MINUTES,
            );
            return nextDistance < bestDistance ? next : best;
          }),
        ]
      : sortedWindows.slice(0, 2);

    return windowsToUse.map((window, index) => ({
      id: window.id,
      label: formatLimitLabel(window.windowMinutes, index),
      percent: window.usedPercent,
      valueText: `${Math.round(window.usedPercent)}%`,
    }));
  }

  if (threadUsage && threadUsage.tokenLimit > 0) {
    const percent = clampPercent(
      (threadUsage.tokensUsed / threadUsage.tokenLimit) * 100,
    );
    return [
      {
        id: "context-window",
        label: "Context window",
        percent,
        valueText: `${Math.round(percent)}%`,
      },
    ];
  }

  return [];
}

export default function ChatScreen() {
  const theme = useTheme();
  const [assistantMessageId, setAssistantMessageId] = useState<string | null>(
    null,
  );
  const [sessionLoadTick, setSessionLoadTick] = useState(0);
  const [chatLoading, setChatLoading] = useState(false);

  // Track command IDs by itemId across renders
  const commandIdMapRef = useRef(new Map<string, string>());
  const thinkingIdMapRef = useRef(new Map<string, string>());
  const approvalMessageIdMapRef = useRef(new Map<string, string>());
  const approvalRequestStateRef = useRef(
    new Map<string, ApprovalRequestData>(),
  );
  const codexInitializedRef = useRef(false);
  const threadStartPromiseRef = useRef<Promise<string | null> | null>(null);
  const threadStartRequestSeqRef = useRef(0);
  const pendingFreshThreadIdsRef = useRef(new Set<string>());
  const delayedSessionRefreshTimersRef = useRef(
    new Set<ReturnType<typeof setTimeout>>(),
  );

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
  const setActiveSession = useSessionStore((state) => state.setActiveSession);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commitSheetOpen, setCommitSheetOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [commitStatusText, setCommitStatusText] = useState("");
  const [commitSubmitting, setCommitSubmitting] = useState(false);
  const [commitBranch, setCommitBranch] = useState("-");
  const [commitChangedFiles, setCommitChangedFiles] = useState(0);
  const [commitAdditions, setCommitAdditions] = useState(0);
  const [commitDeletions, setCommitDeletions] = useState(0);
  const [threadUsageByThreadId, setThreadUsageByThreadId] = useState<
    Record<string, ThreadUsageSnapshot>
  >({});
  const [accountUsage, setAccountUsage] = useState<AccountUsageSnapshot | null>(
    null,
  );
  const [usageHintText, setUsageHintText] = useState("Refreshing usage...");
  const setActiveDiffSession = useDiffStore((state) => state.setActiveSession);
  const setDiffSnapshot = useDiffStore((state) => state.setDiffSnapshot);
  const isDiffPanelOpen = useUiStore((state) => state.isDiffPanelOpen);
  const openDiffPanel = useUiStore((state) => state.openDiffPanel);
  const closeDiffPanel = useUiStore((state) => state.closeDiffPanel);

  const setRuntimeOptions = useRuntimeOptionsStore((state) => state.setOptions);
  const setRuntimeOptionsLoading = useRuntimeOptionsStore(
    (state) => state.setLoading,
  );
  const setModelOptions = useRuntimeOptionsStore(
    (state) => state.setModelOptions,
  );
  const setRuntimeOptionsError = useRuntimeOptionsStore(
    (state) => state.setError,
  );
  const selectedModel = useRuntimeOptionsStore((state) => state.selectedModel);
  const selectedThinking = useRuntimeOptionsStore(
    (state) => state.selectedThinking,
  );
  const threadSelections = useRuntimeOptionsStore(
    (state) => state.threadSelections,
  );
  const loadRuntimeSelections = useRuntimeOptionsStore(
    (state) => state.loadSelections,
  );
  const runtimePermission = useRuntimeOptionsStore(
    (state) => state.options.permission,
  );

  const runtimeModel = useRuntimeOptionsStore((state) => state.options.model);
  const runtimeThinking = useRuntimeOptionsStore(
    (state) => state.options.thinking,
  );

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
  const replaceMessages = useChatStore((state) => state.replaceMessages);
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
  const upsertApprovalRequest = useChatStore(
    (state) => state.upsertApprovalRequest,
  );
  const updateApprovalRequest = useChatStore(
    (state) => state.updateApprovalRequest,
  );
  const addFileChanges = useChatStore((state) => state.addFileChanges);

  const activeProject =
    projects.find((project) => project.id === activeProjectId) || null;
  const gitCwd = getGitCwd(activeProject?.description);
  const normalizedActiveSessionId = normalizeThreadReference(activeSessionId);
  const activeThreadUsage = normalizedActiveSessionId
    ? threadUsageByThreadId[normalizedActiveSessionId] || null
    : null;
  const sidebarUsageItems = useMemo(
    () =>
      buildSidebarUsageItems({
        accountUsage,
        threadUsage: activeThreadUsage,
      }),
    [accountUsage, activeThreadUsage],
  );

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

  const refreshCodexSessions = useCallback(
    async (options?: {
      preserveActiveSessionId?: string | null;
      preserveActiveSessionTitle?: string | null;
    }) => {
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
      let mappedProjects = mapCodexSessionsToProjects(sessions);
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

      const currentSessionState = useSessionStore.getState();
      let nextActiveProjectId = currentSessionState.activeProjectId;
      let nextActiveSessionId = currentSessionState.activeSessionId;
      let didInjectOptimisticSession = false;
      const preservedActiveSessionId = normalizeThreadReference(
        options?.preserveActiveSessionId,
      );
      const preservedActiveSessionTitle = sanitizeSessionTitle(
        options?.preserveActiveSessionTitle || "",
      );

      if (preservedActiveSessionId) {
        nextActiveSessionId = preservedActiveSessionId;
      }

      if (
        !nextActiveProjectId ||
        !mappedProjects.some((project) => project.id === nextActiveProjectId)
      ) {
        nextActiveProjectId = mappedProjects[0]?.id || null;
      }

      if (preservedActiveSessionId && nextActiveProjectId) {
        const projectIndex = mappedProjects.findIndex(
          (project) => project.id === nextActiveProjectId,
        );
        let targetProject =
          projectIndex >= 0 ? mappedProjects[projectIndex] : null;

        if (targetProject && preservedActiveSessionTitle) {
          let retitled = false;
          const retitledSessions = targetProject.sessions.map((session) => {
            if (
              normalizeThreadReference(session.id) !== preservedActiveSessionId
            ) {
              return session;
            }
            if (
              session.name !== "Untitled chat" &&
              session.name !== "New chat"
            ) {
              return session;
            }
            retitled = true;
            return {
              ...session,
              name: preservedActiveSessionTitle,
            };
          });

          if (retitled) {
            mappedProjects = [...mappedProjects];
            targetProject = {
              ...targetProject,
              sessions: retitledSessions,
            };
            mappedProjects[projectIndex] = targetProject;
          }
        }

        const hasPreservedSessionInProject = !!targetProject?.sessions.some(
          (session) =>
            normalizeThreadReference(session.id) === preservedActiveSessionId,
        );

        if (targetProject && !hasPreservedSessionInProject) {
          const optimisticTimestamp = Date.now();
          mappedProjects = [...mappedProjects];
          mappedProjects[projectIndex] = {
            ...targetProject,
            sessions: [
              {
                id: preservedActiveSessionId,
                name: preservedActiveSessionTitle || "New chat",
                createdAt: optimisticTimestamp,
                lastActiveAt: optimisticTimestamp,
              },
              ...targetProject.sessions,
            ].sort((lhs, rhs) => rhs.lastActiveAt - lhs.lastActiveAt),
          };
          didInjectOptimisticSession = true;
          console.log(
            "[mobile][codex/sessions/list] injected optimistic session",
            {
              projectId: nextActiveProjectId,
              sessionId: preservedActiveSessionId,
            },
          );
        }
      }

      if (nextActiveProjectId) {
        const activeProject =
          mappedProjects.find(
            (project) => project.id === nextActiveProjectId,
          ) || null;
        const normalizedNextActiveSessionId =
          normalizeThreadReference(nextActiveSessionId);
        const hasActiveSession =
          !!normalizedNextActiveSessionId &&
          !!activeProject?.sessions.some(
            (session) =>
              normalizeThreadReference(session.id) ===
              normalizedNextActiveSessionId,
          );
        const shouldPreserveMissingSession =
          !!normalizedNextActiveSessionId &&
          (normalizedNextActiveSessionId === preservedActiveSessionId ||
            pendingFreshThreadIdsRef.current.has(
              normalizedNextActiveSessionId,
            ));
        const isOptimisticallyInjectedSession =
          didInjectOptimisticSession &&
          normalizedNextActiveSessionId === preservedActiveSessionId;

        if (
          hasActiveSession &&
          normalizedNextActiveSessionId &&
          !isOptimisticallyInjectedSession
        ) {
          pendingFreshThreadIdsRef.current.delete(
            normalizedNextActiveSessionId,
          );
        }

        if (
          normalizedNextActiveSessionId &&
          !hasActiveSession &&
          !shouldPreserveMissingSession
        ) {
          nextActiveSessionId = activeProject?.sessions[0]?.id || null;
        }
      }

      replaceProjects(mappedProjects, nextActiveProjectId, nextActiveSessionId);
      console.log(
        `[mobile][codex/sessions/list] store updated activeProject=${nextActiveProjectId || "none"} activeSession=${nextActiveSessionId || "none"}`,
      );
    },
    [replaceProjects],
  );

  const refreshThreadUsage = useCallback(async (threadId?: string | null) => {
    const normalizedThreadId = normalizeThreadReference(threadId);
    if (!normalizedThreadId || !relayService.isSecureReady()) {
      return false;
    }

    try {
      const result = await relayService.requestJson<unknown>(
        "thread/contextWindow/read",
        {
          threadId: normalizedThreadId,
        },
        10_000,
      );
      const parsed = parseThreadUsageSnapshot(result);
      if (!parsed) {
        return false;
      }
      setThreadUsageByThreadId((current) => ({
        ...current,
        [parsed.threadId]: parsed,
      }));
      setUsageHintText("Refreshes automatically");
      return true;
    } catch (error) {
      console.warn("[mobile][thread/contextWindow/read] failed", {
        threadId: normalizedThreadId,
        error,
      });
      return false;
    }
  }, []);

  const refreshAccountUsage = useCallback(async () => {
    if (!relayService.isSecureReady()) {
      return false;
    }

    try {
      const result = await relayService.requestJson<unknown>(
        "account/rateLimits/read",
        {},
        10_000,
      );
      const parsed = parseAccountUsageSnapshot(result);
      if (!parsed) {
        return false;
      }
      setAccountUsage(parsed);
      setUsageHintText("Refreshes automatically");
      return true;
    } catch (error) {
      console.warn("[mobile][account/rateLimits/read] failed", error);
      return false;
    }
  }, []);

  const refreshUsageStatus = useCallback(
    async (threadId?: string | null) => {
      setUsageHintText("Refreshing usage...");
      const results = await Promise.allSettled([
        refreshAccountUsage(),
        refreshThreadUsage(threadId),
      ]);
      const hasFreshData = results.some(
        (result) => result.status === "fulfilled" && result.value,
      );
      if (!hasFreshData) {
        setUsageHintText("Live usage may take a moment");
      }
    },
    [refreshAccountUsage, refreshThreadUsage],
  );

  const scheduleDelayedSessionRefresh = useCallback(
    (sessionId: string | null | undefined, sessionTitle?: string | null) => {
      const normalizedSessionId = normalizeThreadReference(sessionId);
      if (!normalizedSessionId) {
        return;
      }

      const normalizedSessionTitle = sanitizeSessionTitle(sessionTitle || "");

      const delaysMs = [1200, 3500];
      delaysMs.forEach((delayMs) => {
        const timer = setTimeout(() => {
          delayedSessionRefreshTimersRef.current.delete(timer);
          void refreshCodexSessions({
            preserveActiveSessionId: normalizedSessionId,
            preserveActiveSessionTitle: normalizedSessionTitle,
          }).catch((error) => {
            console.warn("[mobile][codex/sessions/list] refresh failed", error);
          });
        }, delayMs);
        delayedSessionRefreshTimersRef.current.add(timer);
      });
    },
    [refreshCodexSessions],
  );

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

  const loadSelectedSession = useCallback(
    (projectId: string, sessionId: string) => {
      pendingFreshThreadIdsRef.current.clear();
      approvalMessageIdMapRef.current.clear();
      approvalRequestStateRef.current.clear();
      setActiveProject(projectId);
      setActiveSession(sessionId);
      setChatLoading(true);
      replaceMessages([]);
      void resumeThread(sessionId);
      setSessionLoadTick((value) => value + 1);
    },
    [replaceMessages, resumeThread, setActiveProject, setActiveSession],
  );

  const ensureActiveThread = useCallback(
    async (forceNewThread = false, preferredCwd?: string | null) => {
      const normalizedActiveSessionId = forceNewThread
        ? ""
        : normalizeThreadReference(activeSessionId);
      if (normalizedActiveSessionId) {
        return normalizedActiveSessionId;
      }

      if (!relayService.isSecureReady()) {
        return null;
      }

      if (threadStartPromiseRef.current && !forceNewThread) {
        return threadStartPromiseRef.current;
      }

      const requestedCwd =
        String(preferredCwd || activeProject?.description || "").trim() || "";
      const requestSeq = threadStartRequestSeqRef.current + 1;
      threadStartRequestSeqRef.current = requestSeq;

      const startThreadPromise = (async () => {
        try {
          const result = await relayService.requestJson<ThreadStartResponse>(
            "thread/start",
            requestedCwd
              ? ({ cwd: requestedCwd } satisfies ThreadStartRequestParams)
              : {},
            20_000,
          );
          const nextThreadId = normalizeThreadReference(
            result?.threadId || result?.thread?.id || result?.thread?.threadId,
          );

          if (nextThreadId) {
            if (requestSeq === threadStartRequestSeqRef.current) {
              pendingFreshThreadIdsRef.current.add(nextThreadId);
              setActiveSession(nextThreadId);
            }
            console.log("[mobile][thread/start] created", {
              threadId: nextThreadId,
              cwd: requestedCwd || null,
            });
            return nextThreadId;
          }

          console.warn(
            "[mobile][thread/start] missing thread id in response",
            result,
          );
          return null;
        } catch (error) {
          console.warn("[mobile][thread/start] failed", error);
          return null;
        } finally {
          threadStartPromiseRef.current = null;
        }
      })();

      threadStartPromiseRef.current = startThreadPromise;
      return startThreadPromise;
    },
    [activeProject?.description, activeSessionId, setActiveSession],
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
      if (
        error instanceof Error &&
        error.message.toLowerCase().includes("relay disconnected")
      ) {
        setIsConnected(false);
      }
    });

    const onPresence = relayService.on("presence", (presence) => {
      setIsConnected(presence === "online");
      if (presence !== "online") {
        codexInitializedRef.current = false;
      }
    });

    const onReady = relayService.on("ready", () => {
      setIsConnected(true);
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

        void refreshUsageStatus(activeSessionId).catch((error) => {
          console.warn("[mobile][usage/refresh] initial refresh failed", error);
        });

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

      if (message.method === "thread/started") {
        const startedThreadId = normalizeThreadReference(
          params?.threadId || params?.thread?.id || params?.thread?.threadId,
        );
        if (startedThreadId) {
          setActiveSession(startedThreadId);
          void refreshCodexSessions({
            preserveActiveSessionId: startedThreadId,
          }).catch((error) => {
            console.warn("[mobile][codex/sessions/list] refresh failed", error);
          });
          scheduleDelayedSessionRefresh(startedThreadId);
        }
      }

      if (message.method === "thread/tokenUsage/updated") {
        const parsed = parseThreadUsageSnapshot(params);
        if (parsed) {
          setThreadUsageByThreadId((current) => ({
            ...current,
            [parsed.threadId]: parsed,
          }));
          setUsageHintText("Refreshes automatically");
        }
      }

      if (
        message.method === "account/rateLimits/updated" ||
        message.method === "account/updated"
      ) {
        const parsed = parseAccountUsageSnapshot(params);
        if (parsed) {
          setAccountUsage(parsed);
          setUsageHintText("Refreshes automatically");
        }
      }

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

      const resolveApprovalRequestId = () => {
        const method = String(message.method || "");
        const canUseJsonRpcIdFallback = method.startsWith("item/");
        const id = normalizeRequestId(
          params?.requestId ??
            eventPayload?.requestId ??
            (canUseJsonRpcIdFallback
              ? (payload as { id?: unknown })?.id
              : undefined),
        );
        if (id == null) {
          return null;
        }
        return id;
      };

      const resolveApprovalItemId = () => {
        const raw = String(
          params?.itemId ||
            params?.item_id ||
            eventPayload?.itemId ||
            eventPayload?.item_id ||
            eventPayload?.call_id ||
            eventPayload?.callId ||
            "",
        ).trim();
        return raw || null;
      };

      const resolveApprovalContext = () => {
        const method = String(message.method || "");
        const isFileChangeApproval =
          method === "item/fileChange/requestApproval" ||
          method === "codex/event/apply_patch_approval_request";

        const requestId = resolveApprovalRequestId();
        const itemId = resolveApprovalItemId();

        const command = isFileChangeApproval
          ? summarizePatchApprovalChanges(
              eventPayload?.changes || params?.changes,
            )
          : stringifyCommandValue(eventPayload?.command || eventPayload?.cmd) ||
            extractCommandFromActions(
              (eventPayload as { commandActions?: unknown }).commandActions,
            ) ||
            "Approve command";

        const workingDirectory = String(
          eventPayload?.cwd ||
            eventPayload?.working_directory ||
            params?.cwd ||
            params?.grantRoot ||
            params?.grant_root ||
            "",
        ).trim();

        const availableDecisions = normalizeAvailableDecisions(
          eventPayload?.availableDecisions ||
            eventPayload?.available_decisions ||
            params?.availableDecisions ||
            params?.available_decisions ||
            (isFileChangeApproval
              ? ["accept", "acceptForSession", "decline", "cancel"]
              : []),
        );

        const proposedExecpolicyAmendment =
          eventPayload?.proposedExecpolicyAmendment ||
          eventPayload?.proposed_execpolicy_amendment ||
          params?.proposedExecpolicyAmendment ||
          params?.proposed_execpolicy_amendment;

        const filePaths = isFileChangeApproval
          ? extractPatchApprovalFilePaths(
              eventPayload?.changes || params?.changes,
            )
          : [];

        return {
          requestId,
          itemId,
          command,
          workingDirectory,
          filePaths,
          availableDecisions,
          proposedExecpolicyAmendment,
          isFileChangeApproval,
        };
      };

      const getOrCreateApprovalMessageId = (
        requestId: string | number,
        itemId: string | null,
      ) => {
        const requestKey = String(requestId);
        const existingByRequest =
          approvalMessageIdMapRef.current.get(requestKey);
        if (existingByRequest) {
          return existingByRequest;
        }

        if (itemId) {
          const existingByItem = approvalMessageIdMapRef.current.get(itemId);
          if (existingByItem) {
            approvalMessageIdMapRef.current.set(requestKey, existingByItem);
            return existingByItem;
          }
        }

        const created = `approval-${requestKey}`;
        approvalMessageIdMapRef.current.set(requestKey, created);
        if (itemId) {
          approvalMessageIdMapRef.current.set(itemId, created);
        }
        return created;
      };

      const upsertApprovalFromEvent = () => {
        const {
          requestId,
          itemId,
          command,
          workingDirectory,
          filePaths,
          availableDecisions,
          proposedExecpolicyAmendment,
          isFileChangeApproval,
        } = resolveApprovalContext();
        if (requestId == null) {
          return null;
        }

        const nextState: ApprovalRequestData = {
          requestId,
          itemId: itemId || undefined,
          approvalType: isFileChangeApproval ? "fileChange" : "command",
          command,
          workingDirectory: workingDirectory || undefined,
          filePaths,
          availableDecisions,
          proposedExecpolicyAmendment,
          status: "pending",
        };

        const stateKey = String(requestId);
        approvalRequestStateRef.current.set(stateKey, nextState);
        if (itemId) {
          approvalRequestStateRef.current.set(itemId, nextState);
        }

        const approvalMessageId = getOrCreateApprovalMessageId(
          requestId,
          itemId,
        );
        upsertApprovalRequest(approvalMessageId, nextState);
        return {
          approvalMessageId,
          requestId,
          itemId,
          state: nextState,
        };
      };

      // Handle message streaming
      if (message.method === "message/stream") {
        const id =
          params?.id || assistantMessageId || `assistant-${Date.now()}`;
        setAssistantMessageId(id);
        appendAssistantDelta(id, params?.delta || "");
      }

      if (message.method === "item/agentMessage/delta") {
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

      if (message.method === "item/commandExecution/requestApproval") {
        upsertApprovalFromEvent();
      }

      if (
        message.method === "item/fileChange/requestApproval" ||
        message.method === "codex/event/apply_patch_approval_request"
      ) {
        upsertApprovalFromEvent();
      }

      if (message.method === "thread/status/changed") {
        const status =
          (eventPayload?.status as
            | { activeFlags?: unknown[]; type?: string }
            | undefined) ||
          (params?.status as
            | { activeFlags?: unknown[]; type?: string }
            | undefined);
        const activeFlags = Array.isArray(status?.activeFlags)
          ? status?.activeFlags
          : [];
        const waitingOnApproval = activeFlags.some(
          (flag) => normalizeEventToken(flag) === "waitingonapproval",
        );
        if (waitingOnApproval) {
          console.log(
            "[mobile][approval] thread waiting on approval; awaiting auto-response",
          );
        }
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
      onPresence();
      onReady();
      onMessage();
    };
  }, [
    assistantMessageId,
    appendAssistantDelta,
    completeAssistantMessage,
    addCommandExecution,
    upsertApprovalRequest,
    upsertSystemMessage,
    updateCommandExecution,
    addFileChanges,
    activeSessionId,
    refreshCodexSessions,
    fetchRuntimeOptions,
    ensureCodexInitialized,
    fetchCodexModelOptions,
    fetchCodexModelOptionsFallback,
    refreshUsageStatus,
    scheduleDelayedSessionRefresh,
    setActiveSession,
    setDiffSnapshot,
  ]);

  useEffect(() => {
    if (!relayService.isSecureReady()) {
      return;
    }
    void refreshUsageStatus(activeSessionId).catch((error) => {
      console.warn("[mobile][usage/refresh] session refresh failed", error);
    });
  }, [activeSessionId, refreshUsageStatus]);

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
        setIsConnected(false);
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
          setIsConnected(false);
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
      setIsConnected(false);
    });
  }, [pairing, privateKey, publicKey, setIdentity, setPairing]);

  useEffect(() => {
    const delayedRefreshTimers = delayedSessionRefreshTimersRef.current;
    return () => {
      delayedRefreshTimers.forEach((timer) => {
        clearTimeout(timer);
      });
      delayedRefreshTimers.clear();
      relayService.disconnect();
    };
  }, []);

  const handleApproveRequest = useCallback(
    async (approvalRequest: ApprovalRequestData | undefined) => {
      if (!approvalRequest) {
        return;
      }
      const requestId = normalizeRequestId(approvalRequest.requestId);
      if (requestId == null) {
        return;
      }

      const messageIdByRequest = approvalMessageIdMapRef.current.get(
        String(requestId),
      );
      const messageIdByItem = approvalRequest.itemId
        ? approvalMessageIdMapRef.current.get(approvalRequest.itemId)
        : null;
      const messageId = messageIdByRequest || messageIdByItem;
      if (!messageId) {
        return;
      }

      updateApprovalRequest(messageId, {
        status: "submitting",
        errorMessage: undefined,
      });

      const decision = pickApproveDecision(
        approvalRequest.availableDecisions || [],
        approvalRequest.proposedExecpolicyAmendment,
      );

      const approvalDecision =
        approvalRequest.approvalType === "fileChange"
          ? (approvalRequest.availableDecisions || []).some((value) => {
              if (typeof value === "string") {
                return normalizeEventToken(value) === "acceptforsession";
              }
              if (value && typeof value === "object") {
                const key =
                  Object.keys(value as Record<string, unknown>)[0] || "";
                return normalizeEventToken(key) === "acceptforsession";
              }
              return false;
            })
            ? "acceptForSession"
            : "accept"
          : decision;

      try {
        await relayService.sendJson({
          jsonrpc: "2.0",
          id: requestId,
          result: {
            decision: approvalDecision,
          },
        });
        updateApprovalRequest(messageId, {
          status: "approved",
        });
      } catch (error) {
        updateApprovalRequest(messageId, {
          status: "error",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Failed to send approval decision.",
        });
      }
    },
    [updateApprovalRequest],
  );

  const handleRejectRequest = useCallback(
    async (approvalRequest: ApprovalRequestData | undefined) => {
      if (!approvalRequest) {
        return;
      }
      const requestId = normalizeRequestId(approvalRequest.requestId);
      if (requestId == null) {
        return;
      }

      const messageIdByRequest = approvalMessageIdMapRef.current.get(
        String(requestId),
      );
      const messageIdByItem = approvalRequest.itemId
        ? approvalMessageIdMapRef.current.get(approvalRequest.itemId)
        : null;
      const messageId = messageIdByRequest || messageIdByItem;
      if (!messageId) {
        return;
      }

      updateApprovalRequest(messageId, {
        status: "submitting",
        errorMessage: undefined,
      });

      const decision =
        approvalRequest.approvalType === "fileChange"
          ? pickFileRejectDecision(approvalRequest.availableDecisions || [])
          : pickRejectDecision(approvalRequest.availableDecisions || []);

      try {
        await relayService.sendJson({
          jsonrpc: "2.0",
          id: requestId,
          result: {
            decision,
          },
        });
        updateApprovalRequest(messageId, {
          status: "rejected",
        });
      } catch (error) {
        updateApprovalRequest(messageId, {
          status: "error",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Failed to send reject decision.",
        });
      }
    },
    [updateApprovalRequest],
  );

  async function send(text: string) {
    if (!text.trim()) {
      return;
    }

    const messageId = addUserMessage(text);
    setAssistantMessageId(null);
    setChatLoading(false);

    try {
      const initialized = await ensureCodexInitialized();
      if (!initialized) {
        throw new Error("Codex initialize failed.");
      }

      const normalizedActiveSessionId =
        (await ensureActiveThread()) ||
        normalizeThreadReference(activeSessionId);
      if (!normalizedActiveSessionId) {
        throw new Error(
          "Unable to create or resolve a thread for this message.",
        );
      }
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

      const shouldResumeThread =
        normalizedActiveSessionId &&
        !pendingFreshThreadIdsRef.current.has(normalizedActiveSessionId);
      if (shouldResumeThread) {
        await resumeThread(normalizedActiveSessionId);
        pendingFreshThreadIdsRef.current.delete(normalizedActiveSessionId);
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
      const acknowledgedThreadId = normalizeThreadReference(
        turnStartResult?.threadId || requestParams.threadId,
      );
      const optimisticSessionTitle = sanitizeSessionTitle(text);
      if (acknowledgedThreadId) {
        void refreshCodexSessions({
          preserveActiveSessionId: acknowledgedThreadId,
          preserveActiveSessionTitle: optimisticSessionTitle,
        }).catch((error) => {
          console.warn("[mobile][codex/sessions/list] refresh failed", error);
        });
        scheduleDelayedSessionRefresh(
          acknowledgedThreadId,
          optimisticSessionTitle,
        );
      }
      updateMessageDeliveryState(messageId, "sent");
    } catch (error) {
      console.error("[mobile][send] Failed to send message", error);
      updateMessageDeliveryState(messageId, "failed");
    }
  }

  if (!pairing || !isConnected) {
    return <PairingScreen />;
  }

  return (
    <>
      <ProjectSidebar
        isOpen={sidebarOpen}
        gesturesEnabled={!isDiffPanelOpen}
        usageItems={sidebarUsageItems}
        usageHint={usageHintText}
        usageEmptyText="Usage data unavailable"
        onOpen={() => setSidebarOpen(true)}
        onClose={() => setSidebarOpen(false)}
        onNewChat={() => {
          pendingFreshThreadIdsRef.current.clear();
          approvalMessageIdMapRef.current.clear();
          approvalRequestStateRef.current.clear();
          setChatLoading(false);
          setActiveSession(null);
          replaceMessages([]);
          setAssistantMessageId(null);
        }}
        onProjectSelect={(projectId) => {
          console.log("[mobile][sidebar] project selected", { projectId });
        }}
        onSessionSelect={(projectId, sessionId) => {
          console.log("[mobile][sidebar] session selected", {
            projectId,
            sessionId,
          });
          loadSelectedSession(projectId, sessionId);
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
            onLoadStateChange={setChatLoading}
            showLoadingState={chatLoading}
          />

          <ChatHeader
            onOpenSidebar={() => setSidebarOpen(true)}
            onOpenCommitSheet={() => setCommitSheetOpen(true)}
            onOpenDiffPanel={openDiffPanel}
          />

          <ChatLoadingOverlay
            visible={chatLoading}
            sessionKey={activeSessionId}
          />

          <ScrollView
            style={styles.messages}
            contentContainerStyle={[
              styles.messageContent,
              renderItems.length === 0 && {
                flexGrow: 1,
                justifyContent: "center",
              },
            ]}
          >
            {renderItems.length === 0 ? (
              <EmptyChatState
                projectName={activeProject?.name}
                projects={projects}
                onProjectSelect={(projectId) => {
                  pendingFreshThreadIdsRef.current.clear();
                  approvalMessageIdMapRef.current.clear();
                  approvalRequestStateRef.current.clear();
                  setChatLoading(false);
                  setActiveProject(projectId);
                  setActiveSession(null);
                  replaceMessages([]);
                  setAssistantMessageId(null);
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

                if (item.type === "approval-group") {
                  const commands: CommandExecutionData[] = item.approvals.map(
                    (approval) => ({
                      command: approval.command || "Approval command",
                      status:
                        approval.status === "approved"
                          ? "completed"
                          : approval.status === "rejected"
                            ? "stopped"
                            : "failed",
                      workingDirectory: approval.workingDirectory,
                      output: approval.errorMessage,
                    }),
                  );
                  return (
                    <MessageBubble
                      key={item.id}
                      role="system"
                      text=""
                      kind="command-execution"
                      commandExecutions={commands}
                    />
                  );
                }

                const { message } = item;
                const approvalRequest = message.approvalRequest;
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
                    approvalRequest={approvalRequest}
                    onApprove={
                      approvalRequest
                        ? () => {
                            void handleApproveRequest(approvalRequest);
                          }
                        : undefined
                    }
                    onReject={
                      approvalRequest
                        ? () => {
                            void handleRejectRequest(approvalRequest);
                          }
                        : undefined
                    }
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
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 200,
    gap: 20,
  },
});
