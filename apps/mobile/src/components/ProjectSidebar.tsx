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
import { SymbolView } from "expo-symbols";
import { useSessionStore } from "@/store/session";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  interpolate, 
  Extrapolation,
  Easing,
  runOnJS,
  useDerivedValue
} from "react-native-reanimated";

import { FolderIcon, FolderOpenIcon, SortAZIcon, SortZAIcon } from "./icons/Icon";

interface ProjectSidebarProps {
  isOpen: boolean;
  onOpen?: () => void;
  onClose: () => void;
  onProjectSelect: (projectId: string) => void;
  onSessionSelect: (projectId: string, sessionId: string) => void;
  children?: React.ReactNode;
}

type ExpandedState = Record<string, boolean>;

export const ProjectSidebar: React.FC<ProjectSidebarProps> = ({
  isOpen,
  onOpen,
  onClose,
  onProjectSelect,
  onSessionSelect,
  children
}) => {
  const projects = useSessionStore((state) => state.projects);
  const activeProjectId = useSessionStore((state) => state.activeProjectId);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setActiveProject = useSessionStore((state) => state.setActiveProject);
  const updateProjectLastActive = useSessionStore((state) => state.updateProjectLastActive);

  const [expandedByProject, setExpandedByProject] = useState<ExpandedState>({});
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  const screenWidth = Dimensions.get("window").width;
  const sidebarWidth = Math.min(296, screenWidth * 0.82);

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
    // Require intentional horizontal movement to respect vertical scrolling in children
    .activeOffsetX([-20, 20])
    // Allow edge swipes or swiping from anywhere if drawer is already open
    .onBegin((event) => {
      // If drawer is closed, only allow swipe from left edge
      if (!isDrawerOpen.value && event.x > 40) {
        // We can't cancel a gesture explicitly in onBegin this way, but we will block processing in onUpdate
      }
    })
    .onUpdate((event) => {
      // Enforce edge swipe when closed: if initial touch X was > 40, do not open
      if (!isDrawerOpen.value && event.x - event.translationX > 40) {
        return;
      }
      const newX = event.translationX + (isDrawerOpen.value ? 0 : -sidebarWidth);
      translateX.value = Math.min(0, Math.max(-sidebarWidth, newX));
    })
    .onEnd((event) => {
      if (!isDrawerOpen.value && event.x - event.translationX > 40) {
        return;
      }
      if (event.velocityX > 500 || (event.translationX > sidebarWidth / 2 && !isDrawerOpen.value)) {
        translateX.value = withTiming(0, { duration: 300, easing: Easing.bezier(0.25, 0.1, 0.25, 1) });
        isDrawerOpen.value = true;
        runOnJS(handleOpenEvent)();
      } else if (event.velocityX < -500 || (event.translationX < -sidebarWidth / 2 && isDrawerOpen.value)) {
        translateX.value = withTiming(-sidebarWidth, { duration: 250, easing: Easing.bezier(0.25, 0.1, 0.25, 1) });
        isDrawerOpen.value = false;
        runOnJS(handleCloseEvent)();
      } else {
        if (isDrawerOpen.value) {
          translateX.value = withTiming(0, { duration: 300, easing: Easing.bezier(0.25, 0.1, 0.25, 1) });
          runOnJS(handleOpenEvent)();
        } else {
          translateX.value = withTiming(-sidebarWidth, { duration: 250, easing: Easing.bezier(0.25, 0.1, 0.25, 1) });
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
      Extrapolation.CLAMP
    ),
    pointerEvents: translateX.value === -sidebarWidth ? 'none' : 'auto',
  }));

  const defaultExpandedProjectId = useMemo(() => {
    if (activeProjectId) {
      return activeProjectId;
    }
    return projects[0]?.id || "";
  }, [activeProjectId, projects]);

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedByProject((current) => {
      const currentlyExpanded = isProjectExpanded(current, projectId, defaultExpandedProjectId);
      return {
        ...current,
        [projectId]: !currentlyExpanded,
      };
    });
  };

  const handleSessionPress = (projectId: string, sessionId: string) => {
    updateProjectLastActive(projectId, sessionId);
    onSessionSelect(projectId, sessionId);
    onClose();
  };

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      if (sortDirection === 'asc') return a.name.localeCompare(b.name);
      return b.name.localeCompare(a.name);
    });
  }, [projects, sortDirection]);

  const overlayContent = (
    <>
      <Animated.View style={[styles.overlay, overlayAnimatedStyle]}>
        <Pressable 
          style={styles.overlayPressable} 
          onPress={() => { 
            isDrawerOpen.value = false; 
            translateX.value = withTiming(-sidebarWidth, { duration: 250, easing: Easing.bezier(0.25, 0.1, 0.25, 1) });
            onClose(); 
          }} 
        />
      </Animated.View>

      <Animated.View style={[styles.sidebarWrapper, { width: sidebarWidth }, drawerAnimatedStyle]}>
        <View style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
          <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'bottom']}>
            <View style={styles.header}>
              <Text style={styles.logoText}>codex-app</Text>
              <View style={styles.headerActions}>
                <Pressable 
                  style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
                  onPress={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')}
                >
                  {sortDirection === 'asc' ? (
                    <SortAZIcon color="#666" size={20} />
                  ) : (
                    <SortZAIcon color="#666" size={20} />
                  )}
                </Pressable>
              </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
              {sortedProjects.map((project) => {
                const expanded = isProjectExpanded(expandedByProject, project.id, defaultExpandedProjectId);
                
                return (
                  <View key={project.id}>
                    <Pressable 
                      onPress={() => {
                        setActiveProject(project.id);
                        onProjectSelect(project.id);
                        toggleProjectExpanded(project.id);
                      }}
                      style={({ pressed }) => [
                        styles.menuItem,
                        (activeProjectId === project.id) && { backgroundColor: 'rgba(0,0,0,0.02)' },
                        pressed && { backgroundColor: 'rgba(0,0,0,0.05)' }
                      ]}
                    >
                      {expanded ? (
                        <FolderOpenIcon size={18} color="#777" />
                      ) : (
                        <FolderIcon size={18} color="#777" />
                      )}
                      <Text style={styles.menuItemText} numberOfLines={1}>{project.name}</Text>
                      <SymbolView 
                        name={{ 
                          ios: expanded ? 'chevron.down' : 'chevron.right', 
                          android: expanded ? 'expand_more' : 'chevron_right', 
                          web: expanded ? 'expand_more' : 'chevron_right' 
                        }} 
                        tintColor="#BBB" 
                        size={10}
                        style={styles.chevron}
                      />
                    </Pressable>

                    {expanded && (
                      <View style={styles.chatList}>
                        {project.sessions.slice().sort((a, b) => b.lastActiveAt - a.lastActiveAt).map((session) => (
                          <Pressable 
                            key={session.id}
                            onPress={() => handleSessionPress(project.id, session.id)}
                            style={({ pressed }) => [
                              styles.chatItem,
                              (activeSessionId === session.id) && { backgroundColor: 'rgba(0,0,0,0.02)' },
                              pressed && { backgroundColor: 'rgba(0,0,0,0.05)' }
                            ]}
                          >
                            <Text style={[styles.chatItemText, (activeSessionId === session.id) && { color: '#333', fontWeight: '500' }]} numberOfLines={1}>
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

            <View style={styles.footer}>
              <Pressable 
                style={({ pressed }) => [
                  styles.settingsButton,
                  pressed && { opacity: 0.7 }
                ]}
              >
                <SymbolView 
                  name={{ ios: 'gearshape', android: 'settings', web: 'settings' }} 
                  tintColor="#333" 
                  size={18} 
                />
                <Text style={styles.settingsText}>Settings</Text>
              </Pressable>

              <View style={styles.limitsContainer}>
                <View style={styles.limitItem}>
                  <View style={styles.limitHeader}>
                    <Text style={styles.limitLabel}>Monthly limit</Text>
                    <Text style={styles.limitValue}>75%</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: '75%' }]} />
                  </View>
                </View>

                <View style={styles.limitItem}>
                  <View style={styles.limitHeader}>
                    <Text style={styles.limitLabel}>Weekly limit</Text>
                    <Text style={styles.limitValue}>40%</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: '40%' }]} />
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
    <GestureHandlerRootView style={[styles.wrapper, !children && StyleSheet.absoluteFillObject]} pointerEvents={children ? 'auto' : 'box-none'}>
      <GestureDetector gesture={panGesture}>
        <View style={styles.innerWrapper} pointerEvents="box-none">
          {children && <View style={styles.content}>{children}</View>}
          {overlayContent}
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
};

function isProjectExpanded(state: ExpandedState, projectId: string, defaultExpandedProjectId: string) {
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

const styles = StyleSheet.create({
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
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 100,
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Platform.OS === 'android' ? Spacing.five : Spacing.four,
    paddingBottom: Spacing.two,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.four,
    alignItems: 'center',
  },
  logoText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    letterSpacing: -0.3,
  },
  headerButton: {
    padding: 2,
  },
  scrollContent: {
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.two,
    paddingBottom: 40,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: Spacing.three,
    borderRadius: 8,
    marginBottom: 4,
  },
  menuItemText: {
    marginLeft: Spacing.three,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
  chevron: {
    marginLeft: 'auto',
  },
  chatList: {
    marginLeft: 12,
    marginBottom: Spacing.two,
  },
  chatItem: {
    paddingVertical: 6,
    paddingLeft: Spacing.four + 12,
    paddingRight: Spacing.two,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  chatIconWrapper: {
    marginRight: 8,
    marginTop: 1,
  },
  chatItemText: {
    fontSize: 13,
    color: '#777',
    fontWeight: '400',
    flex: 1,
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
    marginTop: 'auto',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EBEBEB',
    paddingTop: Spacing.four,
    gap: Spacing.four,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  settingsText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  limitsContainer: {
    gap: Spacing.three,
  },
  limitItem: {
    gap: 6,
  },
  limitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  limitLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  limitValue: {
    fontSize: 11,
    color: '#AAA',
  },
  progressBarBg: {
    height: 4,
    backgroundColor: '#F0F0F0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#333',
    borderRadius: 2,
  },
  pressed: {
    opacity: 0.7,
  },
});