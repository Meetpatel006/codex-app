import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from "expo-router/ui";
import { SymbolView } from "expo-symbols";
import React, { useState } from "react";
import {
  Pressable,
  useColorScheme,
  View,
  StyleSheet,
  Text,
} from "react-native";

import { ExternalLink } from "./external-link";
import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";
import { ProjectSidebar } from "./ProjectSidebar";

import { Colors, MaxContentWidth, Spacing } from "@/constants/theme";

export default function AppTabs() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleProjectSelect = (projectId: string) => {
    console.log("Project selected:", projectId);
  };

  const handleSessionSelect = (projectId: string, sessionId: string) => {
    console.log("Session selected:", projectId, sessionId);
  };

  return (
    <>
      <ProjectSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onProjectSelect={handleProjectSelect}
        onSessionSelect={handleSessionSelect}
      />
      <Tabs>
        <TabSlot style={{ height: "100%" }} />
        <TabList asChild>
          <CustomTabList onMenuPress={() => setSidebarOpen(true)}>
            <TabTrigger name="home" href="/" asChild>
              <TabButton>Home</TabButton>
            </TabTrigger>
            <TabTrigger name="pair" href="/pair" asChild>
              <TabButton>Pair</TabButton>
            </TabTrigger>
          </CustomTabList>
        </TabList>
      </Tabs>
    </>
  );
}

export function TabButton({
  children,
  isFocused,
  ...props
}: TabTriggerSlotProps) {
  return (
    <Pressable
      {...props}
      style={({ pressed }) => [
        styles.tabButtonWrapper,
        pressed && styles.pressed,
      ]}
    >
      <ThemedView
        type={isFocused ? "backgroundSelected" : "backgroundElement"}
        style={styles.tabButtonView}
      >
        <ThemedText
          type={isFocused ? "smallBold" : "small"}
          themeColor={isFocused ? "text" : "textSecondary"}
          style={{ fontSize: isFocused ? 14 : 13 }}
        >
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(
  props: TabListProps & { onMenuPress?: () => void },
) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === "unspecified" ? "light" : scheme];

  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView type="backgroundElement" style={styles.innerContainer}>
        <Pressable onPress={props.onMenuPress} style={styles.menuButton}>
          <Text style={[styles.menuIcon, { color: colors.text }]}>☰</Text>
        </Pressable>

        <ThemedText type="smallBold" style={styles.brandText}>
          Expo Starter
        </ThemedText>

        {props.children}

        <ExternalLink href="https://docs.expo.dev" asChild>
          <Pressable style={styles.externalPressable}>
            <ThemedText type="link">Docs</ThemedText>
            <SymbolView
              tintColor={colors.text}
              name={{ ios: "arrow.up.right.square", web: "link" }}
              size={12}
            />
          </Pressable>
        </ExternalLink>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: "absolute",
    width: "100%",
    padding: Spacing.three,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    flexDirection: "row",
    alignItems: "center",
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  menuButton: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    marginRight: Spacing.two,
  },
  menuIcon: {
    fontSize: 18,
    fontWeight: "600",
  },
  brandText: {
    marginRight: "auto",
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonWrapper: {
    borderRadius: Spacing.three,
  },
  tabButtonView: {
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.three + 2,
    borderRadius: Spacing.three,
  },
  externalPressable: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.one,
    marginLeft: Spacing.three,
  },
});
