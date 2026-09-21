"use client";

import { useState } from "react";
import OnboardingFlow from "@/components/OnboardingFlow";

export default function AdminCreateBusinessPage() {
  const [ownerUserId, setOwnerUserId] = useState("");
  const [isDemo, setIsDemo] = useState(true);
  const [ready, setReady] = useState(false);

  const inputClass =
    "rounded-xl border border-line bg-card px-4 py-3 text-base outline-none focus:border-blue disabled:opacity-40";

  if (!ready) {
    return (
      <div className="mx-auto w-full max-w-xl px-5 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Create business profile
        </h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          Set up a business for a client. You&apos;ll go through the same
          onboarding flow they would.
        </p>

        <div className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Owner user ID
            <span className="text-xs font-normal text-ink-soft">
              The Supabase Auth user ID of the person who will own this
              business. They must already have an account.
            </span>
            <input
              value={ownerUserId}
              onChange={(e) => setOwnerUserId(e.target.value)}
              className={inputClass}
              placeholder="00000000-0000-4000-8000-000000000000"
            />
          </label>

          <div className="flex flex-col gap-2.5">
            <p className="text-sm font-medium">Site type</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsDemo(true)}
                className={[
                  "flex-1 rounded-xl border p-4 text-left transition-all",
                  isDemo
                    ? "border-blue bg-blue-mist ring-1 ring-blue"
                    : "border-line bg-card hover:border-blue/50",
                ].join(" ")}
              >
                <span className="font-semibold">Demo</span>
                <span className="mt-1 block text-sm text-ink-soft">
                  For cold-call demos. Not public.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setIsDemo(false)}
                className={[
                  "flex-1 rounded-xl border p-4 text-left transition-all",
                  !isDemo
                    ? "border-blue bg-blue-mist ring-1 ring-blue"
                    : "border-line bg-card hover:border-blue/50",
                ].join(" ")}
              >
                <span className="font-semibold">Live</span>
                <span className="mt-1 block text-sm text-ink-soft">
                  Real client site. Publicly visible.
                </span>
              </button>
            </div>
          </div>

          <button
            type="button"
            disabled={ownerUserId.trim().length < 10}
            onClick={() => setReady(true)}
            className="mt-2 rounded-full bg-blue px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-blue-strong disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue to setup
          </button>
        </div>
      </div>
    );
  }

  return (
    <OnboardingFlow
      apiPrefix="/api/admin/businesses"
      isDemo={isDemo}
      ownerUserId={ownerUserId.trim()}
      completionHref="/admin/businesses"
    />
  );
}
