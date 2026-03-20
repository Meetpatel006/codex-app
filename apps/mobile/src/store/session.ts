import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

type PairingState = {
  relayUrl: string;
  sessionId: string;
  bridgeIdentityPublicKey: string;
  expiryMs: number;
};

type ProjectSession = {
  id: string;
  name: string;
  createdAt: number;
  lastActiveAt: number;
};

type Project = {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  sessions: ProjectSession[];
};

type SessionStore = {
  pairing: PairingState | null;
  mobileIdentityPrivateKeyHex: string | null;
  mobileIdentityPublicKeyHex: string | null;
  projects: Project[];
  activeProjectId: string | null;
  activeSessionId: string | null;
  setPairing: (pairing: PairingState) => Promise<void>;
  clearPairing: () => Promise<void>;
  setMobileIdentity: (privateKeyHex: string, publicKeyHex: string) => Promise<void>;
  addProject: (project: Project) => void;
  removeProject: (projectId: string) => void;
  addSessionToProject: (projectId: string, session: ProjectSession) => void;
  removeSessionFromProject: (projectId: string, sessionId: string) => void;
  replaceProjects: (
    projects: Project[],
    activeProjectId?: string | null,
    activeSessionId?: string | null,
  ) => void;
  setActiveProject: (projectId: string | null) => void;
  setActiveSession: (sessionId: string | null) => void;
  updateProjectLastActive: (projectId: string, sessionId: string) => void;
  load: () => Promise<void>;
};

const PAIRING_KEY = "relay.pairing";
const IDENTITY_PRIVATE_KEY = "relay.identity.private";
const IDENTITY_PUBLIC_KEY = "relay.identity.public";
const PROJECTS_KEY = "projects.list";
const ACTIVE_PROJECT_KEY = "active.project";
const ACTIVE_SESSION_KEY = "active.session";
const SECURESTORE_SAFE_VALUE_BYTES = 1900;

const LEGACY_MOCK_PROJECT_IDS = new Set(["proj-web", "proj-mobile", "proj-backend"]);
const SYNTHETIC_PROJECT_IDS = new Set(["paired-session"]);

function isLegacyMockProjects(projects: Project[]) {
  if (!Array.isArray(projects) || projects.length === 0) {
    return false;
  }

  return projects.some(
    (project) => LEGACY_MOCK_PROJECT_IDS.has(project.id) || SYNTHETIC_PROJECT_IDS.has(project.id),
  );
}

function utf8ByteLength(value: string) {
  try {
    return new TextEncoder().encode(value).length;
  } catch {
    return value.length;
  }
}

