# Melo

Private, two-person, real-time chat that translates as it goes. Write in the
language you think in; your one friend reads it in theirs. Originals are never
destroyed — every translation is one tap from the message it came from.

Built for three people. It is not a group-chat app, and it is not trying to be.

> Expo SDK 57 · Expo Router · React Native 0.86 · React 19.2 · Supabase

---

## Quick start

```bash
pnpm install
cp .env.example .env          # then paste in your Supabase keys
pnpm start                    # press i / a, or scan the QR with Expo Go
```

Then follow [`supabase/README.md`](supabase/README.md) to create the database
before you run the app. Without Supabase credentials the app still boots and
onboarding still works, but there is nowhere to store profiles or messages.

Every `expo start` script here passes `--offline`, which tells the CLI to skip
network requests and use anonymous manifest signatures — enough to develop
against without a network round trip. Drop the flag if you need the real manifest
signature.

### Running it

| Target        | Command             | Notes                                                     |
| ------------- | ------------------- | --------------------------------------------------------- |
| Expo Go       | `pnpm start`        | Works. Every native dep is an Expo SDK module or vendored. |
| iOS simulator | `pnpm ios`          |                                                           |
| Android       | `pnpm android`      |                                                           |
| Web           | `pnpm web`          | For layout work only. Translation is CORS-restricted.     |

Every native dependency ships inside Expo Go: `expo-clipboard`, `expo-constants`,
`expo-crypto`, `expo-font`, `expo-haptics`, `expo-linking`, `expo-router`,
`expo-splash-screen`, `expo-status-bar`, `expo-system-ui`,
`@react-native-async-storage/async-storage`, `react-native-gesture-handler`,
`react-native-reanimated` + `react-native-worklets`,
`react-native-safe-area-context`, `react-native-screens`, `react-native-svg`, and
`@gorhom/bottom-sheet` (which backs the profile sheets). If you later add a
library with its own native code you will need a development build —
`npx expo run:ios` or `eas build --profile development`.

### Checks

```bash
pnpm typecheck   # tsc --noEmit — clean
pnpm lint        # eslint — 0 errors, 5 unused-variable warnings
```

`pnpm db:types` regenerates `src/types/database.ts` from a live project after a
schema change; see the script header for usage.

---

## Environment

