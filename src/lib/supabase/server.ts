import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppConfigError } from "@/lib/server/errors";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let cachedClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);
}

/**
 * Server-only Supabase client authenticated with the service role key.
 *
 * Never import this module from a client component or "use client" file — the
 * service role key can read and write every row and must stay on the server.
 */
export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new AppConfigError(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and " +
        "SUPABASE_SERVICE_ROLE_KEY to your environment (see .env.example).",
    );
  }

  if (!cachedClient) {
    cachedClient = createClient(SUPABASE_URL as string, SERVICE_ROLE_KEY as string, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return cachedClient;
}