async function persistProjectsSafely(projects: Project[]) {
  const serialized = JSON.stringify(projects);
  const sizeBytes = utf8ByteLength(serialized);

  if (sizeBytes > SECURESTORE_SAFE_VALUE_BYTES) {
    // SecureStore is for small secrets; avoid oversized writes that can fail.
    console.warn(
      `[mobile][session/store] projects payload too large for SecureStore (${sizeBytes} bytes), skipping persistence`,
    );
    await SecureStore.deleteItemAsync(PROJECTS_KEY);
    return;
  }

  await SecureStore.setItemAsync(PROJECTS_KEY, serialized);
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  pairing: null,
  mobileIdentityPrivateKeyHex: null,
  mobileIdentityPublicKeyHex: null,
  projects: [],
  activeProjectId: null,
  activeSessionId: null,
  async setPairing(pairing) {
    await SecureStore.setItemAsync(PAIRING_KEY, JSON.stringify(pairing));
    set({ pairing });
  },
  async clearPairing() {
    await SecureStore.deleteItemAsync(PAIRING_KEY);
    set({ pairing: null });
  },
  async setMobileIdentity(privateKeyHex, publicKeyHex) {
    await SecureStore.setItemAsync(IDENTITY_PRIVATE_KEY, privateKeyHex);
    await SecureStore.setItemAsync(IDENTITY_PUBLIC_KEY, publicKeyHex);
    set({
      mobileIdentityPrivateKeyHex: privateKeyHex,
      mobileIdentityPublicKeyHex: publicKeyHex,
    });
  },
  addProject(project) {
    set((state) => {
      const exists = state.projects.some((p) => p.id === project.id);
      if (exists) return state;
      return {
        projects: [...state.projects, project],
      };
    });
    void persistProjectsSafely(get().projects);
  },
  removeProject(projectId) {
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== projectId),
      activeProjectId:
        state.activeProjectId === projectId ? null : state.activeProjectId,
    }));
    void Promise.all([
      persistProjectsSafely(get().projects),
      SecureStore.setItemAsync(ACTIVE_PROJECT_KEY, get().activeProjectId || ""),
    ]);
  },
  addSessionToProject(projectId, session) {
    set((state) => {
      return {
        projects: state.projects.map((p) => {
          if (p.id === projectId) {
            const sessionExists = p.sessions.some((s) => s.id === session.id);
            if (sessionExists) return p;
            return {
              ...p,
              sessions: [...p.sessions, session],
            };
          }
          return p;
        }),
      };
    });
    void persistProjectsSafely(get().projects);
  },
  removeSessionFromProject(projectId, sessionId) {
    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id === projectId) {
          return {
            ...p,
            sessions: p.sessions.filter((s) => s.id !== sessionId),
          };
        }
        return p;
      }),
      activeSessionId:
        state.activeSessionId === sessionId ? null : state.activeSessionId,
    }));
    void Promise.all([
      persistProjectsSafely(get().projects),
      SecureStore.setItemAsync(ACTIVE_SESSION_KEY, get().activeSessionId || ""),
    ]);
  },
  replaceProjects(projects, activeProjectId, activeSessionId) {
    const nextActiveProjectId = activeProjectId ?? null;
    const nextActiveSessionId = activeSessionId ?? null;

    set({
      projects,
      activeProjectId: nextActiveProjectId,
      activeSessionId: nextActiveSessionId,
    });

    void Promise.all([
      persistProjectsSafely(projects),
      SecureStore.setItemAsync(ACTIVE_PROJECT_KEY, nextActiveProjectId || ""),
      SecureStore.setItemAsync(ACTIVE_SESSION_KEY, nextActiveSessionId || ""),
    ]);
  },
  setActiveProject(projectId) {
    set({ activeProjectId: projectId });
    void SecureStore.setItemAsync(ACTIVE_PROJECT_KEY, projectId || "");
  },
  setActiveSession(sessionId) {
    set({ activeSessionId: sessionId });
    void SecureStore.setItemAsync(ACTIVE_SESSION_KEY, sessionId || "");
  },
  updateProjectLastActive(projectId, sessionId) {
    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id === projectId) {
          return {
            ...p,
            sessions: p.sessions.map((s) => {
              if (s.id === sessionId) {
                return { ...s, lastActiveAt: Date.now() };
              }
              return s;
            }),
          };
        }
        return p;
      }),
      activeProjectId: projectId,
      activeSessionId: sessionId,
    }));
    void Promise.all([
      persistProjectsSafely(get().projects),
      SecureStore.setItemAsync(ACTIVE_PROJECT_KEY, projectId),
      SecureStore.setItemAsync(ACTIVE_SESSION_KEY, sessionId),
    ]);
  },
  async load() {
    const [pairingRaw, privateKeyHex, publicKeyHex, projectsRaw, activeProjectId, activeSessionId] =
      await Promise.all([
        SecureStore.getItemAsync(PAIRING_KEY),
        SecureStore.getItemAsync(IDENTITY_PRIVATE_KEY),
        SecureStore.getItemAsync(IDENTITY_PUBLIC_KEY),
        SecureStore.getItemAsync(PROJECTS_KEY),
        SecureStore.getItemAsync(ACTIVE_PROJECT_KEY),
        SecureStore.getItemAsync(ACTIVE_SESSION_KEY),
      ]);

    let parsedProjects = projectsRaw ? (JSON.parse(projectsRaw) as Project[]) : [];
    let parsedActiveProjectId = activeProjectId || null;
    let parsedActiveSessionId = activeSessionId || null;

    if (isLegacyMockProjects(parsedProjects)) {
      parsedProjects = [];
      parsedActiveProjectId = null;
      parsedActiveSessionId = null;
      await Promise.all([
        SecureStore.setItemAsync(PROJECTS_KEY, JSON.stringify([])),
        SecureStore.setItemAsync(ACTIVE_PROJECT_KEY, ""),
        SecureStore.setItemAsync(ACTIVE_SESSION_KEY, ""),
      ]);
    }

    set({
      pairing: pairingRaw ? (JSON.parse(pairingRaw) as PairingState) : null,
      mobileIdentityPrivateKeyHex: privateKeyHex,
      mobileIdentityPublicKeyHex: publicKeyHex,
      projects: parsedProjects,
      activeProjectId: parsedActiveProjectId,
      activeSessionId: parsedActiveSessionId,
    });
  },
}));

export type { PairingState, Project, ProjectSession };