| Variable                        | Where it comes from               |
| ------------------------------- | --------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`      | Supabase → Project Settings → API |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys |

`.env` is gitignored, `.env.example` is committed. Expo inlines `EXPO_PUBLIC_*`
variables into the bundle, so the anon key ships to everyone who has the app —
which is fine, and only fine, as long as RLS is on. It is not. See below.

---

## How it works

**Identity is your device, not an account.** On first run the app draws a UUID and
a Melo ID from `abcdefghjkmnpqrstuvwxyz23456789` — no `i`, `l`, `o`, `0`, `1` — using
`expo-crypto` CSPRNG bytes with rejection sampling so the alphabet is not skewed.
The ID is stored under `melo.identity.v1` in AsyncStorage, separately from the
profile, which is what lets the ID screen show a stable ID while the profile row is
still saving. That ID is how you meet someone.

**A Melo ID is your name plus a suffix.** `Becool` → `becool7f3k`: the display name
slugified to at most 6 characters (accents folded, everything non-`[a-z0-9]`
dropped), then 5 characters from the alphabet above. The suffix is the whole
reason two people called Alex do not collide; if it does, the suffix is redrawn
and the name half is never touched, so the ID stays recognisable. IDs are 6–11
characters, which is why `0003` widened the CHECK. A name with no Latin characters
at all falls back to 3 random characters, because a slug of nothing is worse than a
slug of noise. Every ID drawn under the old 11-random format still matches the new
pattern, so no existing row changed.

**Nothing has ever been recoverable.** Deleting the app loses your Melo ID
permanently, so `onboarding/recover` exists: enter a friend's Melo ID and this
device adopts that identity — profile, language and avatar — and writes the ID
locally. That is a deliberate MVP trade, not a feature: **the Melo ID is the only
credential.** Anyone who knows your ID can take over your profile on any device, and
a name-derived ID is easier to guess than a random one. It is logged at `warn` when
it happens, because a takeover is exactly the event you would want in a log.

**Rooms are derived, not generated.** A room's primary key is
`sorted(meloA, meloB).join('-')`. If you and your friend both tap *Start Chat*
at the same moment, you cannot create two rooms — the second upsert collides,
`ignoreDuplicates` drops it, and the follow-up select returns the row that won.

**Sending is optimistic, but delivery waits for translation.** The sender sees
their bubble immediately with a client UUID. It is translated before any row is
written to the shared `messages` table, so the other person never receives a
pending or untranslated message. A failed translation stays local as an unsent
bubble with tap-to-retry and long-press-to-delete. Once translation succeeds,
the completed row is inserted with a 10-second timeout; a duplicate-key error
(`23505`) is completed with the translation too, making retries safe because
they reuse the same UUID.

**Translation is a client-side pass.** Melo calls the translation endpoint and
joins every segment before inserting the message. Successful results are stored
as `translated`; when the service confirms the text already matches the reader's
language, it is stored as `skipped` and delivered as-is. A real translation
failure is never inserted or delivered.

**The source language is detected, not assumed.** The request sends `sl=auto`, and
the service's own answer arrives in `data[2]`. This matters more than it sounds:
what someone *reads* is not what they *typed*, so the old code that sent the
sender's declared reading language got a 200 with the original text back whenever
someone typed in a second language — and reported it as a broken service.

The rule now is that **an echo is absence of evidence, not evidence of failure.**
Only one outcome is a failure:

| Service answered                              | Status       | Retry chip |
| --------------------------------------------- | ------------ | ---------- |
| the text changed                              | `translated` | no         |
| echoed, *and* it said it saw a language other than the target | `failed`  | yes        |
| echoed, with nothing contradicting that       | `skipped`    | no         |

So the reported case — a German-profile user types English to an English reader —
is `skipped` and renders the plain text, with no error and no chip. It is
`skipped` whether or not `data[2]` came back, which matters because that slot is
undocumented. Showing the original is correct in every non-contradicted case, and
it is what removed the "Couldn't translate" that appeared on messages that were
never untranslatable.

Real failures are unaffected, because they never look like an echo: a timeout, a
429, a non-2xx, or an empty payload all produce no text at all, and those still
report `failed` with a working retry.

**Three things make it faster.** A bounded in-memory cache keyed on target + text
(hit costs no round trip, which is the largest single latency saving — chat is
repetitive, and greetings and "ok" come back constantly); in-flight coalescing, so
the same text asked for twice at once is sent once rather than racing the
endpoint's rate limit; and a 450ms pause before the retry, because the endpoint
answers 429 with an HTML page and an immediate second attempt usually earns a
second 429 and just doubles the worst case.

None of it is persisted. The cache is a speed hint, and writing translations to
disk would put message text in a second store nobody agreed to.

**Translation must be durable before delivery.** Translation and the message are
written together, so an insert failure leaves the bubble local and retryable;
there is no interval in which the friend can receive an untranslated row.

**Realtime is three channels, one per job.**

| Channel            | Carries                                                      |
| ------------------ | ------------------------------------------------------------ |
| `room:{roomId}`    | `postgres_changes` on `messages` (INSERT + UPDATE), room presence, `typing` broadcast |
| `user:{meId}`      | `postgres_changes` INSERT across all rooms, so the Chats list previews update without polling |
| `app:presence`     | App-level presence, including which room each user has open  |

`useRealtimeMessages` is the only owner of a room channel, so opening a chat
cannot leak a second subscription. Subscribing happens on focus and is torn down
on blur. On `CHANNEL_ERROR` / `TIMED_OUT` / `CLOSED` the UI shows *Reconnecting…*
as an overlay pill — overlaid, not stacked, so it never moves the list — retries
on a `1s → 2s → 4s → 8s → 15s` backoff, and refetches anything newer than the
last `created_at` it holds.

**Presence answers two questions, so it needs two sources.** *Are they here
now?* comes from room presence. *Are they in the app at all?* cannot: someone
sitting on the Chats list is in the app but in no room, so room-only presence
would report them offline. Hence `app:presence`, whose payload also carries the
room the user currently has open. Together they produce exactly three states:

```
in this room             → solid success ring, "In your circle"
in the app, another room → dashed muted ring, "In Melo"
not in the app           → no ring, "Reads in Portuguese"
```

App presence is tracked only in the foreground. Backgrounding untracks, so a
backgrounded device reads as offline rather than as a stale "Online".

**Typing is a broadcast, never a write.** Starting is throttled to one message
per 2s inside the service; stopping goes out immediately so the indicator cannot
stick, and a 3s idle timer on both ends is the belt-and-braces. Delivered and
read are real columns: delivered is stamped on arrival, read is debounced 300ms
and only while the chat is focused *and* the app is active, both filtered
server-side by `sender_id` so a device cannot stamp its own messages.

---

## The screens

Every file in `src/app/` is a route; `_layout.tsx` files are navigators.

| Route               | What it does                                                              |
| ------------------- | ------------------------------------------------------------------------- |
| `index.tsx`         | Renders nothing. Redirects to `/chats` or `/onboarding/welcome`.           |
| `onboarding/welcome`| Hero mark, tagline, *Get started*, and *I already have a Melo ID*.        |
| `onboarding/language`| Pick the language you read Melo in. Pre-selected from the device locale.  |
| `onboarding/name`   | Display name, max 30.                                                     |
| `onboarding/avatar` | Pick a bundled avatar, or keep your initials. Optional.                   |
| `onboarding/id`     | The Melo ID hero card. This is also where the profile row is created.     |
| `onboarding/recover`| Adopt an existing profile from a Melo ID, onto a new device.              |
| `connect.tsx`       | Your ID with a copy button, a dashed field for theirs, *Start Chat*.      |
| `chats/index.tsx`   | Home: stories row, conversation list, your profile, connect button.       |
| `chats/[roomId]`    | One conversation: header, message list, composer, friend sheet.           |

Language, name and avatar are written to a separate `melo.onboarding.draft.v1` key
as each screen is passed, so backing out of the ID screen does not throw them away.
The draft is cleared the moment the profile exists. The avatar specifically must
not be written to the database at its own step: the profile row is created exactly
once, at the ID screen, and writing earlier would mean creating it twice and
fighting the Melo ID collision retry.

Errors on *Connect* appear inline under the field, never in a modal: the user is
typing an ID they read off another device, and a dialog would hide the field they
need to fix. It also distinguishes *"That ID doesn't exist"*, *"That's your own
ID"*, and a generic failure.

---

## Architecture

Screens never call Supabase. A screen uses a hook, the hook uses a service, the
service owns the query.

```
src/
  app/                    Expo Router routes (see above)
  components/
    chat/                 bubbles, list, composer, header, stories row, chat row, typing
    onboarding/           shared onboarding shell, language row
    profile/              friend sheet, your profile sheet, profile provider,
                          avatar grid
    providers/            app-level presence
    ui/                   button, icon, icon button, dashed border/icon button,
                          avatar, sheet, mascot, ambient glow, progress bar,
                          copy button, screen header, MeloMark
  constants/
    languages.ts the 11 languages, RTL, locale matching
    avatars.ts     the 16 bundled avatars as a static require map
  hooks/                  useProfile, useChat, useChats, useRealtimeMessages,
                          usePresence, usePressable, useReducedMotion, useTheme
  services/               supabase, profile, rooms, messages, translation,
                          realtime, onboardingDraft, logger
  theme/                  colors, typography, fonts, motion, layout
  types/                  database (generated) + app models
  utils/                  clipboard, grouping, time
