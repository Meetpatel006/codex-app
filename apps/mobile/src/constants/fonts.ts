import { Platform } from "react-native";

const ANDROID = Platform.OS === "android";

export const FontFamilies = {
  normal: {
    ibmPlexSans: ANDROID ? "IBMPlexSans-Regular" : "IBM Plex Sans",
    system: Platform.select({
      ios: "System",
      default: "sans-serif",
    }) as string,
  },
  mono: {
    jetBrainsMono: ANDROID ? "JetBrainsMono-Regular" : "JetBrains Mono",
    menlo: Platform.select({
      ios: "Menlo",
      default: "monospace",
    }) as string,
  },
  display: {
    spaceGrotesk: ANDROID ? "SpaceGrotesk-Regular" : "Space Grotesk",
  },
} as const;

export type NormalFontId = keyof typeof FontFamilies.normal;
export type MonoFontId = keyof typeof FontFamilies.mono;
export type DisplayFontId = keyof typeof FontFamilies.display;

export const FontSizes = {
  xs: 11,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 20,
  "2xl": 24,
  "3xl": 28,
  "4xl": 32,
} as const;

export const FontWeights = {
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
};

export interface TypographyStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: "400" | "500" | "600" | "700" | "800";
  lineHeight?: number;
}

export const Typography = {
  h1: (fontFamily: string): TypographyStyle => ({
    fontFamily,
    fontSize: FontSizes["2xl"],
    fontWeight: FontWeights.bold,
    lineHeight: FontSizes["2xl"] * 1.2,
  }),
  h2: (fontFamily: string): TypographyStyle => ({
    fontFamily,
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    lineHeight: FontSizes.xl * 1.2,
  }),
  h3: (fontFamily: string): TypographyStyle => ({
    fontFamily,
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    lineHeight: FontSizes.lg * 1.3,
  }),
  body: (fontFamily: string): TypographyStyle => ({
    fontFamily,
    fontSize: FontSizes.base,
    fontWeight: FontWeights.regular,
    lineHeight: FontSizes.base * 1.5,
  }),
  bodySmall: (fontFamily: string): TypographyStyle => ({
    fontFamily,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.regular,
    lineHeight: FontSizes.sm * 1.5,
  }),
  caption: (fontFamily: string): TypographyStyle => ({
    fontFamily,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.regular,
    lineHeight: FontSizes.xs * 1.4,
  }),
  code: (fontFamily: string): TypographyStyle => ({
    fontFamily,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.regular,
    lineHeight: FontSizes.sm * 1.6,
  }),
  codeSmall: (fontFamily: string): TypographyStyle => ({
    fontFamily,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.regular,
    lineHeight: FontSizes.xs * 1.5,
  }),
  button: (fontFamily: string): TypographyStyle => ({
    fontFamily,
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    lineHeight: FontSizes.base * 1.2,
  }),
  label: (fontFamily: string): TypographyStyle => ({
    fontFamily,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    lineHeight: FontSizes.sm * 1.3,
  }),
} as const;
