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
import {
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
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
  SortAZIcon,
  SortZAIcon,
} from "./icons/Icon";

interface ProjectSidebarProps {
  isOpen: boolean;
  gesturesEnabled?: boolean;
  onOpen?: () => void;
  onClose: () => void;
  onProjectSelect: (projectId: string) => void;
  onSessionSelect: (projectId: string, sessionId: string) => void;
  children?: React.ReactNode;
}

type ExpandedState = Record<string, boolean>;

export const ProjectSidebar: React.FC<ProjectSidebarProps> = ({
  isOpen,
  gesturesEnabled = true,
  onOpen,
  onClose,
  onProjectSelect,
  onSessionSelect,
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

  const themedStyles = useMemo(() => createStyles(colors), [colors]);

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
                <Text style={themedStyles.logoText}>Threads</Text>
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
                      }}
                    >
                      <SymbolView
                        name={{
                          ios: "gearshape",
                          android: "settings",
                        }}
                        tintColor={colors.text}
                        size={22}
                      />
                    </Pressable>
                  </View>
                </View>
              </View>
            </LinearGradient>

            <ScrollView contentContainerStyle={themedStyles.scrollContent}>
              {sortedProjects.map((project) => {
                const expanded = isProjectExpanded(
                  expandedByProject,
                  project.id,
                  defaultExpandedProjectId,
                );

                return (
                  <View key={project.id}>
                    <Pressable
                      onPress={() => {
                        setActiveProject(project.id);
                        onProjectSelect(project.id);
                        toggleProjectExpanded(project.id);
                      }}
                      style={({ pressed }) => [
                        themedStyles.menuItem,
                        pressed && {
                          backgroundColor: colors.backgroundElement,
                        },
                      ]}
                    >
                      {expanded ? (
                        <FolderOpenIcon
                          size={20}
                          color={colors.textSecondary}
                        />
                      ) : (
                        <FolderIcon size={20} color={colors.textSecondary} />
                      )}
                      <Text style={themedStyles.menuItemText} numberOfLines={1}>
                        {project.name}
                      </Text>
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
                    </Pressable>

                    {expanded && (
                      <View style={themedStyles.chatList}>
                        {project.sessions
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
                                activeSessionId === session.id && {
                                  backgroundColor: colors.backgroundSelected,
                                },
                                pressed && {
                                  backgroundColor: colors.backgroundElement,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  themedStyles.chatItemText,
                                  activeSessionId === session.id && {
                                    color: colors.text,
                                    fontWeight: "500",
                                  },
                                ]}
                                numberOfLines={1}
                              >
                                {session.name}
                              </Text>
                            </Pressable>
                          ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            <View style={themedStyles.footer}>


              <View style={themedStyles.limitsContainer}>
                <View style={themedStyles.limitItem}>
                  <View style={themedStyles.limitHeader}>
                    <Text style={themedStyles.limitLabel}>Monthly limit</Text>
                    <Text style={themedStyles.limitValue}>75%</Text>
                  </View>
                  <View style={themedStyles.progressBarBg}>
                    <View
                      style={[themedStyles.progressBarFill, { width: "75%" }]}
                    />
                  </View>
                </View>

                <View style={themedStyles.limitItem}>
                  <View style={themedStyles.limitHeader}>
                    <Text style={themedStyles.limitLabel}>Weekly limit</Text>
                    <Text style={themedStyles.limitValue}>40%</Text>
                  </View>
                  <View style={themedStyles.progressBarBg}>
                    <View
                      style={[themedStyles.progressBarFill, { width: "40%" }]}
                    />
                  </View>
                </View>
              </View>
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

const createStyles = (colors: ReturnType<typeof useTheme>) =>
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
      paddingTop: Platform.OS === "android" ? 5 : 5,
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
    logoText: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
      letterSpacing: -0.5,
      marginLeft: 4,
    },
    headerButton: {
      padding: 2,
    },
    scrollContent: {
      paddingHorizontal: Spacing.two,
      paddingTop: 60, // Account for absolute header
      paddingBottom: 40,
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: Spacing.three,
      borderRadius: 8,
      marginBottom: 4,
    },
    menuItemText: {
      marginLeft: Spacing.three,
      fontSize: 16,
      color: colors.text,
      fontWeight: "500",
      flex: 1,
    },
    chevron: {
      marginLeft: "auto",
    },
    chatList: {
      marginLeft: 12,
      marginBottom: Spacing.two,
    },
    chatItem: {
      paddingVertical: 8,
      paddingLeft: Spacing.four + 12,
      paddingRight: Spacing.two,
      borderRadius: 6,
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 2,
    },
    chatIconWrapper: {
      marginRight: 8,
      marginTop: 1,
    },
    chatItemText: {
      fontSize: 15,
      color: colors.textSecondary,
      fontWeight: "400",
      flex: 1,
    },
    footer: {
      paddingHorizontal: Spacing.four,
      paddingBottom: Spacing.five,
      marginTop: "auto",
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.backgroundElement,
      paddingTop: Spacing.four,
      gap: Spacing.four,
    },

    limitsContainer: {
      gap: Spacing.three,
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
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: "500",
    },
    limitValue: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    progressBarBg: {
      height: 4,
      backgroundColor: colors.backgroundElement,
      borderRadius: 2,
      overflow: "hidden",
    },
    progressBarFill: {
      height: "100%",
      backgroundColor: colors.text,
      borderRadius: 2,
    },
    pressed: {
      opacity: 0.7,
    },
  });
