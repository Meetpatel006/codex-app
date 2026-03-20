import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
};

export function MessageBubble({ role, text, streaming = false }: Props) {
  const isUser = role === "user";
  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}>
      <Text style={styles.text}>{text}{streaming ? " ..." : ""}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    maxWidth: "85%",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginVertical: 4,
  },
  userContainer: {
    alignSelf: "flex-end",
    backgroundColor: "#2f4f8f",
  },
  assistantContainer: {
    alignSelf: "flex-start",
    backgroundColor: "#222",
  },
  text: {
    color: "#f5f5f5",
    fontSize: 14,
    lineHeight: 20,
  },
});
