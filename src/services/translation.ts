/**
 * Translation.
 *
 * `translateWithStatus` is the only entry point the app uses. Everything that
 * makes the raw HTTP call safe to put in front of a human lives here:
 *
 *   1. The endpoint returns the *input* on failure, so a success and a failure
 *      look identical. `translateWithStatus` decides which it was.
 *   2. `data[0][0][0]` is only the first sentence; we join every segment.
 *   3. The endpoint is unofficial and can be blocked or rate limited, so every
 *      network detail stays in this one file; callers never see a fetch.
 *   4. 6s timeout + one retry, via AbortController, with a pause before the
 *      retry because the endpoint answers a throttle with an instant 429.
 *   5. Same language in and out is a `skipped`, not a round trip. So is any
 *      response that echoes the input without contradicting that conclusion.
 *   6. The source language is detected (`sl=auto`), not assumed. What someone
 *      reads is not what they typed, and guessing produced a message that needed
 *      no translation at all being reported as a broken service.
 *   7. Results are cached on (target, text) and identical in-flight requests are
 *      coalesced, because the endpoint rate-limits by IP and a chat is repetitive.
 */
import { createLogger, describeError, now, since } from '@/services/logger';
import type { TranslationStatus } from '@/types/models';

export type { TranslationStatus };

const log = createLogger('translation');

/**
 * Message text appears in logs only as a length plus a short preview, and only
 * at `debug`. Melo sends real conversations to a third party already; a log line
 * that outlives the request is a second copy nobody agreed to.
 */
const PREVIEW_CHARS = 40;

function previewText(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > PREVIEW_CHARS ? `${flat.slice(0, PREVIEW_CHARS)}…` : flat;
}

export interface TranslationResult {
  /** Best available text. On failure this is the original, untouched. */
  text: string;
  status: TranslationStatus;
  error?: string;
}

const REQUEST_TIMEOUT_MS = 6000;
const MAX_ATTEMPTS = 2;

/**
 * Pause before the second attempt.
 *
 * The endpoint rate-limits by IP and answers 429 with an HTML page, so an
 * immediate retry tends to earn a second 429 and just doubles the worst case. A
 * short pause turns "we were briefly throttled" into a successful translation
 * often enough to be worth the wait.
 */
const RETRY_DELAY_MS = 450;

const MAX_CACHE_ENTRIES = 200;

/**
 * Real translations only, keyed on target + text.
 *
 * The source is detected rather than declared, so the output depends on nothing
 * else and the key is complete. Chat is repetitive — greetings, "ok", agreement,
 * and the same link pasted twice — and a hit costs no round trip at all, which
 * is the single largest thing that can be removed from the latency.
 *
 * The value is the pair, not the bare string, because the caller's verdict
 * between `failed` and `skipped` is derived from the detected source. Storing
 * only the text meant a read-back could not reproduce the decision that had
 * already been made for the same input, and the same message came back
 * `failed` once and `skipped` on the retry that hit the cache.
 *
 * Deliberately not persisted: it is a speed hint, and writing translations to
 * disk would put message text in a second store nobody agreed to. Bounded, so a
 * long session cannot grow it without limit.
 */
const translationCache = new Map<string, CachedTranslation>();

interface CachedTranslation {
  text: string;
  /** The source the service reported, so a later read decides identically. */
  detectedFrom: string | null;
}

function cacheGet(key: string): CachedTranslation | undefined {
  const hit = translationCache.get(key);
  if (hit === undefined) return undefined;
  // Re-insert to mark most-recently-used; Map iterates in insertion order.
  translationCache.delete(key);
  translationCache.set(key, hit);
  return hit;
}

function cacheSet(key: string, value: CachedTranslation): void {
  translationCache.set(key, value);
  if (translationCache.size > MAX_CACHE_ENTRIES) {
    const oldest = translationCache.keys().next();
    if (!oldest.done) translationCache.delete(oldest.value);
  }
}

/**
 * In-flight requests, so the same text asked for twice at once is sent once.
 *
 * Without this, a send and its own retry — or two devices restoring the same
 * history — can put duplicate requests against an endpoint that rate-limits by
 * IP. Failures are deliberately *not* cached: they are usually a transient
 * throttle, and remembering one would turn a blip into a stuck message.
 */
const inFlight = new Map<
  string,
  Promise<{ text: string | null; error?: string; detectedFrom?: string | null }>
>();

/**
 * Cached and coalesced entry to `fetchTranslation`: a cache hit costs no round
 * trip and two identical requests in flight become one. The full payload is
 * parsed inside (`data[0]` is an array of segments) so nothing is truncated and
 * a real error stays distinguishable from a successful echo.
 */
