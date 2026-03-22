import { useEffect } from "react";

import { relayService } from "@/services/relay";
import { type ChatMessage, useChatStore } from "@/store/chat";

type SessionTranscriptResult = {
  chat?: Array<{
    id?: string;
    role?: "user" | "assistant";
    text?: string;
    timestamp?: string;
  }>;
  rolloutPath?: string;
};

type SessionTranscriptLoaderProps = {
  sessionRef: string | null;
  loadTick: number;
};

export function SessionTranscriptLoader({ sessionRef, loadTick }: SessionTranscriptLoaderProps) {
  const replaceMessages = useChatStore((state) => state.replaceMessages);

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

        transcript.forEach((item, index) => {
          const role = item?.role === "assistant" ? "assistant" : item?.role === "user" ? "user" : "";
          const text = typeof item?.text === "string" ? item.text.trim() : "";
          if (!role || !text) {
            return;
          }

          nextMessages.push({
            id: item.id || `history-${role}-${index + 1}`,
            role,
            text,
            isStreaming: false,
          });
        });

        replaceMessages(nextMessages);
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
  }, [loadTick, replaceMessages, sessionRef]);

  return null;
}
