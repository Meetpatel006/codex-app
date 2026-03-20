import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  title: string;
  onApprove: () => void;
  onReject: () => void;
};

export function ApprovalCard({ title, onApprove, onReject }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.actions}>
        <Pressable onPress={onReject} style={[styles.button, styles.rejectButton]}>
          <Text style={styles.buttonText}>Reject</Text>
        </Pressable>
        <Pressable onPress={onApprove} style={[styles.button, styles.approveButton]}>
          <Text style={styles.buttonText}>Approve</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 10,
    padding: 12,
    backgroundColor: "#171717",
    gap: 10,
  },
  title: {
    color: "#e8e8e8",
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  rejectButton: {
    backgroundColor: "#5a2c2c",
  },
  approveButton: {
    backgroundColor: "#2f5f2f",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
});
