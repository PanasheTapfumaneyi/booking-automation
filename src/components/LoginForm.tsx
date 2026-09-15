"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserAuthClient } from "@/lib/supabase/browser";

/** Shared email+password form for /login and /signup. */
export default function LoginForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailed, setEmailed] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = createBrowserAuthClient();
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          // Email confirmation is on — the owner finishes via inbox link.
          setEmailed(true);
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      }
      router.push(next);
      router.refresh();
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (emailed) {
    return (
      <div className="mx-auto w-full max-w-md px-5 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Check your inbox</h1>
        <p className="mt-2 text-ink-soft">
          We sent a confirmation link to {email.trim()}. Open it to finish
          creating your account, then log in.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-lg bg-blue px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-strong"
        >
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-5 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        {mode === "signup" ? "Create your business account" : "Business login"}
      </h1>
      <p className="mt-1.5 text-ink-soft">
        {mode === "signup"
          ? "Set up online booking for your business in a few minutes."
          : "Manage your business, services and settings. Customers never need an account to book."}
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
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-xl border border-line bg-card px-4 py-3 text-base font-normal outline-none focus:border-blue"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Password
          {mode === "signup" && (
            <span className="text-xs font-normal text-ink-soft">
              At least 6 characters.
            </span>
          )}
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rounded-xl border border-line bg-card px-4 py-3 text-base font-normal outline-none focus:border-blue"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="mt-2 rounded-lg bg-blue px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-blue-strong disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy
            ? mode === "signup"
              ? "Creating account…"
              : "Logging in…"
            : mode === "signup"
              ? "Create account"
              : "Log in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-ink hover:underline">
              Log in
            </Link>
          </>
        ) : (
          <>
            New to Kivo?{" "}
            <Link href="/signup" className="font-medium text-ink hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
