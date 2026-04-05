import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { FontFamilies } from "@/constants/fonts";
import { DropdownMenu, DropdownOption } from "./ui/dropdown-menu";
import { CodexIcon } from "./icons/Icon";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";

interface EmptyChatStateProps {
  projectName?: string;
  projects?: { id: string; name: string }[];
  onProjectSelect?: (projectId: string) => void;
}

export function EmptyChatState({
  projectName = "codex-app",
  projects = [],
  onProjectSelect,
}: EmptyChatStateProps) {
  const theme = useTheme();

  const options: DropdownOption[] = projects.map((p) => ({
    label: p.name,
    value: p.id,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <CodexIcon size={110} color={theme.text} />
        </View>

        <Text style={[styles.title, { color: theme.text }]}>Let's build</Text>

        <DropdownMenu
          label={projectName}
          options={options}
          onSelect={(opt) => onProjectSelect?.(opt.value)}
          style={styles.dropdown}
          labelStyle={styles.dropdownLabel}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 40,
  },
  content: {
    alignItems: "center",
    gap: 12,
  },
  iconContainer: {
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: "600",
    letterSpacing: -0.5,
    fontFamily: FontFamilies.display.spaceGrotesk,
  },
  dropdown: {
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingVertical: 0,
    minHeight: 0,
  },
  dropdownLabel: {
    fontSize: 24,
    fontWeight: "500",
    color: "#B0B4BA",
    fontFamily: FontFamilies.normal.ibmPlexSans,
  },
});
