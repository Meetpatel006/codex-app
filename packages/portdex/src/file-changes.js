// FILE: file-changes.js
// Purpose: Parses Codex apply_patch payloads into mobile-friendly changed-file summaries.
// Layer: Bridge utility
// Exports: parseApplyPatchFileChanges

function parseApplyPatchFileChanges(rawPatch, options = {}) {
  const patch = typeof rawPatch === "string" ? rawPatch : "";
  if (!patch.trim()) {
    return [];
  }

  const cwd = normalizePath(options.cwd || "");
  const lines = patch.split(/\r?\n/);
  const output = [];
  let current = null;

  function flushCurrent() {
    if (!current || !current.path) {
      current = null;
      return;
    }

    output.push({
      path: current.path,
      action: current.action,
      additions: current.additions,
      deletions: current.deletions,
    });
    current = null;
  }

  for (const line of lines) {
    if (line.startsWith("*** Update File: ")) {
      flushCurrent();
      current = {
        path: normalizeWorkspacePath(line.slice("*** Update File: ".length), cwd),
        action: "edited",
        additions: 0,
        deletions: 0,
      };
      continue;
    }

    if (line.startsWith("*** Add File: ")) {
      flushCurrent();
      current = {
        path: normalizeWorkspacePath(line.slice("*** Add File: ".length), cwd),
        action: "created",
        additions: 0,
        deletions: 0,
      };
      continue;
    }

    if (line.startsWith("*** Delete File: ")) {
      flushCurrent();
      current = {
        path: normalizeWorkspacePath(line.slice("*** Delete File: ".length), cwd),
        action: "deleted",
        additions: 0,
        deletions: 0,
      };
      continue;
    }

    if (!current) {
      continue;
    }

    if (line.startsWith("*** Move to: ")) {
      current.path = normalizeWorkspacePath(line.slice("*** Move to: ".length), cwd);
      current.action = "moved";
      continue;
    }

    if (line.startsWith("+") && !line.startsWith("+++")) {
      current.additions += 1;
      continue;
    }

    if (line.startsWith("-") && !line.startsWith("---")) {
      current.deletions += 1;
    }
  }

  flushCurrent();
  return mergeDuplicateFileChanges(output);
}

function mergeDuplicateFileChanges(changes) {
  const byPath = new Map();

  for (const change of changes) {
    const existing = byPath.get(change.path);
    if (!existing) {
      byPath.set(change.path, { ...change });
      continue;
    }

    existing.additions += change.additions || 0;
    existing.deletions += change.deletions || 0;

    if (actionRank(change.action) > actionRank(existing.action)) {
      existing.action = change.action;
    }
  }

  return Array.from(byPath.values());
}

function actionRank(action) {
  switch (action) {
    case "created":
      return 4;
    case "deleted":
      return 3;
    case "moved":
      return 2;
    default:
      return 1;
  }
}

function normalizeWorkspacePath(rawPath, cwd) {
  const normalized = normalizePath(rawPath.replace(/^"+|"+$/g, "").trim());
  if (!normalized) {
    return "";
  }

  if (cwd && normalized.toLowerCase().startsWith(`${cwd.toLowerCase()}/`)) {
    return normalized.slice(cwd.length + 1);
  }

  return normalized;
}

function normalizePath(value) {
  return String(value || "").replace(/\\/g, "/").replace(/\/+/g, "/").trim();
}

module.exports = {
  parseApplyPatchFileChanges,
};
