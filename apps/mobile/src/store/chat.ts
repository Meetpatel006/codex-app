import { create } from "zustand";

export type CommandExecutionData = {
  command: string;
  status: "running" | "completed" | "failed" | "stopped";
  workingDirectory?: string;
  exitCode?: number;
  duration?: number;
  output?: string;
};

export type ApprovalRequestData = {
  requestId?: string | number;
  itemId?: string;
  approvalType?: "command" | "fileChange";
  command: string;
  workingDirectory?: string;
  filePaths?: string[];
  availableDecisions?: unknown[];
  proposedExecpolicyAmendment?: unknown;
  status: "pending" | "submitting" | "approved" | "rejected" | "error";
  errorMessage?: string;
};

export type FileChangeData = {
  path: string;
  action: "created" | "edited" | "deleted" | "renamed" | "moved";
  additions?: number;
  deletions?: number;
  diff?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  isStreaming?: boolean;
  kind?:
    | "thinking"
    | "file-change"
    | "plan"
    | "command-execution"
    | "approval"
    | "normal";
  deliveryState?: "sending" | "sent" | "failed";
  commandExecution?: CommandExecutionData;
  fileChanges?: FileChangeData[];
  approvalRequest?: ApprovalRequestData;
};

type ChatStore = {
  presence: "online" | "offline" | "connecting";
  messages: ChatMessage[];
  setPresence: (presence: ChatStore["presence"]) => void;
  replaceMessages: (messages: ChatMessage[]) => void;
  addUserMessage: (text: string) => string;
  appendAssistantDelta: (id: string, delta: string) => void;
  completeAssistantMessage: (id: string) => void;
  addSystemMessage: (text: string, kind?: ChatMessage["kind"]) => void;
  upsertSystemMessage: (
    id: string,
    text: string,
    kind?: ChatMessage["kind"],
    options?: { append?: boolean; streaming?: boolean },
  ) => void;
  updateMessageDeliveryState: (
    id: string,
    state: ChatMessage["deliveryState"],
  ) => void;
  addCommandExecution: (data: CommandExecutionData) => string;
  updateCommandExecution: (
    id: string,
    data: Partial<CommandExecutionData>,
  ) => void;
  upsertApprovalRequest: (id: string, data: ApprovalRequestData) => void;
  updateApprovalRequest: (
    id: string,
    data: Partial<ApprovalRequestData>,
  ) => void;
  addFileChanges: (changes: FileChangeData[]) => void;
};

export const useChatStore = create<ChatStore>((set) => ({
  presence: "offline",
  messages: [],
  setPresence(presence) {
    set({ presence });
  },
  replaceMessages(messages) {
    set({ messages });
  },
  addUserMessage(text) {
    const id = `user-${Date.now()}`;
    set((state) => ({
      messages: [
        ...state.messages,
        { id, role: "user", text, deliveryState: "sending" },
      ],
    }));
    return id;
  },
  appendAssistantDelta(id, delta) {
    set((state) => {
      const index = state.messages.findIndex((item) => item.id === id);
      if (index === -1) {
        return {
          messages: [
            ...state.messages,
            {
              id,
              role: "assistant",
              text: delta,
              isStreaming: true,
              kind: "normal",
            },
          ],
        };
      }

      const nextMessages = [...state.messages];
      nextMessages[index] = {
        ...nextMessages[index],
        text: `${nextMessages[index].text}${delta}`,
        isStreaming: true,
      };
      return { messages: nextMessages };
    });
  },
  completeAssistantMessage(id) {
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === id ? { ...message, isStreaming: false } : message,
      ),
    }));
  },
  addSystemMessage(text, kind = "normal") {
    const id = `system-${Date.now()}`;
    set((state) => ({
      messages: [...state.messages, { id, role: "system", text, kind }],
    }));
  },
  upsertSystemMessage(id, text, kind = "normal", options) {
    set((state) => {
      const index = state.messages.findIndex((message) => message.id === id);
      if (index === -1) {
        return {
          messages: [
            ...state.messages,
            {
              id,
              role: "system",
              text,
              kind,
              isStreaming: options?.streaming,
            },
          ],
        };
      }

      const nextMessages = [...state.messages];
      nextMessages[index] = {
        ...nextMessages[index],
        text: options?.append ? `${nextMessages[index].text}${text}` : text,
        kind,
        isStreaming: options?.streaming ?? nextMessages[index].isStreaming,
      };
      return { messages: nextMessages };
    });
  },
  updateMessageDeliveryState(id, deliveryState) {
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === id ? { ...message, deliveryState } : message,
      ),
    }));
  },
  addCommandExecution(data) {
    const id = `command-${Date.now()}`;
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id,
          role: "system",
          text: data.command,
          kind: "command-execution",
          commandExecution: data,
        },
      ],
    }));
    return id;
  },
  updateCommandExecution(id, data) {
    set((state) => ({
      messages: state.messages.map((message) => {
        if (message.id === id && message.commandExecution) {
          // Handle output appending specially
          const updatedExecution = { ...message.commandExecution };

          if (data.output !== undefined) {
            // Append output delta to existing output
            updatedExecution.output =
              (updatedExecution.output || "") + data.output;
          }

          // Update other fields normally
          Object.keys(data).forEach((key) => {
            if (key !== "output") {
              updatedExecution[key as keyof CommandExecutionData] = data[
                key as keyof CommandExecutionData
              ] as never;
            }
          });

          return {
            ...message,
            commandExecution: updatedExecution,
          };
        }
        return message;
      }),
    }));
  },
  upsertApprovalRequest(id, data) {
    set((state) => {
      const index = state.messages.findIndex((message) => message.id === id);
      if (index === -1) {
        return {
          messages: [
            ...state.messages,
            {
              id,
              role: "system",
              text: data.command,
              kind: "approval",
              approvalRequest: data,
            },
          ],
        };
      }

      const nextMessages = [...state.messages];
      const existingApproval = nextMessages[index].approvalRequest || {
        requestId: data.requestId,
        command: data.command,
        status: "pending" as const,
      };
      nextMessages[index] = {
        ...nextMessages[index],
        role: "system",
        text: data.command,
        kind: "approval",
        approvalRequest: {
          ...existingApproval,
          ...data,
        },
      };

      return { messages: nextMessages };
    });
  },
  updateApprovalRequest(id, data) {
    set((state) => ({
      messages: state.messages.map((message) => {
        if (message.id !== id || !message.approvalRequest) {
          return message;
        }

        return {
          ...message,
          approvalRequest: {
            ...message.approvalRequest,
            ...data,
          },
        };
      }),
    }));
  },
  addFileChanges(changes) {
    const id = `file-change-${Date.now()}`;
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id,
          role: "system",
          text: "Applying file changes...",
          kind: "file-change",
          fileChanges: changes,
        },
      ],
    }));
  },
}));
