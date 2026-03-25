import React, { useState } from "react";
import { View, StyleSheet, type ViewStyle } from "react-native";
import { DropdownMenu, DropdownOption } from "./ui/dropdown-menu";
import { Spacing } from "@/constants/theme";
import {
  LaptopIcon,
  LaptopCloudIcon,
  ShieldIcon,
  BranchIcon,
} from "./icons/Icon";

const LOCAL_OPTIONS: DropdownOption[] = [
  { label: "Local", value: "local" },
  { label: "Cloud", value: "cloud" },
];

const SECURITY_OPTIONS: DropdownOption[] = [
  { label: "Supervised", value: "default" },
  { label: "Full access", value: "full" },
];

const BRANCH_OPTIONS: DropdownOption[] = [
  { label: "main", value: "main" },
  { label: "develop", value: "develop" },
];

type SelectorProps = {
  style?: ViewStyle;
};

export function LocalSelector({ style }: SelectorProps) {
  const [selected, setSelected] = useState(LOCAL_OPTIONS[0]);

  const IconComponent =
    selected.value === "cloud" ? LaptopCloudIcon : LaptopIcon;

  return (
    <DropdownMenu
      label={selected.label}
      icon={<IconComponent size={14} color="#888" />}
      options={LOCAL_OPTIONS}
      onSelect={setSelected}
      style={style}
    />
  );
}

export function SecuritySelector({ style }: SelectorProps) {
  const [selected, setSelected] = useState(SECURITY_OPTIONS[0]);

  return (
    <DropdownMenu
      label={selected.label}
      icon={<ShieldIcon size={14} color="#888" />}
      options={SECURITY_OPTIONS}
      onSelect={setSelected}
      style={style}
    />
  );
}

export function BranchSelector({ style }: SelectorProps) {
  const [selected, setSelected] = useState(BRANCH_OPTIONS[0]);

  return (
    <DropdownMenu
      label={selected.label}
      icon={<BranchIcon size={14} color="#888" />}
      options={BRANCH_OPTIONS}
      onSelect={setSelected}
      style={style}
    />
  );
}

export function PromptExtras() {
  return (
    <View style={styles.container}>
      <LocalSelector style={styles.sideItem} />
      <SecuritySelector style={styles.middleItem} />
      <BranchSelector style={styles.sideItem} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    marginTop: 12,
    paddingHorizontal: Spacing.one,
  },
  sideItem: {
    flex: 0.85,
  },
  middleItem: {
    flex: 1.3,
  },
});
