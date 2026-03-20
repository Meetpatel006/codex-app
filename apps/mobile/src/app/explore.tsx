import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { buildRequest } from "@/services/jsonrpc";
import { relayService } from "@/services/relay";

export default function GitScreen() {
  const [commitMessage, setCommitMessage] = useState("WIP: mobile commit");
  const [output, setOutput] = useState("Run git/status to load repository state.");

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
      <Text style={styles.title}>Git</Text>

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
    padding: 12,
    gap: 10,
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
