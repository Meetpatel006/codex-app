import React, { useMemo, useState } from "react";
import { Clipboard, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/hooks/use-theme";

type Props = {
  language: string;
  code: string;
};

export function CodeBlockView({ language, code }: Props) {
  const colors = useTheme();
  const themedStyles = useMemo(() => createStyles(colors), [colors]);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    Clipboard.setString(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <View style={themedStyles.container}>
      {/* Header bar with language and copy button */}
      <View style={themedStyles.header}>
        <Text style={themedStyles.languageLabel}>{language || "code"}</Text>
        <Pressable onPress={handleCopy} style={themedStyles.copyButton}>
          <Text style={themedStyles.copyButtonText}>
            {copied ? "Copied!" : "Copy"}
          </Text>
        </Pressable>
      </View>

      {/* Code content */}
      <View style={themedStyles.codeContainer}>
        <Text style={themedStyles.code} selectable>
          {code}
        </Text>
      </View>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      borderRadius: 8,
      overflow: "hidden",
      marginVertical: 8,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.codeHeaderBackground,
    },
    languageLabel: {
      color: colors.textSecondary,
      fontSize: 12,
      fontFamily: "monospace",
      textTransform: "lowercase",
    },
    copyButton: {
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    copyButtonText: {
      color: colors.successColor,
      fontSize: 12,
      fontWeight: "600",
    },
    codeContainer: {
      backgroundColor: colors.codeBackground,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    code: {
      color: colors.codeText,
      fontSize: 13,
      fontFamily: "monospace",
      lineHeight: 18,
    },
  });
