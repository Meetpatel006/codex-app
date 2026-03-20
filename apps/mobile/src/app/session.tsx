import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useChatStore } from "@/store/chat";
import { useSessionStore } from "@/store/session";

export default function SessionConnectionScreen() {
  const router = useRouter();
  const [sessionIdInput, setSessionIdInput] = useState("");
  const [notice, setNotice] = useState("");

  const load = useSessionStore((state) => state.load);
  const pairing = useSessionStore((state) => state.pairing);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setPairing = useSessionStore((state) => state.setPairing);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);

  const presence = useChatStore((state) => state.presence);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (pairing?.sessionId) {
      setSessionIdInput(pairing.sessionId);
      return;
    }

    if (activeSessionId) {
      setSessionIdInput(activeSessionId);
    }
  }, [pairing?.sessionId, activeSessionId]);

  async function onSaveSessionId() {
    const nextSessionId = sessionIdInput.trim();
    if (!nextSessionId) {
      setNotice("Session ID is required.");
      return;
    }

    await setActiveSession(nextSessionId);

    if (pairing) {
      await setPairing({
        ...pairing,
        sessionId: nextSessionId,
      });
      setNotice("Session ID saved.");
      return;
    }

    setNotice("Session ID saved locally. Pair device to connect.");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Session Connection</Text>

      {!pairing && (
        <View style={styles.card}>
          <Text style={styles.label}>Pairing Required</Text>
          <Text style={styles.value}>You can save Session ID now, but pairing is required to connect.</Text>
          <Pressable style={styles.pairFirstButton} onPress={() => router.replace("/pair")}>
            <Text style={styles.pairFirstButtonText}>Pair First</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.label}>Status</Text>
        <Text style={[styles.value, presence === "online" ? styles.online : styles.offline]}>
          {presence.toUpperCase()}
        </Text>

        <Text style={styles.label}>Session ID</Text>
        <TextInput
          value={sessionIdInput}
          onChangeText={setSessionIdInput}
          placeholder="Enter session ID"
          placeholderTextColor="#777"
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.secondaryButton} onPress={onSaveSessionId}>
          <Text style={styles.secondaryButtonText}>Save Session ID</Text>
        </Pressable>

        <Pressable style={styles.primaryButton} onPress={() => router.push("/")}>
          <Text style={styles.primaryButtonText}>Open Chat</Text>
        </Pressable>
      </View>

      <Text style={styles.helpText}>Update session ID here and return to Chat.</Text>
      {!!notice && <Text style={styles.notice}>{notice}</Text>}
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
  title: {
    color: "#f0f0f0",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 6,
  },
  card: {
    borderWidth: 1,
    borderColor: "#2f2f2f",
    borderRadius: 10,
    backgroundColor: "#141414",
    padding: 12,
    gap: 6,
  },
  label: {
    color: "#9f9f9f",
    fontSize: 12,
  },
  value: {
    color: "#f0f0f0",
    fontSize: 14,
    marginBottom: 6,
  },
  input: {
    borderRadius: 8,
    borderColor: "#333",
    borderWidth: 1,
    color: "#eee",
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#171717",
  },
  online: {
    color: "#6fdc8c",
    fontWeight: "700",
  },
  offline: {
    color: "#ff9d9d",
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: "#2d5f2d",
    paddingVertical: 11,
    alignItems: "center",
  },
  pairFirstButton: {
    borderRadius: 8,
    backgroundColor: "#2d5f2d",
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: "#1f1f1f",
    borderWidth: 1,
    borderColor: "#3a3a3a",
    paddingVertical: 11,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  pairFirstButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  secondaryButtonText: {
    color: "#f0f0f0",
    fontWeight: "600",
  },
  helpText: {
    color: "#a5a5a5",
    fontSize: 12,
  },
  notice: {
    color: "#b9d5ff",
    fontSize: 12,
  },
});
