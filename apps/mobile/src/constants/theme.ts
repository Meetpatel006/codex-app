/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import "@/global.css";

import { Platform } from "react-native";

export const Colors = {
  light: {
    text: "#000000",
    background: "#ffffff",
    backgroundElement: "#F0F0F3",
    backgroundSelected: "#E0E1E6",
    textSecondary: "#60646C",
    // Chat message colors
    userBubble: "#2F4F8F",
    userBubbleBorder: "rgba(0, 0, 0, 0.08)",
    userText: "#ffffff",
    assistantText: "#000000",
    systemText: "#60646C",
    // Code block colors
    codeBackground: "#F5F5F5",
    codeHeaderBackground: "#E8E8E8",
    codeText: "#1a1a1a",
    codeBorder: "#D0D0D0",
    // Mention colors
    fileMention: "#0066CC",
    skillMention: "#8B5CF6",
    linkColor: "#0066CC",
    // Diff colors
    diffAdditionBg: "#E6F7E6",
    diffAdditionText: "#1E7E34",
    diffDeletionBg: "#FFEAEA",
    diffDeletionText: "#C62828",
    diffHunkBg: "#E3F2FD",
    diffHunkText: "#1976D2",
    diffMetaBg: "#F5F5F5",
    diffMetaText: "#757575",
    // Status colors
    successColor: "#1E7E34",
    errorColor: "#C62828",
    warningColor: "#F57C00",
  },
  dark: {
    text: "#ffffff",
    background: "#000000",
    backgroundElement: "#212225",
    backgroundSelected: "#2E3135",
    textSecondary: "#B0B4BA",
    // Chat message colors
    userBubble: "rgba(47, 79, 143, 0.8)",
    userBubbleBorder: "rgba(255, 255, 255, 0.08)",
    userText: "#f5f5f5",
    assistantText: "#f5f5f5",
    systemText: "#9f9f9f",
    // Code block colors
    codeBackground: "#141414",
    codeHeaderBackground: "#1a1a1a",
    codeText: "#e5e5e5",
    codeBorder: "#2a2a2a",
    // Mention colors
    fileMention: "#7fc7ff",
    skillMention: "#d4a5ff",
    linkColor: "#7fc7ff",
    // Diff colors
    diffAdditionBg: "#1a3a1a",
    diffAdditionText: "#6fdc8c",
    diffDeletionBg: "#3a1a1a",
    diffDeletionText: "#ff9d9d",
    diffHunkBg: "#1a2a3a",
    diffHunkText: "#7fc7ff",
    diffMetaBg: "#1a1a1a",
    diffMetaText: "#9f9f9f",
    // Status colors
    successColor: "#6fdc8c",
    errorColor: "#ff9d9d",
    warningColor: "#ffb86c",
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "var(--font-display)",
    serif: "var(--font-serif)",
    rounded: "var(--font-rounded)",
    mono: "var(--font-mono)",
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
