import React from "react";
import { Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  MenuIcon,
  GitCommitIcon,
  CodeDiffIcon,
  QrCodeIcon,
} from "@/components/icons/Icon";
import { useTheme } from "@/hooks/use-theme";

type ChatHeaderProps = {
  onOpenSidebar: () => void;
  onOpenCommitSheet: () => void;
  onOpenDiffPanel: () => void;
  onOpenPairSheet: () => void;
};

export function ChatHeader({
  onOpenSidebar,
  onOpenCommitSheet,
  onOpenDiffPanel,
  onOpenPairSheet,
}: ChatHeaderProps) {
  const theme = useTheme();

  return (
    <LinearGradient
      colors={[theme.background, theme.background, "transparent"]}
      locations={[0, 0.1, 1]}
      style={styles.headerBlock}
    >
      <View style={styles.header}>
        <Pressable
          onPress={onOpenSidebar}
          style={[
            styles.sidebarButton,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.backgroundSelected,
            },
          ]}
          accessibilityLabel="Open sidebar"
          hitSlop={8}
        >
          <MenuIcon size={22} color={theme.text} />
        </Pressable>
        <View style={[styles.actionPill, { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}>
          <Pressable
            onPress={onOpenCommitSheet}
            style={styles.pillButton}
            accessibilityLabel="Open commit sheet"
            hitSlop={8}
          >
            <GitCommitIcon size={22} color={theme.text} />
          </Pressable>
          <View style={[styles.pillSeparator, { backgroundColor: theme.backgroundSelected }]} />
          <Pressable
            onPress={onOpenDiffPanel}
            style={styles.pillButton}
            accessibilityLabel="Open diff panel"
            hitSlop={8}
          >
            <CodeDiffIcon size={22} color={theme.text} />
          </Pressable>
          <View style={[styles.pillSeparator, { backgroundColor: theme.backgroundSelected }]} />
          <Pressable
            onPress={onOpenPairSheet}
            style={styles.pillButton}
            accessibilityLabel="Open pair device sheet"
            hitSlop={8}
          >
            <QrCodeIcon size={22} color={theme.text} />
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  headerBlock: {
    position: "absolute",
    top: 30,
    left: 0,
    right: 0,
    zIndex: 13,
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    minHeight: 44,
  },
  sidebarButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
  },
  pillButton: {
    width: 44,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  pillSeparator: {
    width: 1,
    height: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    flex: 1,
    minWidth: 0,
  },
});
