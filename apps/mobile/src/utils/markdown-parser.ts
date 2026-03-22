
export type MarkdownSegment =
  | { type: "prose"; content: string }
  | { type: "codeBlock"; language: string; content: string; isDiff?: boolean };

export function parseMarkdownSegments(text: string): MarkdownSegment[] {
  const segments: MarkdownSegment[] = [];
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Check for fenced code block
    const fenceMatch = line.match(/^```(\w*)/);
    if (fenceMatch) {
      const language = fenceMatch[1] || "";
      const codeLines: string[] = [];
      i++; // Skip opening fence

      // Collect code block content
      while (i < lines.length && !lines[i].startsWith("```")) {
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

      i++; // Skip closing fence
      continue;
    }

    // Collect prose until next code block
    const proseLines: string[] = [];
    while (i < lines.length && !lines[i].startsWith("```")) {
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
