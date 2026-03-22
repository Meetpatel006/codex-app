import { create } from "zustand";

import type { ParsedDiffFile } from "@/utils/diff";

type DiffSessionState = {
  files: ParsedDiffFile[];
  selectedFileId: string | null;
  sourceMessageId?: string | null;
  updatedAt: number;
};

type DiffStore = {
  sessions: Record<string, DiffSessionState>;
  activeSessionId: string | null;
  setActiveSession: (sessionId: string | null) => void;
  setDiffSnapshot: (
    sessionId: string,
    files: ParsedDiffFile[],
    options?: {
      sourceMessageId?: string | null;
      preserveSelection?: boolean;
    },
  ) => void;
  selectFile: (sessionId: string, fileId: string | null) => void;
  clearSession: (sessionId: string) => void;
};

function resolveSelectedFileId(
  previous: DiffSessionState | undefined,
  files: ParsedDiffFile[],
  preserveSelection = true,
) {
  if (preserveSelection && previous?.selectedFileId) {
    const stillExists = files.some((file) => file.id === previous.selectedFileId);
    if (stillExists) {
      return previous.selectedFileId;
    }
  }

  return files[0]?.id || null;
}

export const useDiffStore = create<DiffStore>((set) => ({
  sessions: {},
  activeSessionId: null,
  setActiveSession(sessionId) {
    set({ activeSessionId: sessionId });
  },
  setDiffSnapshot(sessionId, files, options) {
    set((state) => {
      const previous = state.sessions[sessionId];
      const nextSelectedFileId = resolveSelectedFileId(
        previous,
        files,
        options?.preserveSelection,
      );

      return {
        sessions: {
          ...state.sessions,
          [sessionId]: {
            files,
            selectedFileId: nextSelectedFileId,
            sourceMessageId: options?.sourceMessageId ?? previous?.sourceMessageId ?? null,
            updatedAt: Date.now(),
          },
        },
      };
    });
  },
  selectFile(sessionId, fileId) {
    set((state) => {
      const existing = state.sessions[sessionId];
      if (!existing) {
        return state;
      }

      return {
        sessions: {
          ...state.sessions,
          [sessionId]: {
            ...existing,
            selectedFileId: fileId,
          },
        },
      };
    });
  },
  clearSession(sessionId) {
    set((state) => {
      const nextSessions = { ...state.sessions };
      delete nextSessions[sessionId];
      return { sessions: nextSessions };
    });
  },
}));
