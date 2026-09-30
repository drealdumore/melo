/**
 * Translation.
 *
 * `translateMessage` below is the raw, untrusted HTTP call and is kept verbatim
 * — it is what we were given and it is deliberately dumb. Everything that
 * makes it safe to put in front of a human lives in the wrapper:
 *
 *   1. The raw function returns the *input* on failure, so a success and a
 *      failure look identical. `translateWithStatus` decides which it was.
 *   2. `data[0][0][0]` is only the first sentence; we join every segment.
 *   3. The endpoint is unofficial and can be blocked or rate limited, so it
 *      sits behind a `TranslationProvider` interface that can be swapped.
 *   4. 6s timeout + one retry, via AbortController.
 *   5. Same language in and out is a `skipped`, not a round trip.
 */
import type { TranslationStatus } from '@/types/models';

export type { TranslationStatus };

/* -------------------------------------------------------------------------- */
/* Provided upstream call, kept verbatim — do not edit.                        */
/*                                                                             */
/* The wrapper below deliberately does NOT call it. This function cannot be   */
/* used to build `translateWithStatus` because it throws away everything we   */
/* need: it returns the input on failure (so success and failure are           */
/* identical), it returns only `data[0][0][0]` (the first sentence only), and  */
/* it has no timeout or retry. The wrapper therefore issues the same request   */
/* itself so it can see the full payload and the real error.                   */
/* -------------------------------------------------------------------------- */

export async function translateMessage(
  message: string,
  targetLanguage: string,
  fromLanguage: string = "en",
  proxy: string = ""
) {
  const apiUrl = `https://${proxy}translate.googleapis.com/translate_a/single?client=gtx&sl=${fromLanguage}&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(
    message
  )}`;

  try {
    const response = await fetch(apiUrl);

    if (!response.ok) {
      console.error("Google Translate API error:", await response.text());
      return message;
    }

    const data: any | null = await response.json();

    return data[0]?.[0]?.[0] || message;
  } catch (error) {
    console.error("Error translating message with Google Translate:", error);
    return message;
  }
}

/* -------------------------------------------------------------------------- */
/* Wrapper                                                                     */
/* -------------------------------------------------------------------------- */

export interface TranslationResult {
  /** Best available text. On failure this is the original, untouched. */
  text: string;
  status: TranslationStatus;
  error?: string;
}

export interface TranslationProvider {
  readonly name: string;
  translate(
    text: string,
    to: string,
    from: string
  ): Promise<{ text: string | null; error?: string }>;
}

const REQUEST_TIMEOUT_MS = 6000;
const MAX_ATTEMPTS = 2;

/** Shorter than this, a round trip is pointless even when the languages differ. */
const MEANINGFUL_LENGTH = 3;

/**
 * Reads the real response body.
 *
 * `translateMessage` collapses both "translated" and "the request died" down to
 * a string, so the wrapper issues its own request to get at the full payload
 * (`data[0]` is an array of segments) and an actual error signal.
 */
class GoogleTranslateProvider implements TranslationProvider {
  readonly name = 'google-translate-free';

  async translate(
    text: string,
    to: string,
    from: string
  ): Promise<{ text: string | null; error?: string }> {
    const url =
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
        from
      )}&tl=${encodeURIComponent(to)}&dt=t&q=${encodeURIComponent(text)}`;

    let lastError = 'Translation unavailable.';

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          lastError = `Translation service returned ${response.status}.`;
          continue;
        }

        const data: unknown = await response.json();
        const joined = joinSegments(data);
        if (joined) return { text: joined };

        // A well-formed but empty payload is the upstream function's way of
        // saying "I could not do this".
        lastError = 'Translation service returned an empty result.';
      } catch (error) {
        lastError =
          error instanceof Error && error.name === 'AbortError'
            ? 'Translation timed out.'
            : 'Could not reach the translation service.';
      } finally {
        clearTimeout(timer);
      }
    }

    return { text: null, error: lastError };
  }
}

/**
 * `data[0]` is `[[segment, source, ...], [segment, ...], ...]`. Taking only
 * `[0][0][0]` truncates everything after the first sentence.
 */
function joinSegments(data: unknown): string | null {
  if (!Array.isArray(data) || !Array.isArray(data[0])) return null;
  const parts: string[] = [];
  for (const segment of data[0] as unknown[]) {
    if (Array.isArray(segment) && typeof segment[0] === 'string') parts.push(segment[0]);
  }
  if (parts.length === 0) return null;
  const joined = parts.join('');
  return joined.length > 0 ? joined : null;
}

let activeProvider: TranslationProvider = new GoogleTranslateProvider();

/** Swap the backend without touching a single UI component or hook. */
export function setTranslationProvider(provider: TranslationProvider): void {
  activeProvider = provider;
}

export function getTranslationProvider(): TranslationProvider {
  return activeProvider;
}

/**
 * Detects the case the raw function cannot: it returned our own input because
 * the request failed, while the languages genuinely differ. Short strings are
 * excluded because lots of real text legitimately translates to itself
 * ("OK", "Hi", names).
 */
function looksLikeUntranslatedEcho(input: string, output: string, from: string, to: string): boolean {
  if (from === to) return false;
  if (input.trim().length <= MEANINGFUL_LENGTH) return false;
  return input.trim() === output.trim();
}

/**
 * The only translation entry point the app uses.
 * Never throws: a failure comes back as `{ status: 'failed' }` with the
 * original text intact, which is what the UI renders as "Couldn't translate".
 */
export async function translateWithStatus(
  message: string,
  targetLanguage: string,
  fromLanguage: string = 'en'
): Promise<TranslationResult> {
  const trimmed = message.trim();

  if (trimmed.length === 0) {
    return { text: message, status: 'skipped' };
  }
  if (fromLanguage === targetLanguage) {
    return { text: message, status: 'skipped' };
  }

  try {
    const { text, error } = await activeProvider.translate(message, targetLanguage, fromLanguage);

    if (text == null) {
      return { text: message, status: 'failed', error: error ?? 'Translation failed.' };
    }
    if (looksLikeUntranslatedEcho(message, text, fromLanguage, targetLanguage)) {
      return {
        text: message,
        status: 'failed',
        error: 'The translation service returned the original text.',
      };
    }

    return { text, status: 'translated' };
  } catch (error) {
    console.error('Translation provider threw', error);
    return { text: message, status: 'failed', error: 'Translation failed.' };
  }
}
