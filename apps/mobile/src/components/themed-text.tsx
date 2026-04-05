import { StyleSheet, Text, type TextProps } from "react-native";

import { FontFamilies, ThemeColor } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type ThemedTextProps = TextProps & {
  type?:
    | "default"
    | "title"
    | "small"
    | "smallBold"
    | "subtitle"
    | "link"
    | "linkPrimary"
    | "code";
  themeColor?: ThemeColor;
};

export function ThemedText({
  style,
  type = "default",
  themeColor,
  ...rest
}: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? "text"] },
        type === "default" && styles.default,
        type === "title" && styles.title,
        type === "small" && styles.small,
        type === "smallBold" && styles.smallBold,
        type === "subtitle" && styles.subtitle,
        type === "link" && styles.link,
        type === "linkPrimary" && styles.linkPrimary,
        type === "code" && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    fontFamily: FontFamilies.normal.ibmPlexSans,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    fontFamily: FontFamilies.normal.ibmPlexSans,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
    fontFamily: FontFamilies.normal.ibmPlexSans,
  },
  title: {
    fontSize: 48,
    fontWeight: "600",
    lineHeight: 52,
    fontFamily: FontFamilies.display.spaceGrotesk,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
    fontWeight: "600",
    fontFamily: FontFamilies.display.spaceGrotesk,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
    fontFamily: FontFamilies.normal.ibmPlexSans,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    color: "#3c87f7",
    fontFamily: FontFamilies.normal.ibmPlexSans,
  },
  code: {
    fontFamily: FontFamilies.mono.jetBrainsMono,
    fontWeight: "500",
    fontSize: 12,
  },
});
