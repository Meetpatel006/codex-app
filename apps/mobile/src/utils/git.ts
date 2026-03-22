import { relayService } from "@/services/relay";

export type GitStatusResult = {
  repoRoot?: string | null;
  branch?: string | null;
  tracking?: string | null;
  dirty?: boolean;
  ahead?: number;
  behind?: number;
  localOnlyCommitCount?: number;
  state?: string;
  canPush?: boolean;
  publishedToRemote?: boolean;
  files?: { path: string; status: string }[];
  diff?: {
    additions?: number;
    deletions?: number;
    binaryFiles?: number;
  };
};

export type GitDiffResult = {
  patch?: string;
};

export function getGitCwd(projectDescription?: string) {
  const cwd = (projectDescription || "").trim();
  return cwd || null;
}

export async function requestGitStatus(cwd: string) {
  return relayService.requestJson<GitStatusResult>("git/status", { cwd });
}

export async function requestGitDiff(cwd: string) {
  return relayService.requestJson<GitDiffResult>("git/diff", { cwd });
}
