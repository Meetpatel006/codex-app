import { startTransition, useEffect } from "react";

import { relayService } from "@/services/relay";
import {
  type ChatMessage,
  type CommandExecutionData,
  type FileChangeData,
  useChatStore,
} from "@/store/chat";
import { useDiffStore } from "@/store/diff";
import { parseMarkdownSegments } from "@/utils/markdown-parser";
import { parseUnifiedDiff } from "@/utils/diff";
import {
  setThreadModelSelection,
  setThreadThinkingSelection,
} from "@/store/runtime-options";

type SessionTranscriptResult = {
  chat?: {
    id?: string;
    role?: "user" | "assistant" | "system";
    kind?: ChatMessage["kind"];
    text?: string;
    timestamp?: string;
    commandExecution?: CommandExecutionData;
    fileChanges?: FileChangeData[];
  }[];
  rolloutPath?: string;
  model?: string;
  effort?: string;
};

type SessionTranscriptLoaderProps = {
  sessionRef: string | null;
  loadTick: number;
  onLoadStateChange?: (loading: boolean) => void;
  showLoadingState?: boolean;
};

export function SessionTranscriptLoader({
  sessionRef,
  loadTick,
  onLoadStateChange,
  showLoadingState = true,
}: SessionTranscriptLoaderProps) {
  const replaceMessages = useChatStore((state) => state.replaceMessages);
  const setDiffSnapshot = useDiffStore((state) => state.setDiffSnapshot);

  useEffect(() => {
    let isCancelled = false;

    async function loadTranscript() {
      const normalizedRef = normalizeThreadReference(sessionRef);
      if (!normalizedRef) {
        onLoadStateChange?.(false);
        return;
      }

      if (showLoadingState) {
        onLoadStateChange?.(true);
      }
      await waitForNextFrame();

      if (!relayService.isSecureReady()) {
        console.log(
          "[mobile][codex/sessions/read] secure channel not ready; skipping transcript load",
        );
        onLoadStateChange?.(false);
        return;
      }

      try {
        const result = await relayService.requestJson<SessionTranscriptResult>(
          "codex/sessions/read",
          {
            sessionRef: normalizedRef,
            limit: 400,
          },
        );

        if (isCancelled) {
          return;
        }

        const transcript = Array.isArray(result?.chat) ? result.chat : [];
        const sessionModel =
          typeof result?.model === "string" ? result.model.trim() : "";
        const sessionEffort =
          typeof result?.effort === "string" ? result.effort.trim() : "";
        const nextMessages: ChatMessage[] = [];
        const collectedDiffs: string[] = [];

        if (sessionModel) {
          await setThreadModelSelection(normalizedRef, sessionModel);
        }
        if (sessionEffort) {
          await setThreadThinkingSelection(normalizedRef, sessionEffort);
        }

        transcript.forEach((item, index) => {
          const role =
            item?.role === "assistant"
              ? "assistant"
              : item?.role === "user"
                ? "user"
                : item?.role === "system"
                  ? "system"
                  : "";
          const text =
            typeof item?.text === "string"
              ? item.text
              : item?.kind === "file-change"
                ? "Applying file changes..."
                : item?.kind === "command-execution"
                  ? item?.commandExecution?.command || "Running command..."
                  : "";
          if (
            !role ||
            (!text && !item?.fileChanges && !item?.commandExecution)
          ) {
            return;
          }

          nextMessages.push({
            id: item.id || `history-${role}-${index + 1}`,
            role,
            text,
            isStreaming: false,
            kind: item.kind || "normal",
            commandExecution: item.commandExecution,
            fileChanges: item.fileChanges,
          });

          if (Array.isArray(item.fileChanges)) {
            item.fileChanges.forEach((change) => {
              if (change?.diff) {
                collectedDiffs.push(change.diff);
              }
            });
          }

          if (role === "assistant") {
            parseMarkdownSegments(text).forEach((segment) => {
              if (
                segment.type === "codeBlock" &&
                segment.isDiff &&
                segment.content
              ) {
                collectedDiffs.push(segment.content);
              }
            });
          }
        });

        startTransition(() => {
          replaceMessages(nextMessages);
        });
        if (normalizedRef) {
          const latestDiff = collectedDiffs[collectedDiffs.length - 1] || "";
          const parsedFiles = latestDiff ? parseUnifiedDiff(latestDiff) : [];
          setDiffSnapshot(normalizedRef, parsedFiles, {
            preserveSelection: false,
          });
        }
        console.log(
          `[mobile][codex/sessions/read] loaded ${nextMessages.length} messages for sessionRef=${normalizedRef} model=${sessionModel || "none"} effort=${sessionEffort || "none"}`,
        );
      } catch (error) {
        if (isCancelled) {
          return;
        }

        console.warn(
          `[mobile][codex/sessions/read] failed to load transcript for sessionRef=${normalizedRef}`,
          error,
        );
      } finally {
        if (!isCancelled) {
          await wait(180);
          await waitForNextFrame();
          onLoadStateChange?.(false);
        }
      }
    }

    void loadTranscript();

    return () => {
      isCancelled = true;
    };
  }, [
    loadTick,
    onLoadStateChange,
    replaceMessages,
    sessionRef,
    setDiffSnapshot,
    showLoadingState,
  ]);

  return null;
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

function waitForNextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function wait(durationMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
}
