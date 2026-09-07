import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { AppConfigError } from "@/lib/server/errors";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Server-side Supabase client bound to the request's auth cookies.
 *
 * Used for reading the logged-in business user (getUser verifies the JWT
 * against the Auth API server-side). Never exposes the service role key;
 * privileged data access stays in `@/lib/supabase/server` after an explicit
 * membership check in `@/lib/server/auth`.
 */
export async function createServerAuthClient() {
  if (!SUPABASE_URL || !ANON_KEY) {
    throw new AppConfigError(
      "Business login isn't configured. Add NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment (see .env.example).",
    );
  }
  const store = await cookies();
  return createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(toSet) {
        // setAll is a no-op in read-only contexts (Server Components);
        // middleware refreshes cookies on the response instead.
        try {
          toSet.forEach(({ name, value, options }) =>
            store.set(name, value, options),
          );
        } catch {
          // ignore — middleware handles persistence
        }
      },
    },
  });
}
