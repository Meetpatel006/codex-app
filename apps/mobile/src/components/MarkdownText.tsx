import React, { useMemo } from "react";
import {
  Linking,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  View,
} from "react-native";
import { parseInlineMentions } from "@/utils/markdown-parser";
import { useTheme } from "@/hooks/use-theme";

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

type MarkdownBlock =
  | { type: "paragraph"; content: string }
  | { type: "heading"; level: number; content: string }
  | {
      type: "listItem";
      variant: "bullet" | "ordered" | "task";
      content: string;
      depth: number;
      marker?: string;
      checked?: boolean;
    }
  | { type: "quote"; content: string }
  | { type: "rule" };

function parseMarkdownFormatting(text: string): MarkdownToken[] {
  const tokens: MarkdownToken[] = [];
  const mentionTokens = parseInlineMentions(text);

  for (const mentionToken of mentionTokens) {
    if (mentionToken.type !== "text") {
      tokens.push(mentionToken);
      continue;
    }

    let remaining = mentionToken.content;
    let plainText = "";

    const flushPlainText = () => {
      if (!plainText) {
        return;
      }
      tokens.push({ type: "text", content: plainText });
      plainText = "";
    };

    while (remaining.length > 0) {
      const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        flushPlainText();
        tokens.push({
          type: "link",
          content: linkMatch[1],
          href: linkMatch[2].trim(),
        });
        remaining = remaining.slice(linkMatch[0].length);
        continue;
      }

      const codeMatch = remaining.match(/^`([^`]+)`/);
      if (codeMatch) {
        flushPlainText();
        tokens.push({ type: "code", content: codeMatch[1] });
        remaining = remaining.slice(codeMatch[0].length);
        continue;
      }

      const boldMatch = remaining.match(/^\*\*([^*][\s\S]*?)\*\*/);
      if (boldMatch) {
        flushPlainText();
        tokens.push({ type: "bold", content: boldMatch[1] });
        remaining = remaining.slice(boldMatch[0].length);
        continue;
      }

      const italicMatch = remaining.match(/^\*([^*\n]+)\*|^_([^_\n]+)_/);
      if (italicMatch) {
        flushPlainText();
        tokens.push({
          type: "italic",
          content: italicMatch[1] || italicMatch[2],
        });
        remaining = remaining.slice(italicMatch[0].length);
        continue;
      }

      const autolinkMatch = remaining.match(/^(https?:\/\/[^\s)]+)/i);
      if (autolinkMatch) {
        flushPlainText();
        tokens.push({
          type: "link",
          content: autolinkMatch[1],
          href: autolinkMatch[1],
        });
        remaining = remaining.slice(autolinkMatch[0].length);
        continue;
      }

      plainText += remaining[0];
      remaining = remaining.slice(1);
    }

    flushPlainText();
  }

  return tokens;
}

function buildMarkdownBlocks(content: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = content.split("\n");
  const paragraphLines: string[] = [];

  function lineIndent(line: string): number {
    const expanded = line.replace(/\t/g, "  ");
    const match = expanded.match(/^\s*/);
    return match ? match[0].length : 0;
  }

  function isHeading(trimmed: string): boolean {
    return /^(#{1,6})\s+.+$/.test(trimmed);
  }

  function isRule(trimmed: string): boolean {
    return /^([-*_])\1{2,}$/.test(trimmed);
  }

  function isQuote(trimmed: string): boolean {
    return trimmed.startsWith(">");
  }

  function isList(trimmed: string): boolean {
    return /^([-+*])\s+.+$/.test(trimmed) || /^(\d+)\.\s+.+$/.test(trimmed);
  }

  function isBlockBoundary(trimmed: string): boolean {
    return (
      isHeading(trimmed) ||
      isRule(trimmed) ||
      isQuote(trimmed) ||
      isList(trimmed)
    );
  }

  function flushParagraph() {
    if (paragraphLines.length === 0) {
      return;
    }

    blocks.push({
      type: "paragraph",
      content: paragraphLines.join(" ").trim(),
    });
    paragraphLines.length = 0;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      flushParagraph();
      blocks.push({
        type: "heading",
        level: headerMatch[1].length,
        content: headerMatch[2],
      });
      continue;
    }

    if (isRule(trimmed)) {
      flushParagraph();
      blocks.push({ type: "rule" });
      continue;
    }

    if (isQuote(trimmed)) {
      flushParagraph();
      const quoteLines: string[] = [];
      while (i < lines.length) {
        const quoteLine = lines[i].trim();
        if (!quoteLine.startsWith(">")) {
          i--;
          break;
        }
        quoteLines.push(quoteLine.replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({
        type: "quote",
        content: quoteLines.join(" ").trim(),
      });
      continue;
    }

    const listMatch = line.match(/^(\s*)([-+*]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      flushParagraph();

      const indent = Math.max(0, lineIndent(listMatch[1]));
      const depth = Math.min(6, Math.floor(indent / 2));
      const markerToken = listMatch[2];
      let itemContent = listMatch[3].trim();

      const taskMatch = itemContent.match(/^\[([ xX])\]\s+(.+)$/);
      if (taskMatch && /^[-+*]$/.test(markerToken)) {
        itemContent = taskMatch[2];
      }

      while (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const nextTrimmed = nextLine.trim();
        if (!nextTrimmed) {
          break;
        }

        const nextIndent = lineIndent(nextLine);
        if (isBlockBoundary(nextTrimmed) && nextIndent <= indent) {
          break;
        }

        itemContent += ` ${nextTrimmed}`;
        i++;
      }

      if (taskMatch && /^[-+*]$/.test(markerToken)) {
        blocks.push({
          type: "listItem",
          variant: "task",
          content: itemContent,
          checked: taskMatch[1].toLowerCase() === "x",
          depth,
        });
        continue;
      }

      if (/^\d+\.$/.test(markerToken)) {
        blocks.push({
          type: "listItem",
          variant: "ordered",
          marker: markerToken,
          content: itemContent,
          depth,
        });
        continue;
      }

      blocks.push({
        type: "listItem",
        variant: "bullet",
        marker: "•",
        content: itemContent,
        depth,
      });
      continue;
    }

    paragraphLines.push(trimmed);
  }

  flushParagraph();
  return blocks;
}

export function MarkdownText({ content }: Props) {
  const colors = useTheme();
  const themedStyles = useMemo(() => createStyles(colors), [colors]);
  const blocks = useMemo(() => buildMarkdownBlocks(content), [content]);

  return (
    <View style={themedStyles.container}>
      {blocks.map((block, index) => {
        const isLastBlock = index === blocks.length - 1;

        if (block.type === "heading") {
          const headingStyle =
            block.level === 1
              ? themedStyles.header1
              : block.level === 2
                ? themedStyles.header2
                : themedStyles.header3;

          return (
            <View
              key={index}
              style={[themedStyles.block, isLastBlock && themedStyles.lastBlock]}
            >
              {renderInlineTokens(
                parseMarkdownFormatting(block.content),
                themedStyles,
                [themedStyles.text, headingStyle],
              )}
            </View>
          );
        }

        if (block.type === "listItem") {
          const marker =
            block.variant === "task"
              ? block.checked
                ? "[x]"
                : "[ ]"
              : (block.marker ?? "•");
          const listDepthStyle = {
            paddingLeft: block.depth * 16,
          };

          const previousIsList =
            index > 0 && blocks[index - 1]?.type === "listItem";
          const nextIsList =
            index < blocks.length - 1 && blocks[index + 1]?.type === "listItem";

          return (
            <View
              key={index}
              style={[
                themedStyles.listItem,
                listDepthStyle,
                previousIsList && themedStyles.listItemTightTop,
                nextIsList && themedStyles.listItemTightBottom,
                isLastBlock && themedStyles.lastBlock,
              ]}
            >
              <Text
                style={[
                  themedStyles.bullet,
                  block.variant === "task" && themedStyles.taskMarker,
                  block.variant === "ordered" && themedStyles.orderedMarker,
                ]}
              >
                {marker}
              </Text>
              <View style={themedStyles.listText}>
                {renderInlineTokens(
                  parseMarkdownFormatting(block.content),
                  themedStyles,
                  themedStyles.text,
                )}
              </View>
            </View>
          );
        }

        if (block.type === "quote") {
          return (
            <View
              key={index}
              style={[
                themedStyles.quoteBlock,
                isLastBlock && themedStyles.lastBlock,
              ]}
            >
              <View>
                {renderInlineTokens(
                  parseMarkdownFormatting(block.content),
                  themedStyles,
                  [themedStyles.text, themedStyles.quoteText],
                )}
              </View>
            </View>
          );
        }

        if (block.type === "rule") {
          return (
            <View
              key={index}
              style={[themedStyles.rule, isLastBlock && themedStyles.lastBlock]}
            />
          );
        }

        return (
          <View
            key={index}
            style={[
              themedStyles.block,
              index > 0 &&
                blocks[index - 1]?.type === "paragraph" &&
                themedStyles.paragraphGap,
              isLastBlock && themedStyles.lastBlock,
            ]}
          >
            {renderInlineTokens(
              parseMarkdownFormatting(block.content),
              themedStyles,
              themedStyles.text,
            )}
          </View>
        );
      })}
    </View>
  );
}

function renderInlineTokens(
  tokens: MarkdownToken[],
  styles: ReturnType<typeof createStyles>,
  textStyle: StyleProp<TextStyle>,
) {
  return (
    <View style={styles.inlineFlow}>
      {tokens.flatMap((token, index) =>
        renderToken(token, index, styles, textStyle),
      )}
    </View>
  );
}

function renderToken(
  token: MarkdownToken,
  index: number,
  styles: ReturnType<typeof createStyles>,
  textStyle: StyleProp<TextStyle>,
): React.ReactNode | React.ReactNode[] {
  switch (token.type) {
    case "bold":
      return renderWrappedTextSegments(
        token.content,
        index,
        [textStyle, styles.bold],
      );
    case "italic":
      return renderWrappedTextSegments(
        token.content,
        index,
        [textStyle, styles.italic],
      );
    case "code":
      return (
        <View key={`code-${index}`} style={styles.inlineCode}>
          <Text style={[textStyle, styles.inlineCodeText]}>{token.content}</Text>
        </View>
      );
    case "link":
      return renderWrappedTextSegments(
        token.content,
        index,
        [textStyle, styles.link],
        () => {
          if (/^https?:\/\//i.test(token.href)) {
            void Linking.openURL(token.href);
          }
        },
      );
    case "file":
      return renderWrappedTextSegments(
        token.content,
        index,
        [textStyle, styles.fileMention],
      );
    case "skill":
      return renderWrappedTextSegments(
        token.content,
        index,
        [textStyle, styles.skillMention],
      );
    default:
      return renderWrappedTextSegments(
        token.content,
        index,
        [textStyle, styles.textInline],
      );
  }
}

function renderWrappedTextSegments(
  content: string,
  keyPrefix: number,
  style: StyleProp<TextStyle>,
  onPress?: () => void,
) {
  const segments = content.match(/\s+|\S+/g) ?? [content];

  return segments.map((segment, segmentIndex) => {
    if (/^\s+$/.test(segment)) {
      return (
        <View
          key={`${keyPrefix}-${segmentIndex}`}
          style={{
            width: Math.max(4, segment.length * 4),
            height: 1,
          }}
        />
      );
    }

    return (
      <Text
        key={`${keyPrefix}-${segmentIndex}`}
        style={style}
        onPress={onPress}
      >
        {segment}
      </Text>
    );
  });
}

const createStyles = (colors: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      marginVertical: 0,
    },
    text: {
      color: colors.assistantText,
      fontSize: 15,
      lineHeight: 24,
    },
    textInline: {
      color: colors.assistantText,
    },
    inlineFlow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
    },
    block: {
      marginBottom: 0,
    },
    paragraphGap: {
      marginTop: 8,
    },
    lastBlock: {
      marginBottom: 0,
    },
    header1: {
      fontSize: 24,
      lineHeight: 32,
      fontWeight: "700",
      marginTop: 0,
      marginBottom: 0,
      letterSpacing: -0.3,
    },
    header2: {
      fontSize: 21,
      lineHeight: 28,
      fontWeight: "700",
      marginTop: 0,
      marginBottom: 0,
      letterSpacing: -0.2,
    },
    header3: {
      fontSize: 18,
      lineHeight: 25,
      fontWeight: "600",
      marginTop: 0,
      marginBottom: 0,
    },
    listItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 0,
      paddingLeft: 2,
    },
    listItemTightTop: {
      marginTop: 0,
    },
    listItemTightBottom: {
      marginBottom: 0,
    },
    bullet: {
      color: colors.assistantText,
      fontSize: 15,
      lineHeight: 24,
      marginRight: 10,
      minWidth: 28,
      paddingTop: 1,
      textAlign: "right",
    },
    taskMarker: {
      fontFamily: "monospace",
      fontSize: 13,
    },
    orderedMarker: {
      minWidth: 34,
    },
    listText: {
      flex: 1,
      minWidth: 0,
    },
    quoteBlock: {
      marginBottom: 0,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderLeftWidth: 3,
      borderLeftColor: colors.backgroundSelected,
      backgroundColor: colors.backgroundElement,
      borderRadius: 10,
    },
    quoteText: {
      color: colors.textSecondary,
    },
    rule: {
      height: 1,
      marginVertical: 0,
      backgroundColor: colors.backgroundSelected,
    },
    bold: {
      fontWeight: "700",
    },
    italic: {
      fontStyle: "italic",
    },
    inlineCode: {
      backgroundColor: colors.codeHeaderBackground,
      borderWidth: 1,
      borderColor: colors.codeBorder,
      paddingHorizontal: 7,
      paddingVertical: 0.6,
      marginHorizontal: 0.6,
      marginVertical: 0.6,
      borderRadius: 999,
      overflow: "hidden",
      justifyContent: "center",
    },
    inlineCodeText: {
      color: colors.codeText,
      fontFamily: "monospace",
      fontSize: 12.5,
      lineHeight: 18,
      includeFontPadding: false,
      textAlignVertical: "center",
    },
    link: {
      color: colors.linkColor,
      textDecorationLine: "underline",
      textDecorationColor: colors.linkColor,
    },
    fileMention: {
      color: colors.fileMention,
      fontWeight: "500",
    },
    skillMention: {
      color: colors.skillMention,
      fontWeight: "500",
    },
  });
