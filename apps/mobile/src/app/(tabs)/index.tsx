import { Link, router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { MessageBubble } from "@/components/MessageBubble";
import { PresenceIndicator } from "@/components/PresenceIndicator";
import { SessionTranscriptLoader } from "@/components/SessionTranscriptLoader";
import { ProjectSidebar } from "@/components/ProjectSidebar";
import { PromptInput } from "@/components/prompt-input";
import {
  MenuIcon,
  GitCommitIcon,
  CodeDiffIcon,
} from "@/components/icons/Icon";
import { buildRequest } from "@/services/jsonrpc";
import { relayService } from "@/services/relay";
import { useChatStore } from "@/store/chat";
import { useDiffStore } from "@/store/diff";
import { parseUnifiedDiff } from "@/utils/diff";
import { useSessionStore } from "@/store/session";
import { useTheme } from "@/hooks/use-theme";

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
    const rawSessionId = (session.sessionId || session.threadId || "").trim();
    if (!rawSessionId) {
      continue;
    }

    // Keep individual rollout entries visible in mobile like relay-test does.
    const sessionKey = (session.rolloutPath || "").trim() || rawSessionId;

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
    normalized === "test" ||
    normalized === "ping"
  );
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

  const markerIndex = parts.findIndex(
    (part) => part === "apps" || part === "packages",
  );
  if (markerIndex >= 0 && parts[markerIndex + 1]) {
    return `${parts[markerIndex]} / ${parts[markerIndex + 1]}`;
  }

  return parts[parts.length - 1];
}

