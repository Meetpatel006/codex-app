import { useEffect } from "react";

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
};

type SessionTranscriptLoaderProps = {
  sessionRef: string | null;
  loadTick: number;
};

export function SessionTranscriptLoader({ sessionRef, loadTick }: SessionTranscriptLoaderProps) {
  const replaceMessages = useChatStore((state) => state.replaceMessages);
  const setDiffSnapshot = useDiffStore((state) => state.setDiffSnapshot);

  useEffect(() => {
    let isCancelled = false;

    async function loadTranscript() {
      const normalizedRef = (sessionRef || "").trim();
      if (!normalizedRef) {
        return;
      }

      if (!relayService.isSecureReady()) {
        console.log("[mobile][codex/sessions/read] secure channel not ready; skipping transcript load");
        return;
      }

      try {
        const result = await relayService.requestJson<SessionTranscriptResult>("codex/sessions/read", {
          sessionRef: normalizedRef,
          limit: 400,
        });

        if (isCancelled) {
          return;
        }

        const transcript = Array.isArray(result?.chat) ? result.chat : [];
        const nextMessages: ChatMessage[] = [];
        const collectedDiffs: string[] = [];

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
          if (!role || (!text && !item?.fileChanges && !item?.commandExecution)) {
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
              if (segment.type === "codeBlock" && segment.isDiff && segment.content) {
                collectedDiffs.push(segment.content);
              }
            });
          }
        });

        replaceMessages(nextMessages);
        if (normalizedRef) {
          const latestDiff = collectedDiffs[collectedDiffs.length - 1] || "";
          const parsedFiles = latestDiff ? parseUnifiedDiff(latestDiff) : [];
          setDiffSnapshot(normalizedRef, parsedFiles, {
            preserveSelection: false,
          });
        }
        console.log(
          `[mobile][codex/sessions/read] loaded ${nextMessages.length} messages for sessionRef=${normalizedRef}`,
        );
      } catch (error) {
        if (isCancelled) {
          return;
        }

        console.warn(
          `[mobile][codex/sessions/read] failed to load transcript for sessionRef=${normalizedRef}`,
          error,
        );
      }
    }

    void loadTranscript();

    return () => {
      isCancelled = true;
    };
  }, [loadTick, replaceMessages, sessionRef, setDiffSnapshot]);

  return null;
}
