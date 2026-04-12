import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

export type RuntimeOptions = {
  model: string | null;
  thinking: string | null;
  permission: string | null;
  branch: string | null;
  type: string | null;
};

export type ModelReasoningEffortOption = {
  reasoningEffort: string;
  description?: string;
};

export type ModelOption = {
  id: string;
  model: string;
  displayName?: string;
  hidden?: boolean;
  supportedReasoningEfforts?: ModelReasoningEffortOption[];
  defaultReasoningEffort?: string;
};

type ThreadSelection = {
  model: string | null;
  thinking: string | null;
  permission: string | null;
  branch: string | null;
};

type RuntimeOptionsStore = {
  options: RuntimeOptions;
  modelOptions: ModelOption[];
  selectedModel: string | null;
  selectedThinking: string | null;
  threadSelections: Record<string, ThreadSelection>;
  selectionsLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  setOptions: (options: RuntimeOptions) => void;
  setModelOptions: (modelOptions: ModelOption[]) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  loadSelections: () => Promise<void>;
  setSelectedModel: (model: string | null) => Promise<void>;
  setSelectedThinking: (thinking: string | null) => Promise<void>;
};

const SELECTED_MODEL_KEY = "runtime.selected.model";
const SELECTED_THINKING_KEY = "runtime.selected.thinking";
const SELECTED_PERMISSION_KEY = "runtime.selected.permission";
const SELECTED_BRANCH_KEY = "runtime.selected.branch";
const THREAD_SELECTIONS_KEY = "runtime.thread.selections";

function normalizeSelection(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export const useRuntimeOptionsStore = create<RuntimeOptionsStore>((set) => ({
  options: {
    model: null,
    thinking: null,
    permission: null,
    branch: null,
    type: null,
  },
  modelOptions: [],
  selectedModel: null,
  selectedThinking: null,
  threadSelections: {},
  selectionsLoaded: false,
  isLoading: false,
  error: null,
  setOptions(options) {
    set({ options, error: null, isLoading: false });
  },
  setModelOptions(modelOptions) {
    set({ modelOptions });
  },
  setLoading(isLoading) {
    set({ isLoading });
  },
  setError(error) {
    set({ error, isLoading: false });
  },
  async loadSelections() {
    const [
      storedModel,
      storedThinking,
      storedPermission,
      storedBranch,
      storedThreadSelections,
    ] = await Promise.all([
      SecureStore.getItemAsync(SELECTED_MODEL_KEY),
      SecureStore.getItemAsync(SELECTED_THINKING_KEY),
      SecureStore.getItemAsync(SELECTED_PERMISSION_KEY),
      SecureStore.getItemAsync(SELECTED_BRANCH_KEY),
      SecureStore.getItemAsync(THREAD_SELECTIONS_KEY),
    ]);

    let parsedThreadSelections: Record<string, ThreadSelection> = {};
    try {
      const parsed = storedThreadSelections
        ? JSON.parse(storedThreadSelections)
        : {};
      if (parsed && typeof parsed === "object") {
        parsedThreadSelections = parsed;
      }
    } catch {
      parsedThreadSelections = {};
    }

    set({
      selectedModel: normalizeSelection(storedModel),
      selectedThinking: normalizeSelection(storedThinking),
      threadSelections: parsedThreadSelections,
      selectionsLoaded: true,
    });
  },
  async setSelectedModel(model) {
    const normalized = normalizeSelection(model);
    set({ selectedModel: normalized });
    if (normalized) {
      await SecureStore.setItemAsync(SELECTED_MODEL_KEY, normalized);
    } else {
      await SecureStore.deleteItemAsync(SELECTED_MODEL_KEY);
    }
  },
  async setSelectedThinking(thinking) {
    const normalized = normalizeSelection(thinking);
    set({ selectedThinking: normalized });
    if (normalized) {
      await SecureStore.setItemAsync(SELECTED_THINKING_KEY, normalized);
    } else {
      await SecureStore.deleteItemAsync(SELECTED_THINKING_KEY);
    }
  },
}));

export async function setThreadModelSelection(
  threadId: string | null | undefined,
  model: string | null | undefined,
) {
  const normalizedThreadId = normalizeSelection(threadId);
  if (!normalizedThreadId) {
    return;
  }

  const normalizedModel = normalizeSelection(model);
  const state = useRuntimeOptionsStore.getState();
  const current = state.threadSelections[normalizedThreadId] || {
    model: null,
    thinking: null,
    permission: null,
    branch: null,
  };
  const nextSelections = {
    ...state.threadSelections,
    [normalizedThreadId]: {
      ...current,
      model: normalizedModel,
    },
  };

  useRuntimeOptionsStore.setState({ threadSelections: nextSelections });
  await SecureStore.setItemAsync(
    THREAD_SELECTIONS_KEY,
    JSON.stringify(nextSelections),
  );
}

export async function setThreadThinkingSelection(
  threadId: string | null | undefined,
  thinking: string | null | undefined,
) {
  const normalizedThreadId = normalizeSelection(threadId);
  if (!normalizedThreadId) {
    return;
  }

  const normalizedThinking = normalizeSelection(thinking);
  const state = useRuntimeOptionsStore.getState();
  const current = state.threadSelections[normalizedThreadId] || {
    model: null,
    thinking: null,
    permission: null,
    branch: null,
  };
  const nextSelections = {
    ...state.threadSelections,
    [normalizedThreadId]: {
      ...current,
      thinking: normalizedThinking,
    },
  };

  useRuntimeOptionsStore.setState({ threadSelections: nextSelections });
  await SecureStore.setItemAsync(
    THREAD_SELECTIONS_KEY,
    JSON.stringify(nextSelections),
  );
}

export async function setThreadBranchSelection(
  threadId: string | null | undefined,
  branch: string | null | undefined,
) {
  const normalizedThreadId = normalizeSelection(threadId);
  if (!normalizedThreadId) {
    return;
  }

  const normalizedBranch = normalizeSelection(branch);
  const state = useRuntimeOptionsStore.getState();
  const current = state.threadSelections[normalizedThreadId] || {
    model: null,
    thinking: null,
    permission: null,
    branch: null,
  };
  const nextSelections = {
    ...state.threadSelections,
    [normalizedThreadId]: {
      ...current,
      branch: normalizedBranch,
    },
  };

  useRuntimeOptionsStore.setState({ threadSelections: nextSelections });
  await SecureStore.setItemAsync(
    THREAD_SELECTIONS_KEY,
    JSON.stringify(nextSelections),
  );
}

export async function setThreadPermissionSelection(
  threadId: string | null | undefined,
  permission: string | null | undefined,
) {
  const normalizedThreadId = normalizeSelection(threadId);
  if (!normalizedThreadId) {
    return;
  }

  const normalizedPermission = normalizeSelection(permission);
  const state = useRuntimeOptionsStore.getState();
  const current = state.threadSelections[normalizedThreadId] || {
    model: null,
    thinking: null,
    permission: null,
    branch: null,
  };
  const nextSelections = {
    ...state.threadSelections,
    [normalizedThreadId]: {
      ...current,
      permission: normalizedPermission,
    },
  };

  useRuntimeOptionsStore.setState({ threadSelections: nextSelections });
  await SecureStore.setItemAsync(
    THREAD_SELECTIONS_KEY,
    JSON.stringify(nextSelections),
  );
}