export default function ChatScreen() {
  const theme = useTheme();
  const [assistantMessageId, setAssistantMessageId] = useState<string | null>(
    null,
  );
  const [sessionLoadTick, setSessionLoadTick] = useState(0);

  // Track command IDs by itemId across renders
  const commandIdMapRef = useRef(new Map<string, string>());
  const thinkingIdMapRef = useRef(new Map<string, string>());

  const pairing = useSessionStore((state) => state.pairing);
  const loadSession = useSessionStore((state) => state.load);
  const privateKey = useSessionStore(
    (state) => state.mobileIdentityPrivateKeyHex,
  );
  const publicKey = useSessionStore(
    (state) => state.mobileIdentityPublicKeyHex,
  );
  const setIdentity = useSessionStore((state) => state.setMobileIdentity);
  const replaceProjects = useSessionStore((state) => state.replaceProjects);
  const projects = useSessionStore((state) => state.projects);
  const activeProjectId = useSessionStore((state) => state.activeProjectId);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const setActiveDiffSession = useDiffStore((state) => state.setActiveSession);
  const setDiffSnapshot = useDiffStore((state) => state.setDiffSnapshot);

  const presence = useChatStore((state) => state.presence);
  const messages = useChatStore((state) => state.messages);
  const setPresence = useChatStore((state) => state.setPresence);
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
  const addFileChanges = useChatStore((state) => state.addFileChanges);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    setActiveDiffSession(activeSessionId);
  }, [activeSessionId, setActiveDiffSession]);

  const refreshCodexSessions = useCallback(async () => {
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

    if (
      !nextActiveProjectId ||
      !mappedProjects.some((project) => project.id === nextActiveProjectId)
    ) {
      nextActiveProjectId = mappedProjects[0]?.id || null;
    }

    if (nextActiveProjectId) {
      const activeProject =
        mappedProjects.find((project) => project.id === nextActiveProjectId) ||
        null;
      const hasActiveSession =
        !!nextActiveSessionId &&
        !!activeProject?.sessions.some(
          (session) => session.id === nextActiveSessionId,
        );
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
      const message = payload as {
        method?: string;
        params?: {
          delta?: string;
          textDelta?: string;
          chunk?: string;
          message?: string;
          id?: string;
          threadId?: string;
          turnId?: string;
          itemId?: string;
          call_id?: string;
          command?: string;
          cmd?: string;
          raw_command?: string;
          rawCommand?: string;
          cwd?: string;
          working_directory?: string;
          status?: string;
          phase?: string;
          exitCode?: number;
          exit_code?: number;
          output?: string;
          durationMs?: number;
          duration_ms?: number;
          diff?: string;
          msg?: any;
        };
      };

      console.log("[mobile][message]", message.method, message.params);

      const params = message.params;
      const eventPayload = params?.msg || params;

      const resolveItemId = () =>
        String(
          eventPayload?.itemId ||
            eventPayload?.item_id ||
            eventPayload?.call_id ||
            eventPayload?.callId ||
            "",
        );

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

      // Handle message streaming
      if (message.method === "message/stream") {
        const id =
          params?.id || assistantMessageId || `assistant-${Date.now()}`;
        setAssistantMessageId(id);
        appendAssistantDelta(id, params?.delta || "");
      }

      // Handle message completion
      if (message.method === "message/complete") {
        const id = params?.id || assistantMessageId;
        if (id) {
          completeAssistantMessage(id);
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

      if (message.method === "codex/event/agent_message") {
        const text = eventPayload?.message || eventPayload?.text || "";
        if (text) {
          const id =
            String(eventPayload?.itemId || eventPayload?.id || "").trim() ||
            `assistant-${Date.now()}`;
          appendAssistantDelta(id, text);
          completeAssistantMessage(id);
          setAssistantMessageId(id);
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
      if (message.method === "turn/diff/updated" && message.params?.diff) {
        const diff = params?.diff || "";
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
      onPresence();
      onError();
      onReady();
      onMessage();
    };
  }, [
    assistantMessageId,
    appendAssistantDelta,
    completeAssistantMessage,
    addCommandExecution,
    upsertSystemMessage,
    updateCommandExecution,
    addFileChanges,
    activeSessionId,
    refreshCodexSessions,
    setDiffSnapshot,
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

  async function send(text: string) {
    if (!text.trim()) {
      return;
    }

    const messageId = addUserMessage(text);
    setAssistantMessageId(null);

    try {
      await relayService.sendJson(
        buildRequest("message/send", {
          content: text,
        }),
      );
      updateMessageDeliveryState(messageId, "sent");
    } catch (error) {
      console.error("[mobile][send] Failed to send message", error);
      updateMessageDeliveryState(messageId, "failed");
    }
  }

  return (
    <ProjectSidebar
      isOpen={sidebarOpen}
      onOpen={() => setSidebarOpen(true)}
      onClose={() => setSidebarOpen(false)}
      onProjectSelect={(projectId) => {
        console.log("[mobile][sidebar] project selected", { projectId });
      }}
      onSessionSelect={(projectId, sessionId) => {
        console.log("[mobile][sidebar] session selected", {
          projectId,
          sessionId,
        });
        setSessionLoadTick((value) => value + 1);
      }}
    >
      <View
        style={StyleSheet.flatten([
          styles.container,
          { backgroundColor: theme.background },
        ])}
      >
        <SessionTranscriptLoader
          sessionRef={activeSessionId}
          loadTick={sessionLoadTick}
        />

        <View style={styles.headerBlock}>
          <View style={styles.header}>
            <Pressable
              onPress={() => setSidebarOpen(true)}
              style={[
                styles.sessionButton,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.backgroundSelected,
                },
              ]}
              accessibilityLabel="Open sidebar"
            >
              <MenuIcon size={16} color={theme.text} />
            </Pressable>
            <Text style={[styles.title, { color: theme.text }]}>Chat</Text>
            <View style={styles.headerIcons}>
              <Link href="/explore" asChild>
                <Pressable
                  style={StyleSheet.flatten([
                    styles.headerIconButton,
                    {
                      backgroundColor: theme.backgroundElement,
                      borderColor: theme.backgroundSelected,
                    },
                  ])}
                  accessibilityRole="link"
                  accessibilityLabel="Open git screen"
                  hitSlop={8}
                >
                  <GitCommitIcon size={20} color={theme.text} />
                </Pressable>
              </Link>
              <Link href="/diff" asChild>
                <Pressable
                  style={StyleSheet.flatten([
                    styles.headerIconButton,
                    {
                      backgroundColor: theme.backgroundElement,
                      borderColor: theme.backgroundSelected,
                    },
                  ])}
                  accessibilityRole="link"
                  accessibilityLabel="Open diff panel"
                  hitSlop={8}
                >
                  <CodeDiffIcon size={20} color={theme.text} />
                </Pressable>
              </Link>
            </View>
          </View>
          <View style={styles.presenceRow}>
            <PresenceIndicator status={presence} />
          </View>
        </View>

        <ScrollView
          style={styles.messages}
          contentContainerStyle={styles.messageContent}
        >
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              role={message.role}
              text={message.text}
              streaming={message.isStreaming}
              kind={message.kind}
              deliveryState={message.deliveryState}
              commandExecution={message.commandExecution}
              fileChanges={message.fileChanges}
            />
          ))}
        </ScrollView>

        <PromptInput onSend={send} />
      </View>
    </ProjectSidebar>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 48,
    gap: 10,
  },
  headerBlock: {
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  headerIcons: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  presenceRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  headerIconButton: {
    minWidth: 36,
    minHeight: 36,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sessionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
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
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 20,
  },
});
