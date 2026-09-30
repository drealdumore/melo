/**
 * MeloMark — Concept A, "Two Bubbles".
 *
 * Two overlapping rounded speech bubbles: one solid, one outlined, tails
 * pointing in opposite directions. The overlap reads as a soft lowercase "m".
 *
 * The path data mirrors MARK in scripts/generate-assets.mjs, which rasterizes
 * the exact same geometry into the app icon, splash and monochrome assets.
 * Change one, change the other.
 */
import { memo } from 'react';
import Svg, { Path } from 'react-native-svg';

import { brand } from '@/theme/colors';

const SOLID_PATH =
  'M 13 9 H 29 A 10 10 0 0 1 39 19 V 25 A 10 10 0 0 1 29 35 H 13 A 10 10 0 0 1 3 25 V 19 A 10 10 0 0 1 13 9 Z M 11 32 L 8 45 L 22 32 Z';
const OUTLINE_BODY_PATH =
  'M 35 29 H 51 A 10 10 0 0 1 61 39 V 45 A 10 10 0 0 1 51 55 H 35 A 10 10 0 0 1 25 45 V 39 A 10 10 0 0 1 35 29 Z';
const OUTLINE_TAIL_PATH = 'M 43 32 L 55 19 L 52 32';

const STROKE_WIDTH = 3.5;

export interface MeloMarkProps {
  size?: number;
  color?: string;
  /** Second tone for the outlined bubble's stroke. Defaults to `color`. */
  outlineColor?: string;
}

function MeloMarkComponent({ size = 48, color = brand.ember, outlineColor }: MeloMarkProps) {
  const stroke = outlineColor ?? color;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityRole="image">
      <Path d={SOLID_PATH} fill={color} />
      <Path
        d={OUTLINE_BODY_PATH}
        fill="none"
        stroke={stroke}
        strokeWidth={STROKE_WIDTH}
        strokeLinejoin="round"
      />
      <Path
        d={OUTLINE_TAIL_PATH}
        fill="none"
        stroke={stroke}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export const MeloMark = memo(MeloMarkComponent);
