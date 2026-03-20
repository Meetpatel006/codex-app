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
      <View style={styles.header}>
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
    paddingTop: 12,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    color: "#f0f0f0",
    fontSize: 20,
    fontWeight: "700",
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
