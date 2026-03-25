import React from "react";
import { StyleSheet, View } from "react-native";
import { CommandExecutionCard } from "./CommandExecutionCard";
import type { CommandExecutionData } from "@/store/chat";

type Props = {
  commands: CommandExecutionData[];
};

export function CommandExecutionGroup({ commands }: Props) {
  if (commands.length === 0) {
    return null;
  }

  return (
    <View style={styles.group}>
      {commands.map((command, index) => (
        <View
          key={`${command.command}-${index}`}
          style={index > 0 ? styles.divider : undefined}
        >
          <CommandExecutionCard {...command} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    width: "100%",
    alignSelf: "stretch",
    backgroundColor: "#151515",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#222222",
    overflow: "hidden",
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: "#222222",
  },
});
