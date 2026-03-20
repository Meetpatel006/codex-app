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
import { useChatStore } from '@/store/chat';

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
  const [activeTab, setActiveTab] = useState<'projects' | 'history'>('projects');
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'unspecified' ? 'light' : colorScheme];
  
  const projects = useSessionStore((state) => state.projects);
  const activeProjectId = useSessionStore((state) => state.activeProjectId);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const setActiveProject = useSessionStore((state) => state.setActiveProject);
  const updateProjectLastActive = useSessionStore((state) => state.updateProjectLastActive);
  const messages = useChatStore((state) => state.messages);
  const historyItems = messages.slice(-20).reverse();

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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Sidebar</Text>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Text style={[styles.closeButtonText, { color: colors.textSecondary }]}>✕</Text>
        </Pressable>
      </View>

      <View style={[styles.tabRow, { borderBottomColor: colors.backgroundElement }]}> 
        <Pressable
          onPress={() => setActiveTab('projects')}
          style={[
            styles.tabButton,
            activeTab === 'projects' && { backgroundColor: colors.backgroundSelected },
          ]}
        >
          <Text style={[styles.tabButtonText, { color: colors.text }]}>Projects</Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('history')}
          style={[
            styles.tabButton,
            activeTab === 'history' && { backgroundColor: colors.backgroundSelected },
          ]}
        >
          <Text style={[styles.tabButtonText, { color: colors.text }]}>History</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.projectList}>
        {activeTab === 'projects' ? (
          projects.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
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
                    <Text style={[styles.sessionCount, { color: colors.textSecondary }]}>
                      {project.sessions.length}
                    </Text>
                  </View>
                  {project.description && (
                    <Text
                      style={[styles.projectDescription, { color: colors.textSecondary }]}
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
                              backgroundColor: colors.backgroundSelected,
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
                          <Text style={[styles.sessionTime, { color: colors.textSecondary }]}>
                            {formatTime(session.lastActiveAt)}
                          </Text>
                        </Pressable>
                      ))}
                  </View>
                )}
              </View>
            ))
          )
        ) : (
          <View style={styles.historySection}>
            {historyItems.length === 0 ? (
              <Text style={[styles.historyEmptyText, { color: colors.textSecondary }]}>No chat messages yet</Text>
            ) : (
              historyItems.map((message) => (
                <View key={message.id} style={[styles.historyItem, { backgroundColor: colors.backgroundElement }]}>
                  <Text
                    style={[
                      styles.historyRole,
                      { color: message.role === 'user' ? colors.text : colors.textSecondary },
                    ]}
                  >
                    {message.role === 'user' ? 'You' : 'Codex'}
                  </Text>
                  <Text style={[styles.historyText, { color: colors.text }]} numberOfLines={2}>
                    {message.text || (message.isStreaming ? 'Streaming response...' : '')}
                  </Text>
                </View>
              ))
            )}
          </View>
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
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '700',
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
  historySection: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 8,
  },
  historyEmptyText: {
    fontSize: 12,
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  historyItem: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  historyRole: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  historyText: {
    fontSize: 12,
    lineHeight: 16,
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