```

The layer boundaries are load-bearing rather than decorative:

- `mergeMessages` is the single place duplicates are prevented, and it preserves
  the client-only `sendState` the server row knows nothing about.
- `useRealtimeMessages` separates *server fields* (arriving over the socket) from
  *local state* (`sendState`, driven by us), because a send that times out has to
  be able to move off "sending" with no server involvement.
- `useChat` tags its room-load result with the id it was resolved for, so
  navigating between chats renders the new room as loading immediately rather than
  flashing the previous room's data.
- **Every friend fetch uses `select('*')`** — `listChats`, the chat-open lookup,
  and the connect lookup. That is why adding `avatar_key` needed no query changes
  and no new endpoint: profiles are re-read on open rather than cached, so there is
  no avatar state anywhere to invalidate.

### Diagnostics

Everything is logged to the console under a `[melo]` prefix, scoped by area
(`translation`, `messages`, `profile`, `rooms`, `realtime`, `onboarding`, …).
`debug` is compiled out of production; `info` is the production minimum; `warn` and
`error` go to `console.warn`/`console.error` so React Native's LogBox surfaces
failures on-device. Filter Metro on `[melo]` to see only these.

Message text appears in logs only as a character count, plus a 40-character preview
at `debug`. Melo already sends real conversations to a third party; a log line that
outlives the request is a second copy nobody agreed to.

---

## Design system

**Type.** Three bundled faces, loaded at runtime with `useFonts` rather than the
`expo-font` config plugin — plugin-embedded fonts only exist in a native build,
and this app is developed against Expo Go.

| Family           | Role                                                      |
| ---------------- | --------------------------------------------------------- |
| `Gliker`         | Display only: headlines, wordmark. One weight.            |
| `Bagoss Standard`| Everything else, at Regular / Medium / Bold.              |
| `JetBrains Mono` | The Melo ID, and nothing else — it has to line up.        |

`useFonts` takes a flat name → file map with no weight metadata, so each static
cut is registered under its own family name and `typography` pins `fontWeight`
to `400`. That is why the type scale cannot rely on weight selection.

**Colour.** Ember `#ff8a2b` is the accent, Sky `#3E7BFA` is info. Light and dark
palettes are hand-written rather than derived; `withAlpha()` is available for the
places a token has to sit on a fill it does not belong to. The native background
is kept in sync with the palette so screen transitions never flash the wrong
colour.

