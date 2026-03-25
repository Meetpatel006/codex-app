export type MarkdownSegment =
  | { type: "prose"; content: string }
  | { type: "codeBlock"; language: string; content: string; isDiff?: boolean };

export function parseMarkdownSegments(text: string): MarkdownSegment[] {
  const segments: MarkdownSegment[] = [];
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})(.*)$/);

    if (fenceMatch) {
      const openingFence = fenceMatch[1];
      const info = fenceMatch[2].trim();
      const language = info ? info.split(/\s+/)[0] : "";
      const fenceChar = openingFence[0];
      const minFenceLength = openingFence.length;
      const codeLines: string[] = [];
      i++;

      const closingFenceRegex = new RegExp(
        `^\\s*${fenceChar}{${minFenceLength},}\\s*$`,
      );

      while (i < lines.length && !closingFenceRegex.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }

      const codeContent = codeLines.join("\n");
      const isDiff = detectDiff(codeContent);

      segments.push({
        type: "codeBlock",
        language,
        content: codeContent,
        isDiff,
      });

      if (i < lines.length) {
        i++;
      }
      continue;
    }

    const proseLines: string[] = [];
    while (i < lines.length && !/^\s*(`{3,}|~{3,})(.*)$/.test(lines[i])) {
      proseLines.push(lines[i]);
      i++;
    }

    if (proseLines.length > 0) {
      const proseContent = proseLines.join("\n").trim();
      if (proseContent) {
        segments.push({
          type: "prose",
          content: proseContent,
        });
      }
    }
  }

  return segments;
}

function detectDiff(code: string): boolean {
  const lines = code.split("\n");
  let hasDiffMarkers = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.startsWith("@@") ||
      trimmed.startsWith("diff --git") ||
      trimmed.startsWith("index ") ||
      trimmed.startsWith("--- ") ||
      trimmed.startsWith("+++ ")
    ) {
      hasDiffMarkers = true;
      break;
    }
  }

  return hasDiffMarkers;
}

/**
 * Parse diff lines and classify them
 */
export type DiffLineKind =
  | "addition"
  | "deletion"
  | "hunk"
  | "meta"
  | "neutral";

export function parseDiffLine(line: string): {
  kind: DiffLineKind;
  content: string;
} {
  const trimmed = line.trim();

  if (trimmed.startsWith("@@")) {
    return { kind: "hunk", content: line };
  }

  if (
    trimmed.startsWith("diff --git") ||
    trimmed.startsWith("index ") ||
    trimmed.startsWith("--- ") ||
    trimmed.startsWith("+++ ")
  ) {
    return { kind: "meta", content: line };
  }

  if (line.startsWith("+")) {
    return { kind: "addition", content: line };
  }

  if (line.startsWith("-")) {
    return { kind: "deletion", content: line };
  }

  return { kind: "neutral", content: line };
}

/**
 * Sanitize and format inline mentions (@file, $skill)
 */
export function parseInlineMentions(text: string): Array<{
  type: "text" | "file" | "skill";
  content: string;
}> {
  const tokens: Array<{ type: "text" | "file" | "skill"; content: string }> =
    [];
  const regex = /(@[\w\-./]+|\$[\w\-]+)/g;
  let lastIndex = 0;

  let match;
  while ((match = regex.exec(text)) !== null) {
    // Add text before mention
    if (match.index > lastIndex) {
      tokens.push({
        type: "text",
        content: text.substring(lastIndex, match.index),
      });
    }

    // Add mention
    const mention = match[0];
    if (mention.startsWith("@")) {
      tokens.push({ type: "file", content: mention });
    } else if (mention.startsWith("$")) {
      tokens.push({ type: "skill", content: mention });
    }

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    tokens.push({
      type: "text",
      content: text.substring(lastIndex),
    });
  }

  return tokens.length > 0 ? tokens : [{ type: "text", content: text }];
}
