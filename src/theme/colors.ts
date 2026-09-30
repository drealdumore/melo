export const brand = {
  ember: "#ff8a2b",
  sky: "#3E7BFA",
} as const;

export type ColorScheme = "light" | "dark";

export interface Colors {
  background: string;
  surface: string;
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

const light: Colors = {
  background: "#FAF9F7",
  surface: "#FFFFFF",
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

const dark: Colors = {
  background: "#0E0E10",
  surface: "#1A1A1D",
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
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
