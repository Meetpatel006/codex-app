import React from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { parseInlineMentions } from "@/utils/markdown-parser";

type Props = {
  content: string;
};

type MarkdownToken =
  | { type: "text"; content: string }
  | { type: "bold"; content: string }
  | { type: "italic"; content: string }
  | { type: "code"; content: string }
  | { type: "link"; content: string; href: string }
  | { type: "file"; content: string }
  | { type: "skill"; content: string };

/**
 * Parse basic markdown formatting
 */
function parseMarkdownFormatting(text: string): MarkdownToken[] {
  const tokens: MarkdownToken[] = [];

  // First, parse mentions
  const mentionTokens = parseInlineMentions(text);

  // Then parse bold, italic, inline code within each mention token
  for (const mentionToken of mentionTokens) {
    if (mentionToken.type !== "text") {
      tokens.push(mentionToken);
      continue;
    }

    let content = mentionToken.content;
    let currentIndex = 0;

    while (currentIndex < content.length) {
      const linkMatch = content
        .slice(currentIndex)
        .match(/^\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        if (currentIndex > 0) {
          tokens.push({
            type: "text",
            content: content.slice(0, currentIndex),
          });
          content = content.slice(currentIndex);
          currentIndex = 0;
        }
        tokens.push({
          type: "link",
          content: linkMatch[1],
          href: linkMatch[2],
        });
        content = content.slice(linkMatch[0].length);
        continue;
      }

      // Bold: **text**
      const boldMatch = content.slice(currentIndex).match(/^\*\*(.+?)\*\*/);
      if (boldMatch) {
        if (currentIndex > 0) {
          tokens.push({
            type: "text",
            content: content.slice(0, currentIndex),
          });
          content = content.slice(currentIndex);
          currentIndex = 0;
        }
        tokens.push({ type: "bold", content: boldMatch[1] });
        content = content.slice(boldMatch[0].length);
        continue;
      }

      // Italic: *text* or _text_
      const italicMatch = content.slice(currentIndex).match(/^[*_](.+?)[*_]/);
      if (italicMatch) {
        if (currentIndex > 0) {
          tokens.push({
            type: "text",
            content: content.slice(0, currentIndex),
          });
          content = content.slice(currentIndex);
          currentIndex = 0;
        }
        tokens.push({ type: "italic", content: italicMatch[1] });
        content = content.slice(italicMatch[0].length);
        continue;
      }

      // Inline code: `text`
      const codeMatch = content.slice(currentIndex).match(/^`(.+?)`/);
      if (codeMatch) {
        if (currentIndex > 0) {
          tokens.push({
            type: "text",
            content: content.slice(0, currentIndex),
          });
          content = content.slice(currentIndex);
          currentIndex = 0;
        }
        tokens.push({ type: "code", content: codeMatch[1] });
        content = content.slice(codeMatch[0].length);
        continue;
      }

      currentIndex++;
    }

    if (content.length > 0) {
      tokens.push({ type: "text", content });
    }
  }

  return tokens;
}

/**
 * MarkdownText component for rendering prose segments
 * Handles markdown formatting, inline mentions (@file, $skill)
 */
export function MarkdownText({ content }: Props) {
  const lines = content.split("\n");

  return (
    <View style={styles.container}>
      {lines.map((line, lineIndex) => {
        // Header: ### text
        const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headerMatch) {
          const level = headerMatch[1].length;
          const headerText = headerMatch[2];
          return (
            <Text
              key={lineIndex}
              style={[
                styles.text,
                level === 1 && styles.header1,
                level === 2 && styles.header2,
                level >= 3 && styles.header3,
              ]}
            >
              {headerText}
            </Text>
          );
        }

        // List item: - text or * text
        const listMatch = line.match(/^[-*]\s+(.+)$/);
        if (listMatch) {
          const listText = listMatch[1];
          const tokens = parseMarkdownFormatting(listText);
          return (
            <View key={lineIndex} style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>
                {tokens.map((token, tokenIndex) =>
                  renderToken(token, tokenIndex),
                )}
              </Text>
            </View>
          );
        }

        // Numbered list: 1. text
        const numberedListMatch = line.match(/^(\d+)\.\s+(.+)$/);
        if (numberedListMatch) {
          const number = numberedListMatch[1];
          const listText = numberedListMatch[2];
          const tokens = parseMarkdownFormatting(listText);
          return (
            <View key={lineIndex} style={styles.listItem}>
              <Text style={styles.bullet}>{number}.</Text>
              <Text style={styles.text}>
                {tokens.map((token, tokenIndex) =>
                  renderToken(token, tokenIndex),
                )}
              </Text>
            </View>
          );
        }

        // Regular text
        if (line.trim()) {
          const tokens = parseMarkdownFormatting(line);
          return (
            <Text key={lineIndex} style={styles.text}>
              {tokens.map((token, tokenIndex) =>
                renderToken(token, tokenIndex),
              )}
            </Text>
          );
        }

        // Empty line
        return <View key={lineIndex} style={styles.emptyLine} />;
      })}
    </View>
  );
}

function renderToken(token: MarkdownToken, index: number): React.ReactNode {
  switch (token.type) {
    case "bold":
      return (
        <Text key={index} style={styles.bold}>
          {token.content}
        </Text>
      );
    case "italic":
      return (
        <Text key={index} style={styles.italic}>
          {token.content}
        </Text>
      );
    case "code":
      return (
        <Text key={index} style={styles.inlineCode}>
          {token.content}
        </Text>
      );
    case "link":
      return (
        <Text
          key={index}
          style={styles.link}
          onPress={() => {
            if (/^https?:\/\//i.test(token.href)) {
              void Linking.openURL(token.href);
            }
          }}
        >
          {token.content}
        </Text>
      );
    case "file":
      return (
        <Text key={index} style={styles.fileMention}>
          {token.content}
        </Text>
      );
    case "skill":
      return (
        <Text key={index} style={styles.skillMention}>
          {token.content}
        </Text>
      );
    default:
      return <Text key={index}>{token.content}</Text>;
  }
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  text: {
    color: "#f5f5f5",
    fontSize: 14,
    lineHeight: 20,
  },
  header1: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 4,
  },
  header2: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 6,
    marginBottom: 3,
  },
  header3: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 4,
    marginBottom: 2,
  },
  listItem: {
    flexDirection: "row",
    marginVertical: 2,
    paddingLeft: 8,
  },
  bullet: {
    color: "#f5f5f5",
    fontSize: 14,
    lineHeight: 20,
    marginRight: 8,
    minWidth: 20,
  },
  emptyLine: {
    height: 8,
  },
  bold: {
    fontWeight: "700",
  },
  italic: {
    fontStyle: "italic",
  },
  inlineCode: {
    fontFamily: "monospace",
    backgroundColor: "#2a2a2a",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    color: "#e5e5e5",
    fontSize: 13,
  },
  link: {
    color: "#7fc7ff",
    textDecorationLine: "underline",
  },
  fileMention: {
    color: "#7fc7ff", // Cyan for file mentions
    fontWeight: "500",
  },
  skillMention: {
    color: "#d4a5ff", // Purple for skill mentions
    fontWeight: "500",
  },
});
