/**
 * Setup lifecycle vocabulary (pure — safe for client components).
 *
 * Server logic lives in `@/lib/server/onboarding`, which re-exports these.
 */

/** Lifecycle states. `live` is the terminal state (business fully active). */
export const SETUP_STATUSES = [
  "new",
  "pending_setup",
  "contacted",
  "setting_up",
  "self_configuring",
  "ready_for_review",
  "live",
] as const;

export type SetupStatus = (typeof SETUP_STATUSES)[number];

/** Owner setup choices. */
export const SETUP_PREFERENCES = ["managed", "self"] as const;

export type SetupPreference = (typeof SETUP_PREFERENCES)[number];
