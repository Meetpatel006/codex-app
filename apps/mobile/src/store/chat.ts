import { create } from "zustand";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  isStreaming?: boolean;
};

type ChatStore = {
  presence: "online" | "offline" | "connecting";
  messages: ChatMessage[];
  setPresence: (presence: ChatStore["presence"]) => void;
  addUserMessage: (text: string) => void;
  appendAssistantDelta: (id: string, delta: string) => void;
  completeAssistantMessage: (id: string) => void;
};

export const useChatStore = create<ChatStore>((set) => ({
  presence: "offline",
  messages: [],
  setPresence(presence) {
    set({ presence });
  },
  addUserMessage(text) {
    const id = `user-${Date.now()}`;
    set((state) => ({
      messages: [...state.messages, { id, role: "user", text }],
    }));
  },
  appendAssistantDelta(id, delta) {
    set((state) => {
      const index = state.messages.findIndex((item) => item.id === id);
      if (index === -1) {
        return {
          messages: [...state.messages, { id, role: "assistant", text: delta, isStreaming: true }],
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
}));
