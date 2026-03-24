import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { DropdownMenu, DropdownOption } from "./ui/dropdown-menu";
import { Spacing } from "@/constants/theme";

const LOCAL_OPTIONS: DropdownOption[] = [
  { label: "Local", value: "local" },
  { label: "Cloud", value: "cloud" },
];

const SECURITY_OPTIONS: DropdownOption[] = [
  { label: "Default permissions", value: "default" },
  { label: "Full access", value: "full" },
  { label: "Read only", value: "read" },
];

const BRANCH_OPTIONS: DropdownOption[] = [
  { label: "main", value: "main" },
  { label: "develop", value: "develop" },
];

export function LocalSelector() {
  const [selected, setSelected] = useState(LOCAL_OPTIONS[0]);

  return (
    <DropdownMenu
      label={selected.label}
      icon={{
        ios: "laptopcomputer",
        android: "laptop",
        web: "laptop",
      }}
      options={LOCAL_OPTIONS}
      onSelect={setSelected}
    />
  );
}

export function SecuritySelector() {
  const [selected, setSelected] = useState(SECURITY_OPTIONS[0]);

  return (
    <DropdownMenu
      label={selected.label}
      icon={{
        ios: "shield.fill",
        android: "shield",
        web: "shield",
      }}
      options={SECURITY_OPTIONS}
      onSelect={setSelected}
    />
  );
}

export function BranchSelector() {
  const [selected, setSelected] = useState(BRANCH_OPTIONS[0]);

  return (
    <DropdownMenu
      label={selected.label}
      icon={{
        ios: "source.control",
        android: "account_tree",
        web: "account_tree",
      }}
      options={BRANCH_OPTIONS}
      onSelect={setSelected}
    />
  );
}

export function PromptExtras() {
  return (
    <View style={styles.container}>
      <View style={styles.leftGroup}>
        <LocalSelector />
        <SecuritySelector />
      </View>
      <BranchSelector />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingHorizontal: Spacing.one,
  },
  leftGroup: {
    flexDirection: "row",
    gap: 1,
  },
});
