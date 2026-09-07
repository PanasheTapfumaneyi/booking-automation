"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserAuthClient } from "@/lib/supabase/browser";

/** /logout — signs the business user out, then returns home. */
export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    createBrowserAuthClient()
      .auth.signOut()
      .catch(() => undefined)
      .finally(() => {
        if (cancelled) return;
        router.push("/");
        router.refresh();
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="mx-auto w-full max-w-md px-5 py-24 text-center">
      <p className="text-ink-soft">Logging you out…</p>
    </div>
  );
}
