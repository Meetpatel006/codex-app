import { relayService } from "@/services/relay";

export type GitFileStatus = {
  path: string;
  status: string;
};

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
  files?: GitFileStatus[];
  staged?: GitFileStatus[];
  unstaged?: GitFileStatus[];
  untracked?: string[];
  diff?: {
    additions?: number;
    deletions?: number;
    binaryFiles?: number;
  };
};

export type GitDiffResult = {
  patch?: string;
};

export type GitCommit = {
  hash: string;
  message: string;
  author: string;
  date: number;
};

export type GitCommitDetails = {
  commit: {
    hash: string;
    fullHash: string;
    message: string;
    author: string;
    date: number;
  };
  files: Array<{ path: string; status: string }>;
  diff: string;
  fileDiffs: Record<string, string>;
};

export type GitBranchResult = {
  branches: string[];
  current: string;
  default: string;
  branchesCheckedOutElsewhere?: string[];
  worktreePathByBranch?: Record<string, string>;
  localCheckoutPath?: string | null;
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

export async function requestGitStage(cwd: string, paths: string[]) {
  return relayService.requestJson<{ success: boolean }>("git/stage", {
    cwd,
    paths,
  });
}

export async function requestGitUnstage(cwd: string, paths: string[]) {
  return relayService.requestJson<{ success: boolean }>("git/unstage", {
    cwd,
    paths,
  });
}

export async function requestGitDiscard(
  cwd: string,
  paths?: string[],
  all?: boolean,
) {
  return relayService.requestJson<{ success: boolean }>("git/discard", {
    cwd,
    paths,
    all,
  });
}

export async function requestGitCommit(cwd: string, message: string) {
  return relayService.requestJson<{
    hash: string;
    branch: string;
    summary: string;
  }>("git/commit", { cwd, message });
}

export async function requestGitPull(cwd: string) {
  return relayService.requestJson<{
    success: boolean;
    status: GitStatusResult;
  }>("git/pull", { cwd });
}

export async function requestGitPush(cwd: string) {
  return relayService.requestJson<{
    branch: string;
    remote: string;
    status: GitStatusResult;
  }>("git/push", { cwd });
}

export async function requestGitBranches(cwd: string) {
  return relayService.requestJson<GitBranchResult>("git/branches", { cwd });
}

export async function requestGitCheckout(cwd: string, branch: string) {
  return relayService.requestJson<{
    current: string;
    tracking: string | null;
    status: GitStatusResult;
  }>("git/checkout", { cwd, branch });
}

export async function requestGitCreateBranch(cwd: string, name: string) {
  return relayService.requestJson<{ branch: string; status: GitStatusResult }>(
    "git/createBranch",
    { cwd, name },
  );
}

export async function requestGitDeleteBranch(cwd: string, branch: string) {
  return relayService.requestJson<{ success: boolean; branch: string }>(
    "git/deleteBranch",
    { cwd, branch },
  );
}

export async function requestGitLog(cwd: string, limit: number = 50) {
  return relayService.requestJson<{ commits: GitCommit[] }>("git/log", {
    cwd,
    limit,
  });
}

export async function requestGitCommitDetails(cwd: string, hash: string) {
  return relayService.requestJson<GitCommitDetails>("git/commitDetails", {
    cwd,
    hash,
  });
}
