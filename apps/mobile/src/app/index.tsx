import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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

type CodexSessionSummary = {
  sessionId?: string;
  threadId?: string;
  cwd?: string;
  updatedAtMs?: number;
  rolloutPath?: string;
};

type CodexSessionsListResult = {
  sessions?: CodexSessionSummary[];
};

function mapCodexSessionsToProjects(sessions: CodexSessionSummary[]) {
  const byProject = new Map<
    string,
    {
      id: string;
      name: string;
      description?: string;
      createdAt: number;
      sessions: Array<{
        id: string;
        name: string;
        createdAt: number;
        lastActiveAt: number;
      }>;
    }
  >();

  for (const session of sessions) {
    const rawSessionId = (session.sessionId || session.threadId || "").trim();
    if (!rawSessionId) {
      continue;
    }

    // Keep individual rollout entries visible in mobile like relay-test does.
    const sessionKey = (session.rolloutPath || "").trim() || rawSessionId;

    const lastActiveAt = Number.isFinite(session.updatedAtMs) ? Number(session.updatedAtMs) : Date.now();
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

    const alreadyExists = project.sessions.some((item) => item.id === sessionKey);
    if (alreadyExists) {
      continue;
    }

    project.createdAt = Math.min(project.createdAt, lastActiveAt);
    project.sessions.push({
      id: sessionKey,
      name: `Session ${rawSessionId.slice(0, 8)}`,
      createdAt: lastActiveAt,
      lastActiveAt,
    });
  }

  return Array.from(byProject.values())
    .map((project) => ({
      ...project,
      sessions: project.sessions.sort((lhs, rhs) => rhs.lastActiveAt - lhs.lastActiveAt),
    }))
    .sort((lhs, rhs) => {
      const lhsLatest = lhs.sessions[0]?.lastActiveAt || lhs.createdAt;
      const rhsLatest = rhs.sessions[0]?.lastActiveAt || rhs.createdAt;
      return rhsLatest - lhsLatest;
    });
}

function normalizePathKey(input: string) {
  return input.replace(/\\/g, "/").replace(/\/+$/g, "").toLowerCase();
}

function humanizeProjectName(cwd: string) {
  const normalized = cwd.replace(/\\/g, "/").replace(/\/+$/g, "");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length === 0) {
    return "Workspace";
  }

  const markerIndex = parts.findIndex((part) => part === "apps" || part === "packages");
  if (markerIndex >= 0 && parts[markerIndex + 1]) {
    return `${parts[markerIndex]} / ${parts[markerIndex + 1]}`;
  }

  return parts[parts.length - 1];
}

export default function ChatScreen() {
  const [input, setInput] = useState("");
  const [assistantMessageId, setAssistantMessageId] = useState<string | null>(null);

  const pairing = useSessionStore((state) => state.pairing);
  const loadSession = useSessionStore((state) => state.load);
  const privateKey = useSessionStore((state) => state.mobileIdentityPrivateKeyHex);
  const publicKey = useSessionStore((state) => state.mobileIdentityPublicKeyHex);
  const setIdentity = useSessionStore((state) => state.setMobileIdentity);
  const replaceProjects = useSessionStore((state) => state.replaceProjects);
  const projects = useSessionStore((state) => state.projects);
  const activeProjectId = useSessionStore((state) => state.activeProjectId);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
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

  const refreshCodexSessions = useCallback(async () => {
    if (!relayService.isSecureReady()) {
      console.log("[mobile][codex/sessions/list] secure not ready; skipping refresh");
      return;
    }

    console.log("[mobile][codex/sessions/list] requesting sessions from bridge...");
    const rpcResult = await relayService.requestJson<CodexSessionsListResult>("codex/sessions/list", {
      limit: 150,
    });
    const sessions = Array.isArray(rpcResult?.sessions) ? rpcResult.sessions : [];
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

    if (!nextActiveProjectId || !mappedProjects.some((project) => project.id === nextActiveProjectId)) {
      nextActiveProjectId = mappedProjects[0]?.id || null;
    }

    if (nextActiveProjectId) {
      const activeProject = mappedProjects.find((project) => project.id === nextActiveProjectId) || null;
      const hasActiveSession =
        !!nextActiveSessionId &&
        !!activeProject?.sessions.some((session) => session.id === nextActiveSessionId);
      if (!hasActiveSession) {
        nextActiveSessionId = activeProject?.sessions[0]?.id || null;
      }
    }

    replaceProjects(mappedProjects, nextActiveProjectId, nextActiveSessionId);
    console.log(
      `[mobile][codex/sessions/list] store updated activeProject=${nextActiveProjectId || "none"} activeSession=${nextActiveSessionId || "none"}`,
    );
  }, [activeProjectId, activeSessionId, replaceProjects]);

  useEffect(() => {
    const onPresence = relayService.on("presence", (nextPresence) => {
      setPresence(nextPresence);
    });

    const onError = relayService.on("error", (error) => {
      console.warn("[mobile][relay/error]", error?.message || String(error));
    });

    const onReady = relayService.on("ready", () => {
      setPresence("online");
      void refreshCodexSessions().catch((error) => {
        console.warn("[mobile][codex/sessions/list] refresh failed", error);
      });
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
      onError();
      onReady();
      onMessage();
    };
  }, [
    assistantMessageId,
    appendAssistantDelta,
    completeAssistantMessage,
    refreshCodexSessions,
    setPresence,
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
        bridgeIdentityPublicKey: pairing.bridgeIdentityPublicKey,
      });
    }

    void connect();
  }, [pairing, privateKey, publicKey, setIdentity]);

  useEffect(() => {
    return () => {
      relayService.disconnect();
    };
  }, []);

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
          accessibilityLabel="Open sidebar"
        >
          <Text style={styles.sessionButtonText}>☰</Text>
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
