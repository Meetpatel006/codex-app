import React, { useMemo, useState } from "react";
import {
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useSessionStore } from "@/store/session";

interface ProjectSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectSelect: (projectId: string) => void;
  onSessionSelect: (projectId: string, sessionId: string) => void;
}

type ExpandedState = Record<string, boolean>;

export const ProjectSidebar: React.FC<ProjectSidebarProps> = ({
  isOpen,
  onClose,
  onProjectSelect,
  onSessionSelect,
}) => {
  const projects = useSessionStore((state) => state.projects);
  const activeProjectId = useSessionStore((state) => state.activeProjectId);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setActiveProject = useSessionStore((state) => state.setActiveProject);
  const updateProjectLastActive = useSessionStore((state) => state.updateProjectLastActive);

  const [expandedByProject, setExpandedByProject] = useState<ExpandedState>({});
  const [faviconFailures, setFaviconFailures] = useState<Record<string, true>>({});

  const defaultExpandedProjectId = useMemo(() => {
    if (activeProjectId) {
      return activeProjectId;
    }

    return projects[0]?.id || "";
  }, [activeProjectId, projects]);

  const handleProjectPress = (projectId: string) => {
    setActiveProject(projectId);
    onProjectSelect(projectId);

    setExpandedByProject((current) => {
      if (typeof current[projectId] === "boolean") {
        return current;
      }

      return {
        ...current,
        [projectId]: true,
      };
    });
  };

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

  const screenWidth = Dimensions.get("window").width;
  const sidebarWidth = Math.min(296, screenWidth * 0.82);

  return (
    <Modal visible={isOpen} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <Pressable style={styles.overlay} onPress={onClose} />
        <View style={[styles.sidebarWrapper, { width: sidebarWidth }]}>
          <View style={styles.sidebarContainer}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>PROJECTS</Text>
              <Pressable
                accessibilityLabel="Add project"
                style={({ pressed, hovered }) => [
                  styles.addButton,
                  (pressed || hovered) && styles.addButtonHover,
                ]}
              >
                <Text style={styles.addButtonText}>+</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.projectList} contentContainerStyle={styles.projectListContent}>
              {projects.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No projects yet</Text>
                </View>
              ) : (
                projects.map((project) => {
                  const expanded = isProjectExpanded(expandedByProject, project.id, defaultExpandedProjectId);
                  const projectIsActive = activeProjectId === project.id;
                  const domain = resolveProjectDomain(project.name, project.description);
                  const iconUrl = domain ? faviconUrlForDomain(domain) : "";
                  const showFavicon = Boolean(iconUrl) && !faviconFailures[project.id];

                  return (
                    <View key={project.id} style={styles.projectBlock}>
                      <View style={styles.projectRowShell}>
                        <Pressable
                          onPress={() => toggleProjectExpanded(project.id)}
                          accessibilityLabel={expanded ? "Collapse" : "Expand"}
                          style={({ pressed, hovered }) => [
                            styles.chevronButton,
                            (pressed || hovered) && styles.rowHover,
                          ]}
                        >
                          <Text style={[styles.chevron, !expanded && styles.chevronCollapsed]}>▾</Text>
                        </Pressable>

                        <Pressable
                          onPress={() => handleProjectPress(project.id)}
                          style={({ pressed, hovered }) => [
                            styles.projectRow,
                            (pressed || hovered) && styles.rowHover,
                            projectIsActive && styles.projectRowActive,
                          ]}
                        >
                          <View style={styles.projectLeading}>
                            {showFavicon ? (
                              <Image
                                source={{ uri: iconUrl }}
                                style={styles.favicon}
                                onError={() => {
                                  setFaviconFailures((current) => ({
                                    ...current,
                                    [project.id]: true,
                                  }));
                                }}
                              />
                            ) : (
                              <View style={styles.iconFallback}>
                                <Text style={styles.iconFallbackText}>{fallbackInitial(project.name)}</Text>
                              </View>
                            )}
                            <Text style={styles.projectName} numberOfLines={1}>
                              {project.name}
                            </Text>
                          </View>
                        </Pressable>
                      </View>

                      {expanded && project.sessions.length > 0 && (
                        <View style={styles.sessionGroup}>
                          <View style={styles.verticalGuide} />
                          <View style={styles.sessionsColumn}>
                            {project.sessions
                              .slice()
                              .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
                              .map((session) => {
                                const selected = activeSessionId === session.id;
                                return (
                                  <Pressable
                                    key={session.id}
                                    onPress={() => handleSessionPress(project.id, session.id)}
                                    style={({ pressed, hovered }) => [
                                      styles.sessionRow,
                                      (pressed || hovered) && styles.rowHover,
                                      selected && styles.sessionRowSelected,
                                    ]}
                                  >
                                    <Text style={styles.sessionTitle} numberOfLines={1}>
                                      {session.name}
                                    </Text>
                                    <Text style={styles.sessionTime} numberOfLines={1}>
                                      {formatTime(session.lastActiveAt)}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
};

function isProjectExpanded(state: ExpandedState, projectId: string, defaultExpandedProjectId: string) {
  if (typeof state[projectId] === "boolean") {
    return state[projectId];
  }

  return projectId === defaultExpandedProjectId;
}

function fallbackInitial(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return "-";
  }

  return trimmed[0].toLowerCase();
}

function resolveProjectDomain(name: string, description?: string) {
  const candidates = [description || "", name];
  for (const candidate of candidates) {
    const normalized = candidate.trim();
    if (!normalized) {
      continue;
    }

    const urlFromText = normalized.match(/https?:\/\/([^\s/]+)/i);
    if (urlFromText?.[1]) {
      return stripWww(urlFromText[1]);
    }

    const hostLike = normalized.match(/([a-z0-9-]+\.)+[a-z]{2,}/i);
    if (hostLike?.[0]) {
      return stripWww(hostLike[0]);
    }

    if (/^[a-z0-9-]{2,}$/i.test(normalized)) {
      return `${normalized.toLowerCase()}.com`;
    }
  }

  return "";
}

function stripWww(value: string) {
  return value.replace(/^www\./i, "");
}

function faviconUrlForDomain(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    flexDirection: "row",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.52)",
  },
  sidebarWrapper: {
    maxWidth: "100%",
    height: "100%",
  },
  sidebarContainer: {
    flex: 1,
    paddingTop: Platform.OS === "ios" ? 56 : 36,
    backgroundColor: "#1a1a1a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  headerTitle: {
    color: "#737373",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.9,
  },
  addButton: {
    width: 22,
    height: 22,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonHover: {
    backgroundColor: "#232323",
  },
  addButtonText: {
    color: "#8f8f8f",
    fontSize: 17,
    lineHeight: 17,
    marginTop: -1,
  },
  projectList: {
    flex: 1,
  },
  projectListContent: {
    paddingHorizontal: 8,
    paddingBottom: 18,
  },
  emptyState: {
    paddingTop: 36,
    alignItems: "center",
  },
  emptyText: {
    color: "#747474",
    fontSize: 12,
  },
  projectBlock: {
    marginBottom: 3,
  },
  projectRowShell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  chevronButton: {
    width: 18,
    height: 24,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  chevron: {
    color: "#787878",
    fontSize: 11,
    lineHeight: 11,
  },
  chevronCollapsed: {
    transform: [{ rotate: "-90deg" }],
  },
  projectRow: {
    flex: 1,
    minHeight: 28,
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: "center",
  },
  projectRowActive: {
    backgroundColor: "#242424",
  },
  rowHover: {
    backgroundColor: "#212121",
  },
  projectLeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  favicon: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
  iconFallback: {
    width: 14,
    height: 14,
    borderRadius: 4,
    backgroundColor: "#2b2b2b",
    justifyContent: "center",
    alignItems: "center",
  },
  iconFallbackText: {
    color: "#9b9b9b",
    fontSize: 9,
    fontWeight: "600",
  },
  projectName: {
    color: "#e5e5e5",
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  sessionGroup: {
    flexDirection: "row",
    marginLeft: 17,
    marginTop: 2,
  },
  verticalGuide: {
    width: 1,
    backgroundColor: "#2a2a2a",
    marginTop: 4,
    marginBottom: 5,
    marginRight: 8,
  },
  sessionsColumn: {
    flex: 1,
    gap: 2,
  },
  sessionRow: {
    minHeight: 28,
    borderRadius: 9,
    paddingLeft: 9,
    paddingRight: 7,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sessionRowSelected: {
    backgroundColor: "#2a2a2a",
  },
  sessionTitle: {
    color: "#8f8f8f",
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  sessionTime: {
    color: "#6d6d6d",
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.1,
  },
});