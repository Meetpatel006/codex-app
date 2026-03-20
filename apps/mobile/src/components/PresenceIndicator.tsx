import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  status: "online" | "offline" | "connecting";
};

const STATUS_COLOR: Record<Props["status"], string> = {
  online: "#2f8f3a",
  offline: "#8f3434",
  connecting: "#8f7a2f",
};

export function PresenceIndicator({ status }: Props) {
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: STATUS_COLOR[status] }]} />
      <Text style={styles.text}>Desktop {status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 99,
  },
  text: {
    color: "#d0d0d0",
    fontSize: 12,
    textTransform: "capitalize",
  },
});
