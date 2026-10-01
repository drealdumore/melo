export const brand = {
  ember: "#ff8a2b",
  sky: "#3E7BFA",
} as const;

export type ColorScheme = "light" | "dark";

export interface Colors {
  background: string;
  surface: string;
  sheet: string;
  accent: string;
  accentTint: string;
  textPrimary: string;
  textMuted: string;
  border: string;
  info: string;
  success: string;
  danger: string;
  onAccent: string;
}

export const light: Colors = {
  background: "#FAF9F7",
  surface: "#FFFFFF",
  sheet: "#F2F0EC",
  accent: brand.ember,
  accentTint: "rgba(255, 106, 77, 0.12)",
  textPrimary: "#111114",
  textMuted: "#6E6E76",
  border: "#E6E3DD",
  info: brand.sky,
  success: "#22B573",
  danger: "#E5484D",
  onAccent: "#FFFFFF",
};

export const dark: Colors = {
  background: "#0E0E10",
  surface: "#1A1A1D",
  sheet: "#242428",
  accent: "#ff8a2b",
  accentTint: "rgba(255, 125, 99, 0.18)",
  textPrimary: "#F5F5F7",
  textMuted: "#9A9AA3",
  border: "#2C2C31",
  info: "#6C9CFF",
  success: "#2FCB84",
  danger: "#FF6369",
  onAccent: "#111114",
};

export const palettes: Record<ColorScheme, Colors> = { light, dark };

/**
 * Alpha variants of a token, for the places a color has to sit on a fill it does
 * not belong to — a dashed border, a ring, a burst dot. Derived, not branded.
 */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = channels(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function channels(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

/**
 * WCAG relative luminance, 0 (black) to 1 (white).
 *
 * Only meaningful for opaque colours: the system bars are transparent under
 * edge-to-edge, so they always sit on `colors.background` rather than on a
 * translucent token.
 */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const srgb = c / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The system-bar icon style that stays readable on `background`.
 *
 * Returns expo's vocabulary, where `'light'` means light *icons* for a dark UI —
 * which reads backwards, but matches `expo-navigation-bar`. React Native's own
 * `StatusBar` wants the same choice spelled `'light-content'` / `'dark-content'`,
 * so the shell maps between them.
 *
 * Deriving this from the painted colour rather than from the mode flag is what keeps
 * the clock and battery legible: a palette is free to pick a light background in dark
 * mode, or a dark one in light mode, and the icons follow the fill either way.
 *
 * The 0.5 threshold is where contrast against white and against black is roughly
 * equal; past it, dark icons win on light backgrounds and vice versa.
 */
export function barStyleFor(background: string): 'light' | 'dark' {
  return luminance(background) > 0.5 ? 'dark' : 'light';
}
