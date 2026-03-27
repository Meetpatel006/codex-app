import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/hooks/use-theme";

type Props = {
  title: string;
  onApprove: () => void;
  onReject: () => void;
};

export function ApprovalCard({ title, onApprove, onReject }: Props) {
  const colors = useTheme();
  const themedStyles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={themedStyles.card}>
      <Text style={themedStyles.title}>{title}</Text>
      <View style={themedStyles.actions}>
        <Pressable onPress={onReject} style={[themedStyles.button, themedStyles.rejectButton]}>
          <Text style={themedStyles.buttonText}>Reject</Text>
        </Pressable>
        <Pressable onPress={onApprove} style={[themedStyles.button, themedStyles.approveButton]}>
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
      borderColor: colors.codeBorder,
      borderRadius: 14,
      padding: 16,
      backgroundColor: colors.backgroundElement,
      gap: 12,
    },
    title: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "600",
    },
    actions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 10,
    },
    button: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 10,
    },
    rejectButton: {
      backgroundColor: colors.errorColor + "22", // Semi-transparent
      borderWidth: 1,
      borderColor: colors.errorColor,
    },
    approveButton: {
      backgroundColor: colors.successColor + "22", // Semi-transparent
      borderWidth: 1,
      borderColor: colors.successColor,
    },
    buttonText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "600",
    },
  });

