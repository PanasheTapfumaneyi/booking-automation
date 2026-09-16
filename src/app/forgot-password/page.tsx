"use client";

import { useState } from "react";
import Link from "next/link";
import { createBrowserAuthClient } from "@/lib/supabase/browser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const client = createBrowserAuthClient();
      // redirectTo must point to the recovery handler so Supabase embeds
      // the correct callback URL in the email. The recovery page exchanges
      // the code / session from the URL hash.
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      await client.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${origin}/auth/recovery`,
      });
      // Always show the privacy-safe confirmation regardless of whether
      // the email is registered — never expose account existence.
      setSubmitted(true);
    } catch {
      // Surface only generic errors so we never leak account existence.
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto w-full max-w-md px-5 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Check your inbox</h1>
        <p className="mt-2 text-ink-soft">
          If an account exists for that email address, we&apos;ve sent password
          reset instructions.
        </p>
        <p className="mt-6 text-sm text-ink-soft">
          Didn&apos;t get anything?{" "}
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="font-medium text-ink-soft underline hover:text-ink"
          >
            Try again
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-5 py-24">
      <h1 className="text-2xl font-semibold tracking-tight">Forgot password?</h1>
      <p className="mt-2 text-ink-soft">
        Enter your email address and we&apos;ll send you a reset link.
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
          Email address
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            placeholder="you@business.com"
            className="rounded-xl border border-line bg-card px-4 py-3 text-base outline-none focus:border-blue disabled:opacity-40"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="mt-2 rounded-full bg-blue px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-blue-strong disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        <Link href="/login" className="font-medium text-ink-soft hover:text-ink hover:underline">
          Back to login
        </Link>
      </p>
    </div>
  );
}
