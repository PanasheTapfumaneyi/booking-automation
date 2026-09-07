import { createBrowserClient } from "@supabase/ssr";
import { AppConfigError } from "@/lib/server/errors";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Browser-side Supabase client for business authentication (login/signup/
 * logout/session). Uses the publishable anon key — RLS still applies, and
 * all privileged reads/writes stay in server code with the service role.
 */
export function createBrowserAuthClient() {
  if (!SUPABASE_URL || !ANON_KEY) {
    throw new AppConfigError(
      "Business login isn't configured. Add NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment (see .env.example).",
    );
  }
  return createBrowserClient(SUPABASE_URL, ANON_KEY);
}
