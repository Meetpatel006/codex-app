import { useMemo } from "react";
import { useColorScheme } from "./use-color-scheme";
import {
  Colors,
  DefaultFontConfig,
  getNormalFont,
  getMonoFont,
  getDisplayFont,
  Typography,
  type FontConfig,
} from "@/constants/theme";

export interface TypographyTokens {
  colors: typeof Colors.light;
  fonts: {
    normal: string;
    mono: string;
    display: string;
  };
  sizes: {
    xs: number;
    sm: number;
    base: number;
    lg: number;
    xl: number;
    "2xl": number;
    "3xl": number;
    "4xl": number;
  };
}

export function useTheme() {
  const scheme = useColorScheme();
  const theme = scheme === "unspecified" ? "light" : scheme;

  return Colors[theme];
}

export function useFontConfig(config: FontConfig = DefaultFontConfig) {
  return useMemo(
    () => ({
      normal: getNormalFont(config),
      mono: getMonoFont(config),
      display: getDisplayFont(config),
    }),
    [config],
  );
}

export function useTypography(config: FontConfig = DefaultFontConfig) {
  const fonts = useFontConfig(config);

  return useMemo(
    () => ({
      h1: Typography.h1(fonts.display),
      h2: Typography.h2(fonts.display),
      h3: Typography.h3(fonts.normal),
      body: Typography.body(fonts.normal),
      bodySmall: Typography.bodySmall(fonts.normal),
      caption: Typography.caption(fonts.normal),
      code: Typography.code(fonts.mono),
      codeSmall: Typography.codeSmall(fonts.mono),
      button: Typography.button(fonts.normal),
      label: Typography.label(fonts.normal),
    }),
    [fonts],
  );
}

export function useTypographyTokens() {
  const scheme = useColorScheme();
  const theme = scheme === "unspecified" ? "light" : scheme;
  const fonts = useFontConfig();

  return useMemo(
    () => ({
      colors: Colors[theme],
      fonts,
      sizes: {
        xs: 11,
        sm: 13,
        base: 15,
        lg: 17,
        xl: 20,
        "2xl": 24,
        "3xl": 28,
        "4xl": 32,
      },
    }),
    [theme, fonts],
  );
}
