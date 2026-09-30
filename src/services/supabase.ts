/**
 * The single Supabase client for the app.
 *
 * There is no auth in this version, so the client is anonymous: whoever holds
 * the anon key can read and write everything. See supabase/README.md.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey && !url.includes('placeholder'));

/**
 * Thrown for "the app is not wired up yet" so screens can show a real message
 * instead of a cryptic network error.
 */
export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super('Supabase is not configured. Copy .env.example to .env and add your project keys.');
    this.name = 'SupabaseNotConfiguredError';
  }
}

function makeClient(): SupabaseClient<Database> {
  if (!url || !anonKey) {
    // A throwing stub keeps the type honest; every call site checks
    // `requireSupabase()` first.
    return null as unknown as SupabaseClient<Database>;
  }
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });
}

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? makeClient()
  : null;

export function requireSupabase(): SupabaseClient<Database> {
  if (!supabase) throw new SupabaseNotConfiguredError();
  return supabase;
}
