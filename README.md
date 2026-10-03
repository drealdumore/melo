# Melo

Melo is a mobile-first, two-person chat for friends who read different
languages. Connect with a Melo ID, send a message in your own words, and see a
translation in your reading language. When a translation is available, the
original is one tap away.

> Expo SDK 57 · Expo Router · React Native 0.86 · React 19.2 · Supabase

## What the app includes

- Onboarding for a display name, reading language, optional bundled avatar, and
  a shareable Melo ID. The ID screen shows the ID before **Next** completes
  onboarding and opens Chats.
- Profile recovery on a new device using an existing Melo ID.
- One-to-one conversations started by entering a friend's Melo ID.
- Message delivery, translation status, retry controls, read receipts, typing
  indicators, and live presence while the app is open.
- Light and dark themes that follow the system setting.

The supported reading languages are English, Spanish, French, German,
Simplified Chinese, Arabic, Portuguese, Hindi, Swahili, Yoruba, and Korean.

## Development setup

### Requirements

- Node.js 20.19.4 or newer and pnpm
- A Supabase project for profiles, rooms, messages, and Realtime

### Install and configure

```sh
pnpm install
```

Copy `.env.example` to `.env` and fill in the project URL and **anon/publishable**
key from Supabase:

```sh
# PowerShell
Copy-Item .env.example .env

# macOS / Linux
cp .env.example .env
```

Apply the schema in [`supabase/combined-setup.sql`](supabase/combined-setup.sql)
to the project before using its network-backed features. It contains the four
current migrations in `supabase/migrations/`. See the
[`Supabase setup guide`](supabase/README.md) for the SQL Editor and CLI options.
Restart the development server after changing `.env`; Expo embeds
`EXPO_PUBLIC_*` variables in the app bundle.

Start the app:

```sh
pnpm start
```

Platform shortcuts are also available:

```sh
pnpm android
pnpm ios
pnpm web
```

`pnpm web` is useful for layout work; mobile is the primary target. The Expo CLI
scripts use `--offline` for CLI startup, but the running app still needs network
access for Supabase and translation.

The app can launch without Supabase credentials, but profiles cannot sync and
connecting or chatting requires a configured project.

## Useful commands

```sh
pnpm lint
pnpm typecheck
pnpm preview
```

`pnpm preview` starts an EAS Android preview build and requires the EAS CLI and
EAS credentials.
To regenerate database types after a schema change, use the script's documented
options:

```sh
node scripts/generate-db-types.mjs --project-id <project-ref>
node scripts/generate-db-types.mjs --local
```

The Supabase CLI must be available for type generation; the local option expects
a running local Supabase stack.

## How it works

### Identity and onboarding

Melo has no account sign-in. A UUID and Melo ID are generated on the device;
profile and onboarding data are kept in AsyncStorage and synchronized with the
Supabase `profiles` table. A Melo ID uses a readable name prefix and a random
suffix. It is used to find friends, not as a secure authentication credential.

Onboarding collects a reading language, name, and optional avatar before saving
the profile. The ID screen then shows the generated ID; tapping **Next** marks
setup complete and opens Chats. A saved onboarding draft preserves the answers
if setup is interrupted. The recovery flow can restore a profile when the user
provides its Melo ID.

### Chats and messages

Each room has exactly two participants. A room ID is derived from the pair's
Melo IDs, so both participants resolve to the same conversation.

Sending is optimistic: the sender sees the bubble immediately, then the app
inserts the original message with a `pending` translation status. The recipient
can read it while translation is in progress. Translation updates that message
to `translated`, `skipped` (no translation was needed), or `failed`; failed
translations keep the original available with a retry option. Received
translations can be tapped to reveal the original.

Supabase Realtime carries message changes, typing broadcasts, and room presence.
The Chats list also subscribes to message inserts to keep previews current.
Chat history currently loads up to 50 messages per room; older pages are not
loaded. Push notifications are not implemented, so messages arrive live only
while Melo is open.

### Translation and data

The app currently calls Google's unofficial web translation endpoint directly
from the client. Message text is sent to that third party; translation is not
end-to-end encrypted or private from the translation provider. The app keeps a
small in-memory cache and retries selected transient failures, but the endpoint
can be rate-limited or unavailable.

The Supabase schema is maintained in `supabase/migrations/`:

- `profiles` stores the device UUID, Melo ID, display name, reading language,
  and optional avatar key.
- `rooms` stores the two participants in a conversation.
- `messages` stores the original text, optional translation, translation
  status, and delivery/read timestamps.

The bundled avatar choices are licensed for use in this project; avatars are
not uploaded by users.

## Security and current limitations

**This app is an early private test, not safe for public deployment or sensitive
conversations.** The current schema has Row Level Security (RLS) disabled and
the app has no authentication. Anyone with the Supabase project URL and bundled
anon key can read or change database rows, including messages. Use only a
private test project and non-sensitive test data until authentication and
appropriate RLS policies are implemented. Never put a Supabase `service_role`
key in the app.

The Melo ID is guessable and acts as the only recovery credential. Anyone who
knows it can recover that profile on another device. Other current limits:

- Conversations are one-to-one; there are no group chats.
- There is no push notification support or background message delivery.
- Only the latest 50 messages are loaded; there is no older-history pagination.
- There is no account system, end-to-end encryption, media messaging, or
  in-app avatar upload.

## Project structure

```text
src/
  app/          Expo Router screens: onboarding, connect, Chats, and chat
  components/   chat, onboarding, profile, providers, and shared UI
  constants/    supported languages and bundled avatar map
  hooks/        profile, chat, Realtime, presence, theme, and UI hooks
  services/     Supabase, profiles, rooms, messages, translation, Realtime
  theme/        colors, typography, fonts, motion, and layout tokens
  types/        database-generated and app-facing types
  utils/        shared formatting and UI helpers
supabase/
  migrations/   database schema and Realtime migrations
```
