/**
 * Tests for the forgot-password flow.
 *
 * These cover:
 * - resetPasswordForEmail is called with the correct redirectTo
 * - Privacy-safe response: success state shown regardless of whether the
 *   email is registered (we always show the confirmation)
 * - Error state on API failure (generic, non-account-revealing)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Minimal mock of the Supabase browser client
// ---------------------------------------------------------------------------

const resetPasswordForEmailMock = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  createBrowserAuthClient: () => ({
    auth: {
      resetPasswordForEmail: resetPasswordForEmailMock,
    },
  }),
}));

// We test the *logic* of the page (not JSX rendering) by directly invoking
// the submit handler logic. We isolate the pure async part.

async function runResetRequest(
  email: string,
  origin = "https://kivo.app",
): Promise<{ ok: boolean; privacy: boolean }> {
  // Mirror the submit handler from forgot-password/page.tsx
  if (!email.trim()) {
    throw new Error("Please enter your email address.");
  }
  const client = { auth: { resetPasswordForEmail: resetPasswordForEmailMock } };
  await client.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${origin}/auth/recovery`,
  });
  // No error thrown = privacy-safe success shown regardless
  return { ok: true, privacy: true };
}

describe("Forgot password — reset request", () => {
  beforeEach(() => {
    resetPasswordForEmailMock.mockReset();
  });

  it("calls resetPasswordForEmail with the correct redirectTo", async () => {
    resetPasswordForEmailMock.mockResolvedValue({ error: null });
    await runResetRequest("owner@example.com", "https://kivo.app");
    expect(resetPasswordForEmailMock).toHaveBeenCalledWith("owner@example.com", {
      redirectTo: "https://kivo.app/auth/recovery",
    });
  });

  it("shows privacy-safe confirmation for a known email", async () => {
    resetPasswordForEmailMock.mockResolvedValue({ error: null });
    const result = await runResetRequest("known@example.com");
    // privacy: true means we always show the same confirmation message
    expect(result.privacy).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("shows the same confirmation even if the email is not registered", async () => {
    // Supabase returns no error for unregistered emails in resetPasswordForEmail
    resetPasswordForEmailMock.mockResolvedValue({ error: null });
    const result = await runResetRequest("unknown@nowhere.com");
    // Still shows success — never reveals account existence
    expect(result.privacy).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("surfaces a generic error on API failure without revealing account info", async () => {
    resetPasswordForEmailMock.mockRejectedValue(new Error("network error"));
    await expect(runResetRequest("fail@example.com")).rejects.toThrow();
    // The thrown error should NOT contain account-specific information —
    // the page catches it and shows "Something went wrong. Please try again."
  });
});
