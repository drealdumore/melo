/**
 * Typography. Display is Gliker, reading and UI is Bagoss Standard, and the Melo
 * ID is JetBrains Mono. Sizes are unscaled values — React Native applies the OS
 * font-scale factor for us, which is what "support font scaling" means here.
 * Never pass `allowFontScaling={false}`.
 *
 * Every token carries its own `fontFamily`, so a component only ever reaches for
 * `typography.someToken` and cannot accidentally pick the wrong face.
 */

import type { TextStyle } from 'react-native';

import { DISPLAY_FAMILY, MONO_FAMILY, TEXT_FAMILY, textFace } from '@/theme/fonts';

const base: Pick<TextStyle, 'fontSize' | 'lineHeight' | 'fontWeight' | 'letterSpacing'> = {
  fontSize: 16,
  lineHeight: 21,
  fontWeight: '400',
};

/**
 * Static weights are registered as separate family names, so every token pins
 * `fontWeight: '400'`. That looks wrong but is deliberate: the weight here is
 * carried by *which file* is loaded, and asking for `700` on top of an
 * already-Bold face makes iOS and Android synthesize a second, smeared bold on
 * top of it. Change the face via `textFace`, not the weight.
 */
export const fontFamily = {
  /** Display: titles, headlines, the wordmark. One weight only. */
  display: DISPLAY_FAMILY,
  /** The registered static Bagoss Standard cuts. */
  textRegular: textFace(400),
  textMedium: textFace(600),
  textBold: textFace(700),
  /** Generic family, for anything that must not silently pick a weight. */
  text: TEXT_FAMILY,
  /** The Melo ID only — it has to line up character for character. */
  mono: MONO_FAMILY,
} as const;

export const typography = {
  /** The Melo wordmark and the biggest one-off moments. */
  hero: {
    ...base,
    fontFamily: fontFamily.display,
    fontSize: 42,
    lineHeight: 46,
    letterSpacing: -0.8,
  },
  /** Screen headlines. */
  heroTitle: {
    ...base,
    fontFamily: fontFamily.display,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.4,
  },
  /** Section and screen titles inside the chrome. */
  screenTitle: {
    ...base,
    fontFamily: fontFamily.display,
    fontSize: 25,
    lineHeight: 29,
    letterSpacing: -0.3,
  },
  /** Row headers, sheet titles. */
  section: { ...base, fontFamily: fontFamily.display, fontSize: 17, lineHeight: 22 },
  /** Default reading size. */
  body: { ...base, fontFamily: fontFamily.textRegular },
  /** Names and anything that should feel like a label rather than a paragraph. */
  bodyStrong: { ...base, fontFamily: fontFamily.textBold },
  /** Message text. */
  message: { ...base, fontFamily: fontFamily.textMedium, fontSize: 17, lineHeight: 23 },
  /** Secondary lines and previews. */
  caption: { ...base, fontFamily: fontFamily.textRegular, fontSize: 13, lineHeight: 17 },
  captionStrong: { ...base, fontFamily: fontFamily.textBold, fontSize: 13, lineHeight: 17 },
  /** Timestamps, badges, "Translated". */
  micro: { ...base, fontFamily: fontFamily.textRegular, fontSize: 12, lineHeight: 15 },
  /** Uppercase field labels. */
  label: {
    ...base,
    fontFamily: fontFamily.textBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
  },
  labelEmphatic: {
    ...base,
    fontFamily: fontFamily.textBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
  },
  mono: {
    ...base,
    fontFamily: fontFamily.mono,
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: 1,
  },
  monoId: {
    ...base,
    fontFamily: fontFamily.mono,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 1.5,
  },
} as const satisfies Record<string, TextStyle>;

export type TypographyToken = keyof typeof typography;
