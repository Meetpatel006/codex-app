import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { CommandExecutionCard } from "./CommandExecutionCard";
import type { CommandExecutionData } from "@/store/chat";
import { useTheme } from "@/hooks/use-theme";

type Props = {
  commands: CommandExecutionData[];
};

export function CommandExecutionGroup({ commands }: Props) {
  const colors = useTheme();
  const themedStyles = useMemo(() => createStyles(colors), [colors]);

  if (commands.length === 0) {
    return null;
  }

  return (
    <View style={themedStyles.group}>
      {commands.map((command, index) => (
        <View
          key={`${command.command}-${index}`}
          style={index > 0 ? themedStyles.divider : undefined}
        >
          <CommandExecutionCard {...command} />
        </View>
      ))}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    group: {
      width: "100%",
      alignSelf: "stretch",
      backgroundColor: colors.codeBackground,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.codeBorder,
      overflow: "hidden",
    },
    divider: {
      borderTopWidth: 1,
      borderTopColor: colors.codeBorder,
    },
  });

