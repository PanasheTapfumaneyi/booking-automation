"use client";

/**
 * /auth/recovery — Password-reset landing page.
 *
 * Supabase sends the user here after they click the recovery email link.
 * With PKCE auth (the default in Supabase JS v2) the URL contains an
 * `?code=...` query parameter. The Supabase client exchanges that code for
 * a recovery session automatically when `detectSessionInUrl` is true
 * (the library default). We watch `onAuthStateChange` for the
 * `PASSWORD_RECOVERY` event, which fires once the exchange completes, and
 * only then show the new-password form.
 *
 * Expired / invalid links never produce a PASSWORD_RECOVERY event.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserAuthClient } from "@/lib/supabase/browser";

type PageState =
  | "waiting"  // Waiting for Supabase to exchange the code/hash
  | "ready"    // Recovery session established — show the form
  | "success"  // Password updated successfully
  | "invalid"; // Link expired, already used, or malformed

export default function RecoveryPage() {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>("waiting");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let client: ReturnType<typeof createBrowserAuthClient>;
    let isMounted = true;
    try {
      client = createBrowserAuthClient();
    } catch {
      // auth unconfigured — treat as invalid link
      const t = setTimeout(() => {
        if (isMounted) setPageState("invalid");
      }, 0);
      return () => {
        isMounted = false;
        clearTimeout(t);
      };
    }

    // Supabase fires PASSWORD_RECOVERY once it has exchanged the code/hash
    // embedded in this URL. If no recovery token is present (direct nav,
    // expired link, already-used link), this event never fires.
    const { data: listener } = client.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setPageState("ready");
      }
    });

    // Fallback: if 5 seconds pass without a recovery event, treat the link
    // as invalid. Real recovery links resolve almost instantly.
    const timeout = setTimeout(() => {
      setPageState((current) => (current === "waiting" ? "invalid" : current));
    }, 5000);

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const client = createBrowserAuthClient();
      const { error: updateError } = await client.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;
      // Sign out so the user is cleanly prompted to log in with the new password.
      await client.auth.signOut();
      setPageState("success");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  // ── Waiting ──────────────────────────────────────────────────────────────
  if (pageState === "waiting") {
    return (
      <div className="mx-auto w-full max-w-md px-5 py-24 text-center">
        <p className="text-ink-soft">Verifying your reset link…</p>
      </div>
    );
  }

  // ── Invalid / expired ────────────────────────────────────────────────────
  if (pageState === "invalid") {
    return (
      <div className="mx-auto w-full max-w-md px-5 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Link expired</h1>
        <p className="mt-2 text-ink-soft">
          This password reset link is invalid or has already been used.
        </p>
        <a
          href="/forgot-password"
          className="mt-6 inline-block rounded-full bg-blue px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-strong"
        >
          Request a new link
        </a>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (pageState === "success") {
    return (
      <div className="mx-auto w-full max-w-md px-5 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Password updated</h1>
        <p className="mt-2 text-ink-soft">
          Your password has been changed. You can now log in.
        </p>
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="mt-6 rounded-full bg-blue px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-strong"
        >
          Go to login
        </button>
      </div>
    );
  }

  // ── Ready — show the form ─────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-md px-5 py-24">
      <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="mt-2 text-ink-soft">
        Enter and confirm your new password below.
      </p>

      {error && (
        <div
          role="alert"
          className="mb-6 mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          New password
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={busy}
            placeholder="At least 8 characters"
            className="rounded-xl border border-line bg-card px-4 py-3 text-base outline-none focus:border-blue disabled:opacity-40"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Confirm new password
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={busy}
            className="rounded-xl border border-line bg-card px-4 py-3 text-base outline-none focus:border-blue disabled:opacity-40"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="mt-2 rounded-full bg-blue px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-blue-strong disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