async function translate(
  text: string,
  to: string,
  from: string
): Promise<{ text: string | null; error?: string; detectedFrom?: string | null }> {
  // With `sl=auto` the output depends only on the target and the text, so this
  // is a complete cache key.
  const key = `${to}\u0000${text}`;

  const cached = cacheGet(key);
  if (cached !== undefined) {
    log.debug(`cache hit for ${to}`, { chars: text.length });
    return { text: cached.text, detectedFrom: cached.detectedFrom };
  }

  const pending = inFlight.get(key);
  if (pending) {
    log.debug(`joining an in-flight request for ${to}`, { chars: text.length });
    return pending;
  }

  const promise = fetchTranslation(text, to, from).then(
    (result) => {
      inFlight.delete(key);
      // An echo is not a translation. Caching one would let a later caller read
      // back the original text as though the service had translated it, which is
      // how a real failure turns into a silent pass.
      const isEcho = result.text != null && result.text.trim() === text.trim();
      if (result.text != null && !isEcho) {
        cacheSet(key, { text: result.text, detectedFrom: result.detectedFrom ?? null });
      }
      return result;
    },
    (error: unknown) => {
      // Never leave a rejected promise in the map, or every later caller
      // inherits one error forever.
      inFlight.delete(key);
      throw error;
    }
  );

  inFlight.set(key, promise);
  return promise;
}

