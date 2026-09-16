"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserAuthClient } from "@/lib/supabase/browser";

export default function AccountPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadEmail() {
      try {
        const client = createBrowserAuthClient();
        const result = await client.auth.getSession();
        const data = result.data ?? result;
        if (data.session?.user?.email) {
          setEmail(data.session.user.email);
        }
      } catch {
        // ignored
      }
    }
    loadEmail();
  }, []);

  async function handleChangePassword() {
    router.push("/change-password");
    router.refresh();
  }

  async function handleSignOut() {
    setBusy(true);
    setError(null);
    try {
      const client = createBrowserAuthClient();
      await client.auth.signOut();
      router.push("/");
      router.refresh();
    } catch {
      setError("Sign out failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-5 py-24">
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Account</h1>

      <div className="mt-8 space-y-4">
        <div>
          <p className="text-sm font-medium text-ink">Email address</p>
          <p className="mt-1 text-ink-soft">{email || "Not added yet"}</p>
        </div>

        <div>
          <button
            onClick={handleChangePassword}
            className="w-full rounded-full bg-blue px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-strong disabled:cursor-not-allowed disabled:opacity-40"
          >
            Change password
          </button>
        </div>

        <div>
          <button
            onClick={handleSignOut}
            className="w-full rounded-full border border-line bg-card px-6 py-3 text-base font-medium text-ink-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            Logout
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}
    </div>
  );
}