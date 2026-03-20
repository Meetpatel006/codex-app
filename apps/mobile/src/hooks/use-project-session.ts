import { useCallback } from 'react';
import { useSessionStore } from '@/store/session';

/**
 * Hook for managing project and session selection
 * Provides utilities for working with the sidebar and session management
 */
export function useProjectSession() {
  const addProject = useSessionStore((state) => state.addProject);
  const removeProject = useSessionStore((state) => state.removeProject);
  const addSessionToProject = useSessionStore((state) => state.addSessionToProject);
  const removeSessionFromProject = useSessionStore((state) => state.removeSessionFromProject);
  const updateProjectLastActive = useSessionStore((state) => state.updateProjectLastActive);
  const activeProjectId = useSessionStore((state) => state.activeProjectId);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const projects = useSessionStore((state) => state.projects);

  const getCurrentProject = useCallback(() => {
    return projects.find((p) => p.id === activeProjectId);
  }, [projects, activeProjectId]);

  const getCurrentSession = useCallback(() => {
    const project = getCurrentProject();
    if (!project) return null;
    return project.sessions.find((s) => s.id === activeSessionId);
  }, [getCurrentProject, activeSessionId]);

  const selectProject = useCallback(
    (projectId: string) => {
      addProject({
        id: projectId,
        name: `Project ${projectId}`,
        createdAt: Date.now(),
        sessions: [],
      });
      useSessionStore.setState({ activeProjectId: projectId });
    },
    [addProject]
  );

  const selectSession = useCallback(
    (projectId: string, sessionId: string) => {
      updateProjectLastActive(projectId, sessionId);
    },
    [updateProjectLastActive]
  );

  return {
    // State
    activeProjectId,
    activeSessionId,
    projects,
    currentProject: getCurrentProject(),
    currentSession: getCurrentSession(),

    // Actions
    addProject,
    removeProject,
    addSessionToProject,
    removeSessionFromProject,
    updateProjectLastActive,
    selectProject,
    selectSession,
  };
}