/** One attempt-loop. `translate` owns caching and coalescing around this. */
async function fetchTranslation(
  text: string,
  to: string,
  from: string
): Promise<{ text: string | null; error?: string; detectedFrom?: string | null }> {
  // `sl=auto` rather than the sender's declared language. The declared value is
  // what the sender *reads*, not what they typed, and this endpoint tells us
  // what it actually saw in `data[2]`. Assuming the declared value is what made
  // a typed-in-English / profile-says-German message look like a service
  // failure, so the request now lets the service decide and we report back
  // what it decided.
  const url =
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
      to
    )}&dt=t&q=${encodeURIComponent(text)}`;

  let lastError = 'Translation unavailable.';

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await sleep(RETRY_DELAY_MS);

    const started = now();
    const attemptNo = attempt + 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    log.debug(`attempt ${attemptNo}/${MAX_ATTEMPTS} → ${from} → ${to}`, {
      chars: text.length,
      preview: previewText(text),
      timeoutMs: REQUEST_TIMEOUT_MS,
    });

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        lastError = `Translation service returned ${response.status}.`;
        // 429 and 5xx are the endpoint being unwell rather than the request
        // being wrong, so they are worth retrying and worth seeing. A 400 or a
        // 404 is deterministic: spending another 6s on it only doubles the wait
        // before the same answer.
        if (!isWorthRetrying(response.status)) {
          log.warn(`attempt ${attemptNo}/${MAX_ATTEMPTS} failed in ${since(started)}: ${lastError}`, {
            status: response.status,
            willRetry: false,
          });
          break;
        }
        log.warn(`attempt ${attemptNo}/${MAX_ATTEMPTS} failed in ${since(started)}: ${lastError}`, {
          status: response.status,
          willRetry: attemptNo < MAX_ATTEMPTS,
        });
        continue;
      }

      const data: unknown = await response.json();
      const joined = joinSegments(data);
      const detectedFrom = detectSourceLanguage(data);
      if (joined) {
        log.info(`translated ${from} → ${to} in ${since(started)}`, {
          attempt: attemptNo,
          detected: detectedFrom ?? 'unknown',
          inChars: text.length,
          outChars: joined.length,
          segments: Array.isArray((data as unknown[])[0])
            ? ((data as unknown[])[0] as unknown[]).length
            : 0,
          unchanged: joined.trim() === text.trim(),
        });
        return { text: joined, detectedFrom };
      }

      // A well-formed but empty payload is the service's way of saying "I could
      // not do this".
      lastError = 'Translation service returned an empty result.';
      log.warn(`attempt ${attemptNo}/${MAX_ATTEMPTS} failed in ${since(started)}: ${lastError}`, {
        willRetry: attemptNo < MAX_ATTEMPTS,
        payloadShape: describeShape(data),
      });
    } catch (error) {
      lastError =
        error instanceof Error && error.name === 'AbortError'
          ? 'Translation timed out.'
          : 'Could not reach the translation service.';
      log.warn(`attempt ${attemptNo}/${MAX_ATTEMPTS} failed in ${since(started)}: ${lastError}`, {
        willRetry: attemptNo < MAX_ATTEMPTS,
        name: error instanceof Error ? error.name : typeof error,
        detail: describeError(error),
      });
    } finally {
      clearTimeout(timer);
    }
  }

  log.error(`giving up after ${MAX_ATTEMPTS} attempts`, { reason: lastError });
  return { text: null, error: lastError };
}

/**
 * A short description of an unexpected payload, so "empty result" can be told
 * apart from "the service answered with something we do not understand" — which
 * are very different bugs and look identical without this.
 */
function describeShape(data: unknown): string {
  if (data === null) return 'null';
  if (Array.isArray(data)) {
    const inner = data
      .slice(0, 4)
      .map((item) => (Array.isArray(item) ? `array(${item.length})` : typeof item))
      .join(', ');
    return `array(${data.length}) [${inner}]`;
  }
  if (typeof data === 'object') {
    const keys = Object.keys(data as Record<string, unknown>).slice(0, 6).join(', ');
    return `object { ${keys} }`;
  }
  return typeof data;
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

/**
 * `data[2]` is the source language the service detected, and it is only present
 * when the request asked for detection. This slot is undocumented and has moved
 * before, so it is treated as a hint: anything that is not shaped like a
 * language tag is discarded and the caller falls back to comparing the input
 * with the output.
 */
function detectSourceLanguage(data: unknown): string | null {
  if (!Array.isArray(data)) return null;
  const candidate = data[2];
  if (typeof candidate !== 'string') return null;
  const tag = candidate.trim().toLowerCase();
  return /^[a-z]{2,3}(-[a-z]{2,4})?$/.test(tag) ? tag : null;
}

/**
 * Detects the case the raw function cannot: it returned our own input because
 * the request failed, while the languages genuinely differ.
 *
 * Short strings are included on purpose. Exempting them used to mean a three
 * character echo was reported as a successful translation, which stored the
 * untranslated original in `translated_text` and labelled it "Translated" for
 * the reader. Whether an echo is a failure is decided by the detected source
 * downstream, not by the length of the text, so there is nothing to protect
 * here.
 */
function looksLikeUntranslatedEcho(input: string, output: string, from: string, to: string): boolean {
  if (sameLanguage(from, to)) return false;
  return input.trim() === output.trim();
}

/** A throttle or a server fault may pass; a rejected request will not. */
function isWorthRetrying(status: number): boolean {
  return status === 429 || status >= 500;
}

/** Compares base language, so `pt-BR` and `pt` count as the same language. */
export function sameLanguage(a: string, b: string): boolean {
  return a.trim().toLowerCase().split('-')[0] === b.trim().toLowerCase().split('-')[0];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    log.debug('skipped: empty message');
    return { text: message, status: 'skipped' };
  }
  if (sameLanguage(fromLanguage, targetLanguage)) {
    // Not a failure and not a round trip: both people read the same language.
    // Base-language comparison, not `===`, so `en-US` and `en` land here too —
    // otherwise the request goes out, comes back as the input, and is recorded
    // as a successful translation of text that never needed translating.
    log.debug(`skipped: ${fromLanguage} → ${targetLanguage} is the same language`);
    return { text: message, status: 'skipped' };
  }

  const started = now();
  log.info(`translating ${fromLanguage} → ${targetLanguage}`, {
    chars: trimmed.length,
  });

  try {
    // The trimmed text is what is sent and what the cache is keyed on, so
    // "ok" and "ok " are one entry and one round trip rather than two. The
    // untrimmed original still comes back on every non-success path.
    const { text, error, detectedFrom } = await translate(trimmed, targetLanguage, fromLanguage);

    if (detectedFrom && !sameLanguage(detectedFrom, fromLanguage)) {
      // The profile's reading language is not what was written. Not an error,
      // but the one thing that makes a bad translation explainable. Logged per
      // caller, because `translate` coalesces one request across callers that
      // each declared a different source.
      log.info(`source was ${detectedFrom}, not the declared ${fromLanguage}`, {
        declared: fromLanguage,
        detected: detectedFrom,
        target: targetLanguage,
      });
    }

    if (text == null) {
      // This is the line that explains a bubble reading "Couldn't translate".
      log.error(`failed ${fromLanguage} → ${targetLanguage} after ${since(started)}`, {
        reason: error ?? 'Translation failed.',
      });
      return { text: message, status: 'failed', error: error ?? 'Translation failed.' };
    }

    if (looksLikeUntranslatedEcho(trimmed, text, fromLanguage, targetLanguage)) {
      // A 200 with our own text back. Only ONE thing makes that a genuine
      // failure: the service looked at the text, told us it saw a language that
      // is not the reader's, and handed it back anyway.
      const contradicted = detectedFrom != null && !sameLanguage(detectedFrom, targetLanguage);

      if (contradicted) {
        log.error(
          `service echoed the original ${fromLanguage} → ${targetLanguage} after ${since(started)}`,
          { chars: message.length, declared: fromLanguage, detected: detectedFrom }
        );
        return {
          text: message,
          status: 'failed',
          error: 'The translation service returned the original text.',
        };
      }

      // Everything else here is "there was nothing to translate": the service
      // confirmed the text is already in the reader's language, or it declined to
      // say (`data[2]` is undocumented and may be absent) — and an absent answer
      // is not evidence of failure.
      //
      // Reporting that as `failed` is what put "Couldn't translate" on messages
      // that were never untranslatable, with a *Try again* chip that could only
      // ever produce the same echo. The original text is correct in every one of
      // these cases, and `skipped` renders it as-is with no error and no retry.
      log.info(`nothing to translate for ${targetLanguage} after ${since(started)}`, {
        declared: fromLanguage,
        detected: detectedFrom ?? 'not reported',
        chars: message.length,
      });
      return { text: message, status: 'skipped' };
    }

    log.info(`done ${fromLanguage} → ${targetLanguage} in ${since(started)}`);
    return { text, status: 'translated' };
  } catch (error) {
    log.error(`translation threw after ${since(started)}`, error);
    return { text: message, status: 'failed', error: 'Translation failed.' };
  }
}
