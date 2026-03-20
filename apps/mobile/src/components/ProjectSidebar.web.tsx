import React from 'react';
import styles from './ProjectSidebar.module.css';
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
  };

  return (
    <>
      {isOpen && <div className={styles.overlay} onClick={onClose} />}
      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
        <div className={styles.header}>
          <h2 className={styles.title}>Projects</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.projectList}>
          {projects.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyText}>No projects yet</p>
            </div>
          ) : (
            projects.map((project) => (
              <div key={project.id}>
                <button
                  className={`${styles.projectItem} ${
                    activeProjectId === project.id ? styles.active : ''
                  }`}
                  onClick={() => handleProjectPress(project.id)}
                >
                  <div className={styles.projectHeader}>
                    <span className={styles.projectName}>{project.name}</span>
                    <span className={styles.sessionCount}>{project.sessions.length}</span>
                  </div>
                  {project.description && (
                    <p className={styles.projectDescription}>{project.description}</p>
                  )}
                </button>

                {activeProjectId === project.id && project.sessions.length > 0 && (
                  <div className={styles.sessionsList}>
                    {project.sessions
                      .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
                      .map((session) => (
                        <button
                          key={session.id}
                          className={`${styles.sessionItem} ${
                            activeSessionId === session.id ? styles.activeSession : ''
                          }`}
                          onClick={() => handleSessionPress(project.id, session.id)}
                        >
                          <span className={styles.sessionName}>{session.name}</span>
                          <span className={styles.sessionTime}>
                            {formatTime(session.lastActiveAt)}
                          </span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </aside>
    </>
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