**Layout.** A 4pt grid, `screenPadding` 20. Bubbles are radius 22 with the
tail-side bottom corner tightened to 8, which is what makes a run of bubbles read
as one block. Cards 26, rows 18, inputs 20, hit targets never below 44.

**Motion.** Durations live in `src/theme/motion.ts`: `fast` 150ms, `base` 250ms,
`slow` 400ms, `burst` 800ms, on a spring of damping 18 / stiffness 220. New
messages appear with a brief 150ms fade; message text stays still and level.
Buttons press to 0.96, and the *Original* panel expands in place.

**Reduce Motion is a different animation, not a faster one.** `useReducedMotion`
tracks the OS setting live, and when it is on, transforms are swapped for plain
fades — no scaling presence ring, no mascot bob. Every
Reanimated config is additionally built with `ReduceMotion.System` so anything
still running collapses to its end value.

**Avatars are a pick, not an upload.** 16 bundled PNGs in `assets/avatars/`, each
192×192 with alpha, 12.7–16.1 KB — 232 KB total. They were resized down from
8.9 MB of source art, because the largest one renders at 56pt. `src/constants/
avatars.ts` holds a static `slug → require(...)` map, and `profiles.avatar_key`
stores the slug.

The map is not indirection for its own sake. Metro resolves assets at build time
and only bundles what it can see in a literal `require()`, so a path built from a
string works in the dev server and ships as nothing at all. Storing a slug and
indexing a literal map is the only version that survives a release build.

