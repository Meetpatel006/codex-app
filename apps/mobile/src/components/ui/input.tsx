import React from "react";
import { TextInput, StyleSheet, TextInputProps } from "react-native";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";

export interface InputProps extends TextInputProps {}

export function Input({ style, ...props }: InputProps) {
  const theme = useTheme();

  return (
    <TextInput
      style={[
        styles.input,
        {
          color: theme.text,
        },
        style,
      ]}
      placeholderTextColor={theme.textSecondary}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 48,
    fontSize: 16,
    paddingHorizontal: Spacing.three,
  },
});
