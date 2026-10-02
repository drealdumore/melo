/**
 * The bundled avatars.
 *
 * Every entry is a literal `require` on purpose. Metro resolves assets at build
 * time and only bundles what it can see statically, so `require(somePath)` built
 * from a string works in the dev server and ships as nothing at all. The map is
 * the bundler's view of the images; `profiles.avatar_key` stores the slug that
 * indexes it.
 *
 * The two Disney files kept their source filenames, which say "princess-disney"
 * and "princess-disneyprincesas-disney" without saying which character either
 * is. They are named `disney-a` / `disney-b` rather than guessed at. Rename here
 * and the row value together; nothing else refers to a slug.
 *
 * Slugs are internal. The picker shows the picture, not the name.
 *
 * The artwork is ripped from emojis.com and depicts anime, comic-book and Disney
 * characters. That is fine for a private database between friends and is not fine
 * in an app store — see the licensing note in next.txt.
 */
import type { ImageSourcePropType } from 'react-native';

export const AVATARS = {
  'all-might': require('../../assets/avatars/all-might.png'),
  ballplayer: require('../../assets/avatars/ballplayer.png'),
  'disney-a': require('../../assets/avatars/disney-a.png'),
  'disney-b': require('../../assets/avatars/disney-b.png'),
  gojo: require('../../assets/avatars/gojo.png'),
  spiderman: require('../../assets/avatars/spiderman.png'),
  lufi: require('../../assets/avatars/lufi.png'),
  goku: require('../../assets/avatars/goku.png'),
  'green-grudge': require('../../assets/avatars/green-grudge.png'),
  izuku: require('../../assets/avatars/izuku.png'),
  joker: require('../../assets/avatars/joker.png'),
  lady: require('../../assets/avatars/lady.png'),
  nurse: require('../../assets/avatars/nurse.png'),
  obito: require('../../assets/avatars/obito.png'),
  saitama: require('../../assets/avatars/saitama.png'),
  'shades-cat': require('../../assets/avatars/shades-cat.png'),
} as const satisfies Record<string, ImageSourcePropType>;

export type AvatarKey = keyof typeof AVATARS;

/** Grid order for the picker, so it does not jump around as art is added. */
export const AVATAR_KEYS = Object.keys(AVATARS) as AvatarKey[];

export function isAvatarKey(value: unknown): value is AvatarKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(AVATARS, value);
}

/**
 * Resolves a stored slug to an image, or `null` when there is nothing usable.
 *
 * `null` is the normal case, not an error: it means the person never picked an
 * avatar, or picked one from a build that no longer bundles it. The caller
 * falls back to initials, so an unknown slug degrades to exactly what this app
 * looked like before avatars existed.
 */
export function avatarSource(key: string | null | undefined): ImageSourcePropType | null {
  return isAvatarKey(key) ? AVATARS[key] : null;
}
