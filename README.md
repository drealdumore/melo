# Melo

Private, two-person, real-time chat that translates as it goes. Write in the
language you think in; your one friend reads it in theirs. Originals are never
destroyed — every translation is one tap from the message it came from.

Built for three people. It is not a group-chat app, and it is not trying to be.

---

## Quick start

```bash
npm install
cp .env.example .env      # then paste in your Supabase keys
npm start                 # press i / a, or scan the QR with Expo Go
```

Then follow [`supabase/README.md`](supabase/README.md) to create the database
before you run the app. Without Supabase credentials the app still starts, but
it has nowhere to store profiles or messages.

### Running it

| Target        | Command             | Notes                                                    |
| ------------- | ------------------- | -------------------------------------------------------- |
| Expo Go       | `npm start`         | Works. No custom native modules are used.                 |
| iOS simulator | `npm run ios`       |                                                          |
| Android       | `npm run android`   |                                                          |
| Web           | `npm run web`       | For layout work only. The translation endpoint is CORS-restricted. |

Expo Go is genuinely enough here: every native dependency (`expo-clipboard`,
`expo-crypto`, `expo-haptics`, `expo-system-ui`, `react-native-svg`) ships
inside Expo Go. If you later add something with its own native code, you will
need a development build — `npx expo run:ios` or `eas build --profile
development`.

### Checks

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
```

Both are clean. `npm run db:types` regenerates `src/types/database.ts` from your
database after a schema change; see the script header for usage.

---

## Environment

| Variable                        | Where it comes from              |
| ------------------------------- | -------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`      | Supabase → Project Settings → API |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys |

`.env` is gitignored. `.env.example` is committed. Expo inlines
`EXPO_PUBLIC_*` variables into the bundle, so the anon key is visible to anyone
with the app — which is fine, and only fine, as long as RLS is on. See below.

---

## How it works

**Identity is your device, not an account.** On first run the app generates a
UUID and an 11-character Melo ID (`abcdefghjkmnpqrstuvwxyz23456789` — no `i`,
`l`, `o`, `0`, `1`) and stores both in AsyncStorage. That ID is how you meet
someone. Uninstalling the app loses it permanently; there is no recovery.

**Rooms are derived, not generated.** A room's primary key is
`sorted(meloA, meloB).join('-')`. If you and your friend both tap *Start Chat*
at the same moment, you cannot create two rooms — the second insert collides and
is dropped.

**Sending is optimistic.** The bubble appears instantly with a client-generated
UUID. The insert has a 10-second timeout; a duplicate-key error counts as
success, which is what makes *retry* safe, because the retry reuses the same
UUID.

**Translation is a client-side pass.** The original goes into `messages`
immediately as `pending`. Melo then calls the translation endpoint, joins every
segment of the response, and patches the row to `translated` — or to `failed`,
which the bubble reports honestly rather than hiding. If both people read the
same language the status is `skipped` and nothing is sent anywhere.

**Realtime is one channel per room.** `room:{roomId}` carries Postgres changes,
presence, and typing. Typing is a broadcast, never a write, and clears after
3 seconds on both ends. On a dropped channel Melo backs off, reconnects, and
refetches anything newer than the last row it holds.

### Layout

```
src/
  app/                    Expo Router routes
    _layout.tsx           providers, stack, splash control
    index.tsx             onboarding-or-chats redirect
    connect.tsx           enter a friend's Melo ID
    onboarding/           welcome → profile → your ID
    chats/                list, and chats/[roomId]
  components/
    chat/                 bubbles, list, composer, header, typing, row
    profile/              friend summary, your profile editor
    ui/                   button, icon, mark, sheet, copy-ID
  hooks/                  useProfile, useChat, useChats, useRealtimeMessages…
  services/               supabase, profile, rooms, messages, translation
  theme/                  colors, typography, motion, layout
  types/                  database + app models
  utils/                  grouping, time
```

Screens never call Supabase directly. They use a hook; the hook uses a
service; the service owns the query. `useRealtimeMessages` is the only owner of
a room channel, which is why opening a chat cannot leak a second subscription.

---

## Things you should know before you trust this with real conversations

These are deliberate MVP limits, not oversights.

- **No authentication.** The anon key is in the app and RLS is disabled, so
  anyone with the URL and key can read every row. That is fine on a private
  project you own; it is not fine if you put real conversations in it. The
  migration files say this at the top.
- **The translation endpoint is a public web endpoint**, rate-limited and
  unreliable. It can be slow, it can truncate, and it can be down. The UI treats
  every one of those as a normal, recoverable state.
- **Translations are not private.** Message text is sent to a third-party
  translation service. Do not use Melo for anything you would not paste into a
  search engine.
- **No push notifications.** A message only arrives while Melo is open. There
  are no background sockets, by design.
- **History is the last 50 messages** per room, and no older pages are loaded.
- **Uninstalling loses your identity** and your Melo ID. Your friend can no
  longer find you.

### Before this is not just for friends — Phase 10 hardening

1. Real auth (Supabase Auth) and turn RLS on, with policies per table.
2. Push notifications, so a closed app still tells you something arrived.
3. Swap the public translation endpoint for a server-side proxy with a key, a
   real rate limit, and a cache.
4. Profile editing that can change your name and your language without losing
   your ID.
5. Delete and export, because it is your conversation and you should be able to
   take it with you.

### Explicitly not built

Group chats, more than two people, media, voice notes, search, message editing
or deletion, reactions, end-to-end encryption, web as a first-class target, and
accounts.

---

## Assets

The mark, icon, adaptive icon, monochrome layer, splash images, and favicon are
generated — not hand-drawn — by `scripts/generate-assets.mjs`, a dependency-free
PNG rasterizer. Edit the geometry there and re-run `node
scripts/generate-assets.mjs`; the same path data lives in
`src/components/ui/MeloMark.tsx`.
