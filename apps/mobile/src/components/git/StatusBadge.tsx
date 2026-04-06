import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/hooks/use-theme";

type StatusBadgeProps = {
  status: string;
  position?: "index" | "worktree" | "untracked";
};

export function StatusBadge({
  status,
  position = "untracked",
}: StatusBadgeProps) {
  const theme = useTheme();
  const displayChar = getDisplayChar(status, position);
  const color = getStatusColor(displayChar, theme);

  return (
    <View style={[styles.badge, { backgroundColor: color + "22" }]}>
      <Text style={[styles.badgeText, { color }]}>{displayChar}</Text>
    </View>
  );
}

function getDisplayChar(status: string, position: string): string {
  if (status === "??" || status === "?") return "?";
  if (position === "index") return status[0] || "?";
  if (position === "worktree") return status[1] || "?";
  return status[0] || "?";
}

function getStatusColor(char: string, theme: any): string {
  switch (char) {
    case "A":
      return theme.gitAdded;
    case "M":
      return theme.gitModified;
    case "D":
      return theme.gitDeleted;
    case "R":
      return theme.gitInfo;
    case "C":
      return "#a855f7";
    case "U":
      return theme.gitDeleted;
    case "?":
      return theme.textSecondary;
    default:
      return theme.gitModified;
  }
}

const styles = StyleSheet.create({
  badge: {
    width: 18,
    height: 18,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: "monospace",
    lineHeight: 14,
    fontWeight: "500",
  },
});
