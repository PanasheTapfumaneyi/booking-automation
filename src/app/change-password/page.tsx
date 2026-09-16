"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserAuthClient } from "@/lib/supabase/browser";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      const client = createBrowserAuthClient();
      const { error: updateError } = await client.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;
      setSuccess(true);
      setBusy(false);
      await client.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-5 py-24">
      <h1 className="text-2xl font-semibold tracking-tight">Change password</h1>
      <p className="mt-2 text-ink-soft">
        Choose a new password for your account.
      </p>

      {success && (
        <div
          role="alert"
          className="mb-6 mt-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          Your password has been updated successfully.
        </div>
      )}

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
          <span className="text-xs font-normal text-ink-soft">At least 8 characters.</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={busy}
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
          {busy ? "Updating…" : "Change password"}
        </button>
      </form>
    </div>
  );
}
