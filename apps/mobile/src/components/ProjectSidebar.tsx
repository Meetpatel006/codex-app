import React, { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { SymbolView } from "expo-symbols";
import { useSessionStore } from "@/store/session";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolation,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { useTheme } from "@/hooks/use-theme";

import {
  FolderIcon,
  FolderOpenIcon,
  SettingsIcon,
  SortAZIcon,
  SortZAIcon,
} from "./icons/Icon";

interface ProjectSidebarProps {
  isOpen: boolean;
  gesturesEnabled?: boolean;
  onOpen?: () => void;
  onClose: () => void;
  onNewChat?: () => void;
  onProjectSelect: (projectId: string) => void;
  onSessionSelect: (projectId: string, sessionId: string) => void;
  usageItems?: SidebarUsageItem[];
  usageHint?: string;
  usageEmptyText?: string;
  children?: React.ReactNode;
}

type ExpandedState = Record<string, boolean>;

export type SidebarUsageItem = {
  id: string;
  label: string;
  percent: number;
  valueText?: string;
};

export const ProjectSidebar: React.FC<ProjectSidebarProps> = ({
  isOpen,
  gesturesEnabled = true,
  onOpen,
  onClose,
  onNewChat,
  onProjectSelect,
  onSessionSelect,
  usageItems,
  usageHint,
  usageEmptyText,
  children,
}) => {
  const colors = useTheme();
  const projects = useSessionStore((state) => state.projects);
  const activeProjectId = useSessionStore((state) => state.activeProjectId);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setActiveProject = useSessionStore((state) => state.setActiveProject);
  const updateProjectLastActive = useSessionStore(
    (state) => state.updateProjectLastActive,
  );

  const [expandedByProject, setExpandedByProject] = useState<ExpandedState>({});
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const screenWidth = Dimensions.get("window").width;
  const sidebarWidth = screenWidth;
  const isDrawerOpen = useSharedValue(false);
  const translateX = useSharedValue(-sidebarWidth);

  useEffect(() => {
    if (isOpen !== isDrawerOpen.value) {
      if (isOpen) {
        translateX.value = withTiming(0, {
          duration: 300,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        });
        isDrawerOpen.value = true;
      } else {
        translateX.value = withTiming(-sidebarWidth, {
          duration: 250,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        });
        isDrawerOpen.value = false;
      }
    }
  }, [isOpen, sidebarWidth, translateX, isDrawerOpen]);

  const handleOpenEvent = () => {
    if (onOpen) onOpen();
  };

  const handleCloseEvent = () => {
    onClose();
  };

  const panGesture = Gesture.Pan()
    .enabled(gesturesEnabled)
    // Require intentional horizontal movement to respect vertical scrolling in children
    .activeOffsetX([-20, 20])
    .onUpdate((event) => {
      const newX =
        event.translationX + (isDrawerOpen.value ? 0 : -sidebarWidth);
      translateX.value = Math.min(0, Math.max(-sidebarWidth, newX));
    })
    .onEnd((event) => {
      if (
        event.velocityX > 500 ||
        (event.translationX > sidebarWidth / 2 && !isDrawerOpen.value)
      ) {
        translateX.value = withTiming(0, {
          duration: 300,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        });
        isDrawerOpen.value = true;
        runOnJS(handleOpenEvent)();
      } else if (
        event.velocityX < -500 ||
        (event.translationX < -sidebarWidth / 2 && isDrawerOpen.value)
      ) {
        translateX.value = withTiming(-sidebarWidth, {
          duration: 250,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        });
        isDrawerOpen.value = false;
        runOnJS(handleCloseEvent)();
      } else {
        if (isDrawerOpen.value) {
          translateX.value = withTiming(0, {
            duration: 300,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          });
          runOnJS(handleOpenEvent)();
        } else {
          translateX.value = withTiming(-sidebarWidth, {
            duration: 250,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          });
          runOnJS(handleCloseEvent)();
        }
      }
    });

  const drawerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-sidebarWidth, 0],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    pointerEvents: translateX.value === -sidebarWidth ? "none" : "auto",
  }));

  const defaultExpandedProjectId = useMemo(() => {
    if (activeProjectId) {
      return activeProjectId;
    }
    return projects[0]?.id || "";
  }, [activeProjectId, projects]);

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedByProject((current) => {
      const currentlyExpanded = isProjectExpanded(
        current,
        projectId,
        defaultExpandedProjectId,
      );
      return {
        ...current,
        [projectId]: !currentlyExpanded,
      };
    });
  };

  const handleSessionPress = (projectId: string, sessionId: string) => {
    setActiveProject(projectId); // Mark as active to keep expanded when reopened
    setExpandedByProject((curr) => ({ ...curr, [projectId]: true })); // Explicit expansion
    updateProjectLastActive(projectId, sessionId);
    onSessionSelect(projectId, sessionId);
    onClose();
  };

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      if (sortDirection === "asc") return a.name.localeCompare(b.name);
      return b.name.localeCompare(a.name);
    });
  }, [projects, sortDirection]);

  const normalizedUsageItems = useMemo(() => {
    if (!Array.isArray(usageItems) || usageItems.length === 0) {
      return [];
    }

    return usageItems
      .map((item) => {
        const normalizedPercent = Number.isFinite(item.percent)
          ? Math.max(0, Math.min(100, item.percent))
          : 0;
        const roundedPercent = Math.round(normalizedPercent);
        return {
          ...item,
          percent: normalizedPercent,
          valueText: item.valueText || `${roundedPercent}%`,
        };
      })
      .slice(0, 3);
  }, [usageItems]);

  const isDark = colors.background === "#000000";

  const themedStyles = useMemo(
    () => createStyles(colors, isDark),
    [colors, isDark],
  );

  const overlayContent = (
    <>
      <Animated.View style={[themedStyles.overlay, overlayAnimatedStyle]}>
        <Pressable
          style={themedStyles.overlayPressable}
          onPress={() => {
            isDrawerOpen.value = false;
            translateX.value = withTiming(-sidebarWidth, {
              duration: 250,
              easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            });
            onClose();
          }}
        />
      </Animated.View>

      <Animated.View
        style={[
          themedStyles.sidebarWrapper,
          { width: sidebarWidth },
          drawerAnimatedStyle,
        ]}
      >
        <View
          style={[
            themedStyles.container,
            { backgroundColor: colors.background },
          ]}
        >
          <SafeAreaView
            style={themedStyles.safeArea}
            edges={["top", "left", "bottom"]}
          >
            <LinearGradient
              colors={[colors.background, colors.background, "transparent"]}
              locations={[0, 0.6, 1]}
              style={themedStyles.headerBlock}
            >
              <View style={themedStyles.header}>
                <Text style={themedStyles.logoText}>Projects</Text>
                <View style={themedStyles.headerActions}>
                  <View style={themedStyles.actionPill}>
                    <Pressable
                      style={({ pressed }) => [
                        themedStyles.pillButton,
                        pressed && themedStyles.pressed,
                      ]}
                      onPress={() =>
                        setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
                      }
                    >
                      {sortDirection === "asc" ? (
                        <SortAZIcon color={colors.text} size={22} />
                      ) : (
                        <SortZAIcon color={colors.text} size={22} />
                      )}
                    </Pressable>

                    <View style={themedStyles.pillSeparator} />

                    <Pressable
                      style={({ pressed }) => [
                        themedStyles.pillButton,
                        pressed && themedStyles.pressed,
                      ]}
                      onPress={() => {
                        if (onNewChat) {
                          onNewChat();
                          onClose();
                        }
                      }}
                    >
                      <SymbolView
                        name={{
                          ios: "square.and.pencil",
                          android: "edit_square",
                        }}
                        tintColor={colors.text}
                        size={22}
                      />
                    </Pressable>

                    <View style={themedStyles.pillSeparator} />

                    <Pressable
                      style={({ pressed }) => [
                        themedStyles.pillButton,
                        pressed && themedStyles.pressed,
                      ]}
                      onPress={() => {}}
                    >
                      <SettingsIcon color={colors.text} size={22} />
                    </Pressable>
                  </View>
                </View>
              </View>
            </LinearGradient>

            <ScrollView
              style={themedStyles.projectScroll}
              contentContainerStyle={themedStyles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {sortedProjects.map((project) => {
                const expanded = isProjectExpanded(
                  expandedByProject,
                  project.id,
                  defaultExpandedProjectId,
                );

                return (
                  <View key={project.id} style={themedStyles.projectItemWrap}>
                    <Pressable
                      onPress={() => {
                        setActiveProject(project.id);
                        onProjectSelect(project.id);
                        toggleProjectExpanded(project.id);
                      }}
                      style={({ pressed }) => [
                        themedStyles.menuItem,
                        activeProjectId === project.id &&
                          themedStyles.menuItemActive,
                        expanded && themedStyles.menuItemExpanded,
                        pressed && themedStyles.menuItemPressed,
                      ]}
                    >
                      <View
                        style={[
                          themedStyles.folderShell,
                          expanded && themedStyles.folderShellExpanded,
                        ]}
                      >
                        {expanded ? (
                          <FolderOpenIcon
                            size={18}
                            color={
                              activeProjectId === project.id
                                ? colors.text
                                : colors.textSecondary
                            }
                          />
                        ) : (
                          <FolderIcon
                            size={18}
                            color={
                              activeProjectId === project.id
                                ? colors.text
                                : colors.textSecondary
                            }
                          />
                        )}
                      </View>

                      <View style={themedStyles.menuItemMeta}>
                        <Text
                          style={themedStyles.menuItemText}
                          numberOfLines={1}
                        >
                          {project.name}
                        </Text>
                        <Text
                          style={themedStyles.menuItemSubText}
                          numberOfLines={1}
                        >
                          {project.sessions.length} chat
                          {project.sessions.length === 1 ? "" : "s"}
                        </Text>
                      </View>

                      <View style={themedStyles.chevronShell}>
                        <SymbolView
                          name={{
                            ios: expanded ? "chevron.down" : "chevron.right",
                            android: expanded ? "expand_more" : "chevron_right",
                            web: expanded ? "expand_more" : "chevron_right",
                          }}
                          tintColor={colors.textSecondary}
                          size={14}
                          style={themedStyles.chevron}
                        />
                      </View>
                    </Pressable>

                    {expanded && (
                      <View style={themedStyles.chatList}>
                        <View style={themedStyles.chatItems}>
                          {project.sessions.length === 0 ? (
                            <Text style={themedStyles.emptyChatText}>
                              No chats yet
                            </Text>
                          ) : (
                            project.sessions
                              .slice()
                              .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
                              .map((session) => (
                                <Pressable
                                  key={session.id}
                                  onPress={() =>
                                    handleSessionPress(project.id, session.id)
                                  }
                                  style={({ pressed }) => [
                                    themedStyles.chatItem,
                                    activeSessionId === session.id &&
                                      themedStyles.chatItemActive,
                                    pressed && themedStyles.chatItemPressed,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      themedStyles.chatItemText,
                                      activeSessionId === session.id &&
                                        themedStyles.chatItemTextActive,
                                    ]}
                                    numberOfLines={1}
                                  >
                                    {session.name}
                                  </Text>
                                </Pressable>
                              ))
                          )}
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            <View style={themedStyles.footer}>
              <LinearGradient
                colors={["transparent", colors.background, colors.background]}
                locations={[0, 1, 1]}
                style={themedStyles.gradientContainer}
              >
                <View style={themedStyles.usageContent}>
                  <View style={themedStyles.usageHeader}>
                    <Text style={themedStyles.usageTitle}>Usage</Text>
                    <Text style={themedStyles.usageHint}>
                      {usageHint || "Refreshes automatically"}
                    </Text>
                  </View>

                  {normalizedUsageItems.length > 0 ? (
                    <View style={themedStyles.limitsContainer}>
                      {normalizedUsageItems.map((item) => (
                        <View key={item.id} style={themedStyles.limitItem}>
                          <View style={themedStyles.limitHeader}>
                            <Text style={themedStyles.limitLabel}>
                              {item.label}
                            </Text>
                            <Text style={themedStyles.limitValue}>
                              {item.valueText}
                            </Text>
                          </View>
                          <View style={themedStyles.progressBarBg}>
                            <View
                              style={[
                                themedStyles.progressBarFill,
                                { width: `${item.percent}%` },
                              ]}
                            />
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={themedStyles.usageEmptyText}>
                      {usageEmptyText || "Usage data unavailable"}
                    </Text>
                  )}
                </View>
              </LinearGradient>
            </View>
          </SafeAreaView>
        </View>
      </Animated.View>
    </>
  );

  return (
    <GestureDetector gesture={panGesture}>
      <View style={themedStyles.innerWrapper}>
        {children && <View style={themedStyles.content}>{children}</View>}
        {overlayContent}
      </View>
    </GestureDetector>
  );
};

function isProjectExpanded(
  state: ExpandedState,
  projectId: string,
  defaultExpandedProjectId: string,
) {
  if (typeof state[projectId] === "boolean") {
    return state[projectId];
  }
  return projectId === defaultExpandedProjectId;
}

const Spacing = {
  two: 8,
  three: 12,
  four: 16,
  five: 20,
};

const createStyles = (colors: ReturnType<typeof useTheme>, isDark: boolean) =>
  StyleSheet.create({
    wrapper: {
      flex: 1,
    },
    innerWrapper: {
      flex: 1,
    },
    content: {
      flex: 1,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0, 0, 0, 0.4)",
      zIndex: 99,
    },
    overlayPressable: {
      flex: 1,
    },
    sidebarWrapper: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      zIndex: 100,
      backgroundColor: colors.background,
      ...Platform.select({
        ios: {
          shadowColor: "#000",
          shadowOffset: { width: 4, height: 0 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
        },
        android: {
          elevation: 8,
        },
      }),
    },
    container: {
      flex: 1,
    },
    safeArea: {
      flex: 1,
    },
    headerBlock: {
      position: "absolute",
      top: 35,
      left: 0,
      right: 0,
      zIndex: 10,
      paddingBottom: 24,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: Spacing.four,
      minHeight: 55,
      gap: 12,
    },
    logoText: {
      fontSize: 28,
      lineHeight: 32,
      fontWeight: "700",
      color: colors.text,
      letterSpacing: -0.8,
    },
    countPill: {
      minWidth: 28,
      height: 24,
      paddingHorizontal: 8,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#ECEDEF",
      borderWidth: 1,
      borderColor: isDark ? "rgba(255, 255, 255, 0.12)" : "#D8DADF",
    },
    countPillText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "700",
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
    },
    actionPill: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.backgroundElement,
      borderColor: colors.backgroundSelected,
      borderWidth: 1,
      borderRadius: 24,
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
      backgroundColor: colors.backgroundSelected,
    },
    sectionRow: {
      paddingHorizontal: Spacing.four,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sectionLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: "600",
      letterSpacing: 0.2,
      textTransform: "uppercase",
    },
    sectionMeta: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: "500",
    },
    projectScroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: Spacing.two,
      paddingTop: 60, // Account for absolute header
      paddingBottom: 40,
    },
    projectItemWrap: {
      borderRadius: 14,
      overflow: "hidden",
      marginBottom: 10,
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 62,
      paddingVertical: 11,
      paddingHorizontal: 12,
      borderRadius: 14,
    },
    menuItemExpanded: {
      paddingBottom: 8,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    },
    menuItemActive: {
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#ECEEF2",
    },
    menuItemPressed: {
      opacity: 0.82,
    },
    folderShell: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "#E9EAED",
      alignItems: "center",
      justifyContent: "center",
    },
    folderShellExpanded: {
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#DDDFE3",
    },
    menuItemMeta: {
      marginLeft: 12,
      flex: 1,
      gap: 2,
    },
    menuItemText: {
      fontSize: 17,
      color: colors.text,
      fontWeight: "600",
    },
    menuItemSubText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: "500",
    },
    chevronShell: {
      width: 24,
      height: 24,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
    },
    chevron: {
      marginLeft: 0,
    },
    chatList: {
      paddingRight: 12,
      paddingBottom: 12,
      paddingLeft: 12,
      paddingTop: 2,
      borderBottomLeftRadius: 14,
      borderBottomRightRadius: 14,
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#ECEEF2",
    },
    chatItems: {
      gap: 6,
    },
    chatItem: {
      minHeight: 36,
      borderRadius: 10,
      paddingHorizontal: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: "transparent",
    },
    chatItemActive: {
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#E2E5EA",
    },
    chatItemPressed: {
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.06)" : "#E8EBF0",
    },
    chatItemText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: "500",
      flex: 1,
    },
    chatItemTextActive: {
      color: colors.text,
      fontWeight: "600",
    },
    emptyChatText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: "500",
      paddingVertical: 6,
      paddingHorizontal: 10,
    },
    footer: {
      paddingHorizontal: Spacing.four,
      paddingBottom: Spacing.five,
      paddingTop: 10,
      marginTop: "auto",
    },
    gradientContainer: {
      width: "100%",
    },
    usageContent: {
      paddingTop: 8,
      gap: 12,
    },
    usageHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    usageTitle: {
      fontSize: 15,
      color: colors.text,
      fontWeight: "700",
    },
    usageHint: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: "500",
    },
    usageEmptyText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: "500",
    },
    limitsContainer: {
      gap: 12,
    },
    limitItem: {
      gap: 6,
    },
    limitHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    limitLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    limitValue: {
      fontSize: 13,
      color: colors.text,
      fontWeight: "700",
    },
    progressBarBg: {
      height: 6,
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#DDE1E7",
      borderRadius: 6,
      overflow: "hidden",
    },
    progressBarFill: {
      height: "100%",
      backgroundColor: colors.text,
      borderRadius: 6,
    },
    pressed: {
      opacity: 0.72,
    },
  });
