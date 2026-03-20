import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { MessageBubble } from "@/components/MessageBubble";
import { PresenceIndicator } from "@/components/PresenceIndicator";
import { ProjectSidebar } from "@/components/ProjectSidebar";
import { buildRequest } from "@/services/jsonrpc";
import { relayService } from "@/services/relay";
import { useChatStore } from "@/store/chat";
import { useSessionStore } from "@/store/session";

export default function ChatScreen() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [assistantMessageId, setAssistantMessageId] = useState<string | null>(null);

  const pairing = useSessionStore((state) => state.pairing);
  const loadSession = useSessionStore((state) => state.load);
  const privateKey = useSessionStore((state) => state.mobileIdentityPrivateKeyHex);
  const publicKey = useSessionStore((state) => state.mobileIdentityPublicKeyHex);
  const setIdentity = useSessionStore((state) => state.setMobileIdentity);
  const projects = useSessionStore((state) => state.projects);
  const addProject = useSessionStore((state) => state.addProject);
  const addSessionToProject = useSessionStore((state) => state.addSessionToProject);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const presence = useChatStore((state) => state.presence);
  const messages = useChatStore((state) => state.messages);
  const setPresence = useChatStore((state) => state.setPresence);
  const addUserMessage = useChatStore((state) => state.addUserMessage);
  const appendAssistantDelta = useChatStore((state) => state.appendAssistantDelta);
  const completeAssistantMessage = useChatStore((state) => state.completeAssistantMessage);

  const canSend = useMemo(() => input.trim().length > 0 && presence !== "connecting", [input, presence]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  // Initialize sample projects if none exist
  useEffect(() => {
    if (projects && projects.length === 0) {
      const sampleProjects = [
        {
          id: 'proj-web',
          name: 'Web App',
          description: 'Main web application project',
          createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
          sessions: [
            {
              id: 'sess-web-1',
              name: 'Authentication Flow',
              createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
              lastActiveAt: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
            },
            {
              id: 'sess-web-2',
              name: 'Dashboard Components',
              createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
              lastActiveAt: Date.now() - 24 * 60 * 60 * 1000, // 1 day ago
            },
            {
              id: 'sess-web-3',
              name: 'API Integration',
              createdAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
              lastActiveAt: Date.now() - 30 * 60 * 1000, // 30 mins ago
            },
          ],
        },
        {
          id: 'proj-mobile',
          name: 'Mobile App',
          description: 'React Native mobile app',
          createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
          sessions: [
            {
              id: 'sess-mobile-1',
              name: 'Sidebar Implementation',
              createdAt: Date.now() - 4 * 24 * 60 * 60 * 1000,
              lastActiveAt: Date.now() - 60 * 1000, // 1 minute ago
            },
            {
              id: 'sess-mobile-2',
              name: 'Session Management',
              createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
              lastActiveAt: Date.now() - 12 * 60 * 60 * 1000, // 12 hours ago
            },
          ],
        },
        {
          id: 'proj-backend',
          name: 'Backend API',
          description: 'REST API services',
          createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
          sessions: [
            {
              id: 'sess-backend-1',
              name: 'Database Schema',
              createdAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
              lastActiveAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
            },
            {
              id: 'sess-backend-2',
              name: 'Authentication Endpoints',
              createdAt: Date.now() - 6 * 24 * 60 * 60 * 1000,
              lastActiveAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
            },
          ],
        },
      ];

      sampleProjects.forEach((project) => {
        addProject(project);
      });
    }
  }, [projects, addProject]);

  useEffect(() => {
    const onPresence = relayService.on("presence", (nextPresence) => {
      setPresence(nextPresence);
    });

    const onReady = relayService.on("ready", () => {
      setPresence("online");
    });

    const onMessage = relayService.on("message", (payload) => {
      const message = payload as { method?: string; params?: { delta?: string; id?: string } };
      if (message.method === "message/stream") {
        const id = message.params?.id || assistantMessageId || `assistant-${Date.now()}`;
        setAssistantMessageId(id);
        appendAssistantDelta(id, message.params?.delta || "");
      }
      if (message.method === "message/complete") {
        const id = message.params?.id || assistantMessageId;
        if (id) {
          completeAssistantMessage(id);
        }
      }
    });

    return () => {
      onPresence();
      onReady();
      onMessage();
    };
  }, [assistantMessageId, appendAssistantDelta, completeAssistantMessage, setPresence]);

  useEffect(() => {
    async function connect() {
      if (!pairing) {
        router.replace("/pair");
        return;
      }

      if (pairing.expiryMs < Date.now()) {
        router.replace("/pair");
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

      await relayService.connect({
        relayUrl: pairing.relayUrl,
        sessionId: pairing.sessionId,
        identityPrivateKeyHex: identityPrivate,
      });
    }

    void connect();
    return () => {
      relayService.disconnect();
    };
  }, [pairing, privateKey, publicKey, router, setIdentity]);

  async function send() {
    const text = input.trim();
    if (!text) {
      return;
    }

    addUserMessage(text);
    setInput("");
    setAssistantMessageId(null);

    await relayService.sendJson(
      buildRequest("message/send", {
        content: text,
      }),
    );
  }

  return (
    <View style={styles.container}>
      <ProjectSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onProjectSelect={(projectId) => console.log('Project selected:', projectId)}
        onSessionSelect={(projectId, sessionId) => console.log('Session selected:', projectId, sessionId)}
      />

      <View style={styles.header}>
        <Pressable
          onPress={() => setSidebarOpen(true)}
          style={styles.sessionButton}
        >
          <Text style={styles.sessionButtonText}>Sessions</Text>
        </Pressable>
        <Text style={styles.title}>Chat</Text>
        <PresenceIndicator status={presence} />
      </View>

      <ScrollView style={styles.messages} contentContainerStyle={styles.messageContent}>
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            role={message.role}
            text={message.text}
            streaming={message.isStreaming}
          />
        ))}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask Codex..."
          placeholderTextColor="#777"
          style={styles.input}
          multiline
        />
        <Pressable onPress={() => void send()} style={[styles.sendButton, !canSend && styles.disabled]}>
          <Text style={styles.sendButtonText}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b0b0b",
    paddingHorizontal: 12,
    paddingTop: 48,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  sessionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3a3a3a",
    backgroundColor: "#1a1a1a",
  },
  sessionButtonText: {
    color: "#f0f0f0",
    fontSize: 13,
    fontWeight: "600",
  },
  title: {
    color: "#f0f0f0",
    fontSize: 20,
    fontWeight: "700",
    flex: 1,
  },
  messages: {
    flex: 1,
  },
  messageContent: {
    paddingBottom: 8,
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-end",
    paddingBottom: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    color: "#eee",
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#141414",
  },
  sendButton: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: "#2d5f2d",
  },
  disabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
});
