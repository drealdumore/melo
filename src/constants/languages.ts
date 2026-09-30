/**
 * The languages Melo speaks. Codes are the only thing ever persisted or sent to
 * the translation endpoint — never the English or native names.
 */

export interface Language {
  /** English name. */
  name: string;
  /** Name in that language, shown large in the picker. */
  nativeName: string;
  /** BCP-47-ish code, stored in the DB. */
  code: string;
  rtl: boolean;
  /**
   * Emoji flag, for the picker only. Deliberately not rendered on a Text
   * component: on Android these fall back to the letter code unless a flag font
   * is present, and a missing glyph is worse than no flag at all.
   */
  flag: string;
}

export const LANGUAGES: Language[] = [
  { name: 'English', nativeName: 'English', code: 'en', rtl: false, flag: '🇬🇧' },
  { name: 'Spanish', nativeName: 'Español', code: 'es', rtl: false, flag: '🇪🇸' },
  { name: 'French', nativeName: 'Français', code: 'fr', rtl: false, flag: '🇫🇷' },
  { name: 'German', nativeName: 'Deutsch', code: 'de', rtl: false, flag: '🇩🇪' },
  { name: 'Chinese (Simplified)', nativeName: '简体中文', code: 'zh-CN', rtl: false, flag: '🇨🇳' },
  { name: 'Arabic', nativeName: 'العربية', code: 'ar', rtl: true, flag: '🇸🇦' },
  { name: 'Portuguese', nativeName: 'Português', code: 'pt', rtl: false, flag: '🇵🇹' },
  { name: 'Hindi', nativeName: 'हिन्दी', code: 'hi', rtl: false, flag: '🇮🇳' },
  { name: 'Swahili', nativeName: 'Kiswahili', code: 'sw', rtl: false, flag: '🇰🇪' },
  { name: 'Yoruba', nativeName: 'Yorùbá', code: 'yo', rtl: false, flag: '🇳🇬' },
  { name: 'Korean', nativeName: '한국어', code: 'ko', rtl: false, flag: '🇰🇷' },
];

export const DEFAULT_LANGUAGE: Language = {
  name: 'English',
  nativeName: 'English',
  code: 'en',
  rtl: false,
  flag: '🇬🇧',
};

const BY_CODE = new Map<string, Language>(LANGUAGES.map((language) => [language.code, language]));

export function getLanguage(code: string | null | undefined): Language {
  if (!code) return DEFAULT_LANGUAGE;
  return BY_CODE.get(code) ?? DEFAULT_LANGUAGE;
}

export function isRtl(code: string | null | undefined): boolean {
  return getLanguage(code).rtl;
}

/** English name, for prose: "Sam reads Melo in Portuguese". */
export function languageName(code: string | null | undefined): string {
  return getLanguage(code).name;
}

/** Name in its own language, for pickers and chips: "Português". */
export function nativeLanguageName(code: string | null | undefined): string {
  return getLanguage(code).nativeName;
}

/** Matches "es-MX", "en_GB", "zh-Hans-CN" down to a code we actually support. */
export function matchLanguage(locale: string | null | undefined): Language {
  if (!locale) return DEFAULT_LANGUAGE;

  const normalized = locale.replace('_', '-');
  const exact = BY_CODE.get(normalized);
  if (exact) return exact;

  const lower = normalized.toLowerCase();
  const prefix = lower.split('-')[0];
  const match = LANGUAGES.find(
    (language) =>
      language.code.toLowerCase() === prefix || language.code.toLowerCase().startsWith(`${prefix}-`)
  );
  return match ?? DEFAULT_LANGUAGE;
}

/** Best guess at the device locale, without pulling in a native locale module. */
export function deviceLanguage(): Language {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    return matchLanguage(locale);
  } catch {
    return DEFAULT_LANGUAGE;
  }
}
