import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Text,
  Dimensions,
  Modal,
} from 'react-native';
import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/theme';
import { useSessionStore } from '@/store/session';

interface ProjectSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectSelect: (projectId: string) => void;
  onSessionSelect: (projectId: string, sessionId: string) => void;
}

export const ProjectSidebar: React.FC<ProjectSidebarProps> = ({
  isOpen,
  onClose,
  onProjectSelect,
  onSessionSelect,
}) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'unspecified' ? 'light' : colorScheme];
  
  const projects = useSessionStore((state) => state.projects);
  const activeProjectId = useSessionStore((state) => state.activeProjectId);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setActiveProject = useSessionStore((state) => state.setActiveProject);
  const updateProjectLastActive = useSessionStore((state) => state.updateProjectLastActive);

  const handleProjectPress = (projectId: string) => {
    setActiveProject(projectId);
    onProjectSelect(projectId);
  };

  const handleSessionPress = (projectId: string, sessionId: string) => {
    updateProjectLastActive(projectId, sessionId);
    onSessionSelect(projectId, sessionId);
    onClose();
  };

  const sidebarContent = (
    <View style={[styles.sidebarContainer, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.backgroundElement }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Projects</Text>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Text style={[styles.closeButtonText, { color: colors.tint }]}>✕</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.projectList}>
        {projects.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.tabIconDefault }]}>
              No projects yet
            </Text>
          </View>
        ) : (
          projects.map((project) => (
            <View key={project.id}>
              <Pressable
                onPress={() => handleProjectPress(project.id)}
                style={[
                  styles.projectItem,
                  activeProjectId === project.id && {
                    backgroundColor: colors.backgroundElement,
                  },
                ]}
              >
                <View style={styles.projectHeader}>
                  <Text
                    style={[
                      styles.projectName,
                      { color: colors.text },
                      activeProjectId === project.id && styles.activeText,
                    ]}
                  >
                    {project.name}
                  </Text>
                  <Text style={[styles.sessionCount, { color: colors.tabIconDefault }]}>
                    {project.sessions.length}
                  </Text>
                </View>
                {project.description && (
                  <Text
                    style={[styles.projectDescription, { color: colors.tabIconDefault }]}
                    numberOfLines={1}
                  >
                    {project.description}
                  </Text>
                )}
              </Pressable>

              {activeProjectId === project.id && project.sessions.length > 0 && (
                <View style={[styles.sessionsList, { backgroundColor: colors.backgroundElement }]}>
                  {project.sessions
                    .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
                    .map((session) => (
                      <Pressable
                        key={session.id}
                        onPress={() => handleSessionPress(project.id, session.id)}
                        style={[
                          styles.sessionItem,
                          activeSessionId === session.id && {
                            backgroundColor: colors.tint + '20',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.sessionName,
                            { color: colors.text },
                            activeSessionId === session.id && styles.activeText,
                          ]}
                          numberOfLines={1}
                        >
                          {session.name}
                        </Text>
                        <Text style={[styles.sessionTime, { color: colors.tabIconDefault }]}>
                          {formatTime(session.lastActiveAt)}
                        </Text>
                      </Pressable>
                    ))}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );

  const screenWidth = Dimensions.get('window').width;
  const sidebarWidth = Math.min(300, screenWidth * 0.75);

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <Pressable
          style={styles.overlay}
          onPress={onClose}
        />
        <View style={[styles.sidebarWrapper, { width: sidebarWidth }]}>
          {sidebarContent}
        </View>
      </View>
    </Modal>
  );
};

function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sidebarWrapper: {
    maxWidth: '100%',
    height: '100%',
  },
  sidebarContainer: {
    flex: 1,
    paddingTop: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
  },
  projectList: {
    flex: 1,
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
  },
  projectItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  projectName: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  projectDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  sessionCount: {
    fontSize: 12,
    marginLeft: 8,
  },
  activeText: {
    fontWeight: '700',
  },
  sessionsList: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sessionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginVertical: 2,
    borderRadius: 6,
  },
  sessionName: {
    fontSize: 14,
    marginBottom: 2,
  },
  sessionTime: {
    fontSize: 11,
  },
});
