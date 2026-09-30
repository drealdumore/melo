/**
 * useTheme exposes the active palette plus the layout and motion tokens needed
 * on nearly every screen. It follows the system appearance and keeps the native
 * background in sync so screen transitions never flash the wrong color.
 */

import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import * as SystemUI from 'expo-system-ui';

import { palettes, withAlpha, type ColorScheme, type Colors } from '@/theme/colors';
import {
  duration,
  springConfig,
  entrance,
  pressScale,
  revealTilt,
  bubbleTilt,
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
  entrance: typeof entrance;
  pressScale: typeof pressScale;
  revealTilt: typeof revealTilt;
  bubbleTilt: typeof bubbleTilt;
  /** Derive a translucent version of any token. */
  alpha: (color: string, value: number) => string;
  isDark: boolean;
}

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const colorScheme: ColorScheme = scheme === 'dark' ? 'dark' : 'light';
  const colors = palettes[colorScheme];

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);

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
    entrance,
    pressScale,
    revealTilt,
    bubbleTilt,
    alpha: withAlpha,
    isDark: colorScheme === 'dark',
  };
}
