"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserAuthClient } from "@/lib/supabase/browser";

/** Session-aware auth links for the navbar. Defaults to logged-out. */
export default function AuthLinks() {
  const [state, setState] = useState<"in" | "out">("out");

  useEffect(() => {
    let client;
    try {
      client = createBrowserAuthClient();
    } catch {
      return undefined; // auth unconfigured — keep the logged-out links
    }
    let cancelled = false;
    client.auth.getSession().then(({ data }) => {
      if (!cancelled) setState(data.session ? "in" : "out");
    }).catch(() => undefined);
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setState(session ? "in" : "out");
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  return state === "in" ? (
    <Link
      href="/dashboard"
      className="rounded-full border border-line px-4 py-2 text-sm font-medium hover:text-ink"
    >
      Dashboard
    </Link>
  ) : (
    <Link
      href="/login"
      className="rounded-full border border-line px-4 py-2 text-sm font-medium hover:text-ink"
    >
      Business login
    </Link>
  );
}
