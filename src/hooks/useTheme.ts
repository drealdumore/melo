/**
 * useTheme exposes the active palette plus the layout and motion tokens needed
 * on nearly every screen. It follows the system appearance.
 *
 * The native root background is deliberately *not* set here — this hook runs in
 * dozens of components, and the call belongs once at the app shell.
 */

import { useColorScheme } from 'react-native';

import { palettes, withAlpha, type ColorScheme, type Colors } from '@/theme/colors';
import {
  duration,
  springConfig,
  pressScale,
} from '@/theme/motion';
import { radii, spacing, screenPadding, hitSize, sizes } from '@/theme/layout';
import { typography, fontFamily } from '@/theme/typography';

export interface Theme {
  scheme: ColorScheme;
  colors: Colors;
  spacing: typeof spacing;
  screenPadding: typeof screenPadding;
  radii: typeof radii;
  hitSize: typeof hitSize;
  sizes: typeof sizes;
  typography: typeof typography;
  fontFamily: typeof fontFamily;
  duration: typeof duration;
  springConfig: typeof springConfig;
  pressScale: typeof pressScale;
  /** Derive a translucent version of any token. */
  alpha: (color: string, value: number) => string;
  isDark: boolean;
}

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const colorScheme: ColorScheme = scheme === 'dark' ? 'dark' : 'light';
  const colors = palettes[colorScheme];

  return {
    scheme: colorScheme,
    colors,
    spacing,
    screenPadding,
    radii,
    hitSize,
    sizes,
    typography,
    fontFamily,
    duration,
    springConfig,
    pressScale,
    alpha: withAlpha,
    isDark: colorScheme === 'dark',
  };
}
