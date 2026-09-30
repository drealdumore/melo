/**
 * Bundled typefaces.
 *
 *   Gliker          — display only. Titles, headlines, the wordmark.
 *   Bagoss Standard — everything else, at Regular, Medium, and Bold weights.
 *   JetBrains Mono  — the Melo ID, which has to line up character for character.
 *
 * Loaded at runtime with `useFonts` rather than the `expo-font` config plugin,
 * because plugin-embedded fonts only exist in a native build and this app is
 * developed against Expo Go. See `RootLayout` for the splash-screen gate.
 *
 * The keys below are the `fontFamily` names, so they must match what
 * `typography.ts` puts in a style.
 */
import type { FontSource } from 'expo-font';

/** Display face. One weight only, so `fontWeight` has nothing to select. */
export const DISPLAY_FAMILY = 'Gliker';

/** Reading and UI face. */
export const TEXT_FAMILY = 'Bagoss Standard';

/** Fixed-pitch face, for the Melo ID and nothing else. */
export const MONO_FAMILY = 'JetBrains Mono';

export const fontMap: Record<string, FontSource> = {
  [DISPLAY_FAMILY]: require('../../assets/fonts/gliker-regular.ttf'),
  [`${TEXT_FAMILY} Regular`]: require('../../assets/fonts/BagossStandardTRIAL-Regular.ttf'),
  [`${TEXT_FAMILY} Medium`]: require('../../assets/fonts/BagossStandardTRIAL-Medium.ttf'),
  [`${TEXT_FAMILY} Bold`]: require('../../assets/fonts/BagossStandardTRIAL-Bold.ttf'),
  [MONO_FAMILY]: require('../../assets/fonts/JetBrainsMono-Regular.ttf'),
};

/**
 * The registered family name for a Cabinet Grotesk weight.
 *
 * `useFonts` takes a flat name → file map with no weight metadata, so each static
 * cut has to live under its own name. 600 and 700/800 both resolve to Medium and
 * Bold respectively, which is the whole reason the style's `fontWeight` is pinned
 * to `400` — see the note in `typography.ts`.
 */
export function textFace(weight: 400 | 600 | 700 | 800): string {
  if (weight >= 700) return `${TEXT_FAMILY} Bold`;
  if (weight >= 600) return `${TEXT_FAMILY} Medium`;
  return `${TEXT_FAMILY} Regular`;
}