`Avatar` takes an optional `avatarKey`; with no key, or an unrecognised one, it
renders initials exactly as before. That is the normal case, not an error path —
`null` is also the stored value for anyone who never picked, and for a key from a
build that no longer bundles the image. The disc clips, so a square source becomes
a circle with no second mask, and the presence ring is untouched. Every call site
passes one prop.

Your friend sees an avatar change the next time that chat or the chats list is
opened. An **already-open** chat keeps the old one until reopened: there is no
`profiles` listener, because rooms.ts is already subscribed for messages and
presence and a second subscription for something two people on a good connection
will not notice is not worth it.

The artwork is ripped from emojis.com and depicts anime, comic-book and Disney
characters. That is fine for a private database between friends. **It is not fine
in an app store** — replace it with original or licensed art before distributing.

**Rolly**, the mascot, is `assets/thinking_rolly.svg` with a 3s vertical bob,
rendered beside a speech bubble on the onboarding steps and the empty chats state.

---

## Database

Three tables. The migrations in `supabase/migrations/` are the source of truth;
`combined-setup.sql` is all four of them concatenated and is safe to re-run.

| Table      | Columns                                                                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles` | `id` (uuid PK), `melo_id` (unique, `^[a-z0-9]{6,11}$`), `display_name` (1–30), `reading_language`, `avatar_key` (nullable slug), `created_at`, `updated_at` |
| `rooms`    | `id` (text PK), `user_one_id`, `user_two_id`, `created_at`, `updated_at`; `user_one_id <> user_two_id`, unique on the pair                        |
| `messages` | `id` (uuid PK), `room_id`, `sender_id`, `original_text` (1–4000), `translated_text`, `source_language`, `target_language`, `translation_status`, `created_at`, `delivered_at`, `read_at` |

`translation_status` is a `CHECK` over `pending | translated | failed | skipped`.

`avatar_key` is nullable with no default and no CHECK. Null means "never picked
one" and renders initials, which is what every existing profile already looks like
— so `0004` is a no-op on current data, with no backfill and no rewrite. The slug
list is deliberately *not* a constraint: it lives in the client and grows with an
asset drop, and a constraint would reject a key the app happily offers.

Display names are **not** unique. Two people can both be called Alex; the Melo ID
suffix is what keeps them apart, and a room is two UUIDs rather than two names.

Indexes that earn their keep: `profiles (melo_id)` for every connect lookup, a
composite on `rooms (user_one_id)` and `(user_two_id)`, `messages (room_id,
created_at desc)` to serve the newest-first history, and a **partial** index on
`messages (room_id) where `read_at is null` so the unread query stays small no
matter how much history accumulates. `touch_updated_at()` is a
`SECURITY INVOKER` trigger with an empty `search_path`, wired to `profiles` and
`rooms`. `0002_realtime.sql` adds `public.messages` to the `supabase_realtime`
publication, which is what carries translation completion, delivered, and read
to the other device.

Run `supabase/verify.sql` afterwards to confirm both the row counts and the
publication membership.

---

## Things you should know before you trust this with real conversations

These are deliberate MVP limits, not oversights.

- **No authentication, and RLS is off.** The anon key is in the bundle and every
  table is world-readable and world-writable, so anyone with the URL and key can
  read every row. That is fine on a private project you own; it is not fine if
  you put real conversations in it. The migration says so at the top.
- **A Melo ID is the only credential, and it is guessable.** Recovery and
  name-derived IDs both widen this: anyone holding your ID can adopt your profile
  on a new device. With RLS off there is nothing behind it at all.
- **The avatar artwork is not distributable.** Bundled characters from
  emojis.com. Fine privately, not fine in a store.
