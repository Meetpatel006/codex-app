import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ProjectSidebar } from "@/components/ProjectSidebar";
import { buildRequest } from "@/services/jsonrpc";
import { relayService } from "@/services/relay";

export default function GitScreen() {
  const [commitMessage, setCommitMessage] = useState("WIP: mobile commit");
  const [output, setOutput] = useState("Run git/status to load repository state.");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = relayService.on("message", (payload) => {
      setOutput(JSON.stringify(payload, null, 2));
    });
    return () => {
      unsubscribe();
    };
  }, []);

  async function sendGit(method: string, params: Record<string, unknown> = {}) {
    await relayService.sendJson(buildRequest(method, params, `${method}-${Date.now()}`));
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
        <Text style={styles.title}>Git</Text>
      </View>

      <View style={styles.row}>
        <Pressable style={styles.button} onPress={() => void sendGit("git/status")}>
          <Text style={styles.buttonText}>Status</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => void sendGit("git/pull")}>
          <Text style={styles.buttonText}>Pull</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => void sendGit("git/push")}>
          <Text style={styles.buttonText}>Push</Text>
        </Pressable>
      </View>

      <View style={styles.row}>
        <Pressable style={styles.button} onPress={() => void sendGit("git/stash")}>
          <Text style={styles.buttonText}>Stash</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => void sendGit("git/stashPop")}>
          <Text style={styles.buttonText}>Stash Pop</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => void sendGit("git/branches")}>
          <Text style={styles.buttonText}>Branches</Text>
        </Pressable>
      </View>

      <View style={styles.commitRow}>
        <TextInput
          value={commitMessage}
          onChangeText={setCommitMessage}
          style={styles.input}
          placeholder="Commit message"
          placeholderTextColor="#7d7d7d"
        />
        <Pressable
          style={styles.button}
          onPress={() =>
            void sendGit("git/commit", {
              message: commitMessage,
            })
          }>
          <Text style={styles.buttonText}>Commit</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.outputBox}>
        <Text style={styles.outputText}>{output}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b0b0b",
    paddingHorizontal: 12,
    paddingVertical: 12,
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
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  commitRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  input: {
    flex: 1,
    borderRadius: 8,
    borderColor: "#333",
    borderWidth: 1,
    color: "#eee",
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#171717",
  },
  button: {
    borderRadius: 8,
    backgroundColor: "#2f4f8f",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
  outputBox: {
    flex: 1,
    borderRadius: 8,
    borderColor: "#333",
    borderWidth: 1,
    backgroundColor: "#111",
    padding: 10,
  },
  outputText: {
    color: "#d9d9d9",
    fontFamily: "monospace",
    fontSize: 12,
  },
});
