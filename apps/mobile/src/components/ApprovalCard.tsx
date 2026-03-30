import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useTheme } from "@/hooks/use-theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getVscodeIconUrlForEntry } from "@/utils/vscode-icons";

type Props = {
  title: string;
  command?: string;
  workingDirectory?: string;
  filePaths?: string[];
  pending?: boolean;
  fullWidth?: boolean;
  onApprove: () => void;
  onReject: () => void;
};

export function ApprovalCard({
  title,
  command,
  workingDirectory,
  filePaths,
  pending = false,
  fullWidth = false,
  onApprove,
  onReject,
}: Props) {
  const colors = useTheme();
  const colorScheme = useColorScheme();
  const themedStyles = useMemo(() => createStyles(colors), [colors]);
  const isDark = colors.background === "#000000";
  const cardBackground = isDark ? "#1c1c1d" : "#f7f7f8";
  const cardBorder = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)";
  const surface = isDark ? "#262729" : colors.backgroundElement;
  const approveFill = isDark ? "#059669" : "#16A34A";
  const approvePressed = isDark ? "#047857" : "#15803D";
  const rejectFill = "#E11D48";
  const rejectPressed = "#BE123C";

  return (
    <View
      style={[
        themedStyles.card,
        {
          backgroundColor: cardBackground,
          borderColor: cardBorder,
        },
        fullWidth && themedStyles.fullWidthCard,
      ]}
    >
      <View style={themedStyles.header}>
        <Text style={themedStyles.title}>{title}</Text>
      </View>
      {command ? (
        <View style={[themedStyles.commandBlock, { backgroundColor: surface }]}>
          <Text style={themedStyles.commandText} numberOfLines={2}>
            {command}
          </Text>
          {workingDirectory ? (
            <Text style={themedStyles.cwdText} numberOfLines={1}>
              {workingDirectory}
            </Text>
          ) : null}

          {Array.isArray(filePaths) && filePaths.length > 0 ? (
            <View style={themedStyles.fileList}>
              {filePaths.slice(0, 3).map((filePath) => {
                const normalized = filePath.replace(/\\/g, "/");
                const parts = normalized.split("/").filter(Boolean);
                const name = parts[parts.length - 1] || normalized;
                return (
                  <View key={filePath} style={themedStyles.fileRow}>
                    <Image
                      source={getVscodeIconUrlForEntry(
                        normalized,
                        "file",
                        colorScheme === "dark" ? "dark" : "light",
                      )}
                      style={themedStyles.fileIcon}
                      contentFit="contain"
                    />
                    <Text style={themedStyles.fileName} numberOfLines={1}>
                      {name}
                    </Text>
                  </View>
                );
              })}
              {filePaths.length > 3 ? (
                <Text style={themedStyles.moreFiles}>
                  +{filePaths.length - 3} more
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
      <View style={themedStyles.actions}>
        <Pressable
          onPress={onReject}
          disabled={pending}
          style={({ pressed }) => [
            themedStyles.button,
            themedStyles.rejectButton,
            {
              backgroundColor: pressed ? rejectPressed : rejectFill,
            },
            pressed && themedStyles.buttonPressed,
            pending && themedStyles.disabled,
          ]}
        >
          <Text style={themedStyles.buttonText}>Reject</Text>
        </Pressable>
        <Pressable
          onPress={onApprove}
          disabled={pending}
          style={({ pressed }) => [
            themedStyles.button,
            themedStyles.approveButton,
            {
              backgroundColor: pressed ? approvePressed : approveFill,
            },
            pressed && themedStyles.buttonPressed,
            pending && themedStyles.disabled,
          ]}
        >
          <Text style={themedStyles.buttonText}>Approve</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    card: {
      borderWidth: 1,
      borderRadius: 18,
      padding: 8,
      minWidth: 212,
      maxWidth: 520,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: 0.28,
      shadowRadius: 24,
      elevation: 14,
      gap: 8,
    },
    fullWidthCard: {
      width: "100%",
      minWidth: 0,
      maxWidth: undefined,
    },
    header: {
      paddingHorizontal: 12,
      paddingTop: 8,
    },
    title: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "600",
    },
    commandBlock: {
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 6,
      borderWidth: 1,
      borderColor: colors.codeBorder,
    },
    commandText: {
      color: colors.text,
      fontSize: 13,
      lineHeight: 18,
      fontFamily: "monospace",
    },
    fileList: {
      marginTop: 4,
      gap: 6,
      borderTopWidth: 1,
      borderTopColor: colors.codeBorder,
      paddingTop: 8,
    },
    fileRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    fileIcon: {
      width: 14,
      height: 14,
    },
    fileName: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "600",
      flex: 1,
      minWidth: 0,
      fontFamily: "monospace",
    },
    moreFiles: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "600",
    },
    cwdText: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    actions: {
      flexDirection: "row",
      gap: 8,
    },
    button: {
      flex: 1,
      minHeight: 44,
      paddingVertical: 9,
      paddingHorizontal: 12,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    rejectButton: {
      borderWidth: 0,
    },
    approveButton: {
      borderWidth: 0,
    },
    buttonText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "600",
    },
    buttonPressed: {
      opacity: 0.85,
    },
    disabled: {
      opacity: 0.6,
    },
  });
