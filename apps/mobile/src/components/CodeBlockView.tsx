import React, { useState } from "react";
import { Clipboard, Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  language: string;
  code: string;
};


export function CodeBlockView({ language, code }: Props) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    Clipboard.setString(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <View style={styles.container}>
      {/* Header bar with language and copy button */}
      <View style={styles.header}>
        <Text style={styles.languageLabel}>{language || "code"}</Text>
        <Pressable onPress={handleCopy} style={styles.copyButton}>
          <Text style={styles.copyButtonText}>
            {copied ? "Copied!" : "Copy"}
          </Text>
        </Pressable>
      </View>

      {/* Code content */}
      <View style={styles.codeContainer}>
        <Text style={styles.code} selectable>
          {code}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: "#1a1a1a", // quaternarySystemFill equivalent
  },
  languageLabel: {
    color: "#9f9f9f",
    fontSize: 12,
    fontFamily: "monospace",
    textTransform: "lowercase",
  },
  copyButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  copyButtonText: {
    color: "#6fdc8c",
    fontSize: 12,
    fontWeight: "600",
  },
  codeContainer: {
    backgroundColor: "#141414", // tertiarySystemGroupedBackground equivalent
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  code: {
    color: "#e5e5e5",
    fontSize: 13,
    fontFamily: "monospace",
    lineHeight: 18,
  },
});