- **The translation endpoint is an unofficial, unauthenticated web endpoint**
  (`translate.googleapis.com/translate_a/single?client=gtx`). It is rate-limited
  and unreliable. It can be slow, truncate, be blocked, or be down. The UI treats
  every one of those as a normal, recoverable state, which is why the wrapper
  exists: 6s timeout, one retry, all response segments joined, and an
  untranslated-echo check that catches a service silently returning the input.
  That check now leans on the service's own detected language to tell "already in
  your language" apart from "we failed" — see above.
- **`data[2]` is undocumented.** The whole `skipped`-instead-of-`failed`
  distinction rests on an index the endpoint does not document and has moved
  before. It is validated as a language tag and falls back to the old
  conservative behaviour if absent, but this has only been exercised against
  recorded response shapes, not a live call.
- **Translations are not private.** Message text is sent to a third-party
  translation service. Do not use Melo for anything you would not paste into a
  search engine.
- **No push notifications.** A message only arrives while Melo is open. There are
  no background sockets, by design.
- **History is the last 50 messages** per room, and no older page is ever loaded.
- **A Melo ID is permanent until you delete the app**, and there is no way to
  rotate it. `onboarding/recover` exists for the case where you lost the device,
  not as a normal sign-in.
- **Two people, per room, per database.** There is no group chat, no room list
  beyond your own, and no way to leave a conversation.

### Before this is more than friends

The full plan is in [`supabase/README.md`](supabase/README.md) → *Phase 10*:

1. Supabase Anonymous Auth, with `profiles.id = auth.uid()`.
2. RLS on `profiles`, `rooms`, `messages` with a policy per table.
3. `mark delivered` / `mark read` moved into `security definer` RPCs that verify
   the caller is the intended recipient.
4. Push notifications, so a closed app still tells you something arrived.
5. A server-side translation proxy with a real key, a real rate limit, and a cache
   — every network detail already lives behind `translateWithStatus`, so swapping
   the endpoint means editing `services/translation.ts` alone.
6. Delete and export, because it is your conversation and you should be able to
   take it with you.

### Explicitly not built

Group chats, more than two people, media, voice notes, search, message editing,
reactions, end-to-end encryption, web as a first-class target, accounts, real
authentication, and avatar upload (the 16 bundled ones are the whole feature).

---

## Planning and reference material in the repo

These are not shipped and not imported by any code path. They are the notes the
app was built from.

| File                          | What it is                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------- |
| `next.txt`                    | The "Honkish" design direction for Phase 9. Hearts on double-tap, streak flame, copy confetti, optional sound, greeting in the friend's language. **None of it is implemented** — the parts that shipped (presence rings, press squash, the mascot) are listed above. |
| `skills/design.md`            | A post on the Family wallet: simplicity, fluidity, delight. Melo takes the "delight is deliberate, not decorative" position from it. |
| `skills/never over engineer.md` | KISS rules for agents working in this repo.                                      |
| `skills/transitions-polish/`  | Motion-token scale and the refine rules. `src/theme/motion.ts` already encodes the durations. |
| `*.png`, `*.jpg` in the root  | Design references the UI was matched against (`fable-stories.png` is what `StoriesRow` cites). |

There are also files on disk that nothing imports yet, kept for the Phase 9 work
above: `assets/Flame - Streak.json` (Lottie), `assets/idle_rolly.svg`, and the
`CabinetGrotesk` family in
`assets/fonts/` (`fonts.ts` uses Gliker, Bagoss Standard, and JetBrains Mono —
`Mascot` requires the SVG asset directly). `assets/avatars/` is **not** in that
list any more: those 16 PNGs are bundled and rendered.

---

## Assets

The mark, icon, adaptive icon, monochrome layer, splash images, and favicon are
generated — not hand-drawn — by `scripts/generate-assets.mjs`, a dependency-free
PNG rasterizer with 4×4 supersampling. Edit the geometry there and re-run
`node scripts/generate-assets.mjs`; the same path data is mirrored in
`src/components/ui/MeloMark.tsx`, and `mark.paths()` prints the equivalent SVG
`d` strings.
