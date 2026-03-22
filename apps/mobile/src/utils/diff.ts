export type DiffLineType = "context" | "addition" | "deletion";

export type ParsedDiffLine = {
  id: string;
  type: DiffLineType;
  content: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
};

export type ParsedDiffHunk = {
  id: string;
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: ParsedDiffLine[];
};

export type ParsedDiffFile = {
  id: string;
  path: string;
  oldPath: string;
  newPath: string;
  status: "created" | "edited" | "deleted" | "renamed" | "moved";
  additions: number;
  deletions: number;
  diff: string;
  hunks: ParsedDiffHunk[];
};

type MutableFile = ParsedDiffFile & {
  currentHunk: ParsedDiffHunk | null;
  oldCursor: number;
  newCursor: number;
};

const HUNK_HEADER_REGEX =
  /^@@ -(?<oldStart>\d+)(?:,(?<oldLines>\d+))? \+(?<newStart>\d+)(?:,(?<newLines>\d+))? @@/;

function normalizeDiffPath(value: string) {
  if (!value) {
    return "";
  }

  return value
    .replace(/^a\//, "")
    .replace(/^b\//, "")
    .replace(/^"+|"+$/g, "");
}

function makeFileId(path: string, index: number) {
  return `${path || "file"}-${index}`;
}

function makeHunkId(fileId: string, index: number) {
  return `${fileId}-hunk-${index}`;
}

function flushCurrentHunk(file: MutableFile | null) {
  if (!file?.currentHunk) {
    return;
  }

  file.hunks.push(file.currentHunk);
  file.currentHunk = null;
}

function finalizeFile(file: MutableFile | null): ParsedDiffFile | null {
  if (!file) {
    return null;
  }

  flushCurrentHunk(file);
  const { currentHunk: _currentHunk, oldCursor: _oldCursor, newCursor: _newCursor, ...parsed } =
    file;
  return parsed;
}

export function parseUnifiedDiff(diffText: string): ParsedDiffFile[] {
  const lines = diffText.split("\n");
  const files: ParsedDiffFile[] = [];
  let currentFile: MutableFile | null = null;
  let fileIndex = 0;

  const pushCurrentFile = () => {
    const parsed = finalizeFile(currentFile);
    if (parsed) {
      files.push(parsed);
    }
    currentFile = null;
  };

  for (const line of lines) {
    const diffMatch = line.match(/^diff --git a\/(.+) b\/(.+)$/);
    if (diffMatch) {
      pushCurrentFile();
      const oldPath = normalizeDiffPath(diffMatch[1] || "");
      const newPath = normalizeDiffPath(diffMatch[2] || "");
      const path = newPath || oldPath;
      const fileId = makeFileId(path, fileIndex++);
      currentFile = {
        id: fileId,
        path,
        oldPath,
        newPath,
        status: "edited",
        additions: 0,
        deletions: 0,
        diff: line,
        hunks: [],
        currentHunk: null,
        oldCursor: 0,
        newCursor: 0,
      };
      continue;
    }

    if (!currentFile) {
      continue;
    }

    currentFile.diff = `${currentFile.diff}\n${line}`;

    if (line.startsWith("new file mode")) {
      currentFile.status = "created";
      continue;
    }

    if (line.startsWith("deleted file mode")) {
      currentFile.status = "deleted";
      continue;
    }

    if (line.startsWith("rename from ")) {
      currentFile.status = "renamed";
      currentFile.oldPath = normalizeDiffPath(line.slice("rename from ".length));
      continue;
    }

    if (line.startsWith("rename to ")) {
      currentFile.status = "renamed";
      currentFile.newPath = normalizeDiffPath(line.slice("rename to ".length));
      currentFile.path = currentFile.newPath || currentFile.path;
      continue;
    }

    const oldFileMatch = line.match(/^---\s+(.+)$/);
    if (oldFileMatch) {
      currentFile.oldPath = normalizeDiffPath(oldFileMatch[1] || "");
      if (currentFile.oldPath === "/dev/null") {
        currentFile.oldPath = "";
      }
      continue;
    }

    const newFileMatch = line.match(/^\+\+\+\s+(.+)$/);
    if (newFileMatch) {
      currentFile.newPath = normalizeDiffPath(newFileMatch[1] || "");
      if (currentFile.newPath === "/dev/null") {
        currentFile.newPath = "";
      }
      currentFile.path = currentFile.newPath || currentFile.oldPath || currentFile.path;
      continue;
    }

    const hunkMatch = line.match(HUNK_HEADER_REGEX);
    if (hunkMatch?.groups) {
      flushCurrentHunk(currentFile);
      const oldStart = Number.parseInt(hunkMatch.groups.oldStart || "0", 10);
      const oldLines = Number.parseInt(hunkMatch.groups.oldLines || "1", 10);
      const newStart = Number.parseInt(hunkMatch.groups.newStart || "0", 10);
      const newLines = Number.parseInt(hunkMatch.groups.newLines || "1", 10);
      currentFile.oldCursor = oldStart;
      currentFile.newCursor = newStart;
      currentFile.currentHunk = {
        id: makeHunkId(currentFile.id, currentFile.hunks.length),
        header: line,
        oldStart,
        oldLines,
        newStart,
        newLines,
        lines: [],
      };
      continue;
    }

    if (!currentFile.currentHunk) {
      continue;
    }

    if (line.startsWith("+") && !line.startsWith("+++")) {
      currentFile.additions += 1;
      currentFile.currentHunk.lines.push({
        id: `${currentFile.currentHunk.id}-line-${currentFile.currentHunk.lines.length}`,
        type: "addition",
        content: line,
        oldLineNumber: null,
        newLineNumber: currentFile.newCursor,
      });
      currentFile.newCursor += 1;
      continue;
    }

    if (line.startsWith("-") && !line.startsWith("---")) {
      currentFile.deletions += 1;
      currentFile.currentHunk.lines.push({
        id: `${currentFile.currentHunk.id}-line-${currentFile.currentHunk.lines.length}`,
        type: "deletion",
        content: line,
        oldLineNumber: currentFile.oldCursor,
        newLineNumber: null,
      });
      currentFile.oldCursor += 1;
      continue;
    }

    if (line.startsWith("\\")) {
      currentFile.currentHunk.lines.push({
        id: `${currentFile.currentHunk.id}-line-${currentFile.currentHunk.lines.length}`,
        type: "context",
        content: line,
        oldLineNumber: null,
        newLineNumber: null,
      });
      continue;
    }

    currentFile.currentHunk.lines.push({
      id: `${currentFile.currentHunk.id}-line-${currentFile.currentHunk.lines.length}`,
      type: "context",
      content: line,
      oldLineNumber: currentFile.oldCursor,
      newLineNumber: currentFile.newCursor,
    });
    currentFile.oldCursor += 1;
    currentFile.newCursor += 1;
  }

  pushCurrentFile();

  return files.map((file, index) => ({
    ...file,
    id: file.id || makeFileId(file.path, index),
    path: file.path || file.newPath || file.oldPath || `file-${index + 1}`,
  }));
}

export function summarizeParsedDiff(files: ParsedDiffFile[]) {
  return files.reduce(
    (acc, file) => {
      acc.files += 1;
      acc.additions += file.additions;
      acc.deletions += file.deletions;
      return acc;
    },
    { files: 0, additions: 0, deletions: 0 },
  );
}
