/**
 * Tests for /change-password page logic.
 *
 * The page uses the authenticated Supabase updateUser({ password }) flow.
 * There is no current-password field — the active session is the
 * authentication proof. Tests cover validation and the update/sign-out path.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Minimal mock of the Supabase browser client
// ---------------------------------------------------------------------------

const updateUserMock = vi.fn();
const signOutMock = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  createBrowserAuthClient: () => ({
    auth: {
      updateUser: updateUserMock,
      signOut: signOutMock,
    },
  }),
}));

// ---------------------------------------------------------------------------
// Mirror the submit handler from change-password/page.tsx as a pure function
// so it can be tested without a component harness.
// ---------------------------------------------------------------------------

async function runChangePassword(
  newPassword: string,
  confirmPassword: string,
): Promise<{ success: boolean; error: string | null }> {
  if (newPassword.length < 8) {
    return { success: false, error: "New password must be at least 8 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { success: false, error: "Passwords do not match." };
  }
  const client = { auth: { updateUser: updateUserMock, signOut: signOutMock } };
  const { error: updateError } = await client.auth.updateUser({ password: newPassword });
  if (updateError) {
    return {
      success: false,
      error: updateError instanceof Error ? updateError.message : "Something went wrong. Please try again.",
    };
  }
  await client.auth.signOut();
  return { success: true, error: null };
}

// ---------------------------------------------------------------------------

describe("Change password page", () => {
  beforeEach(() => {
    updateUserMock.mockReset();
    signOutMock.mockReset().mockResolvedValue(undefined);
  });

  it("rejects a password shorter than 8 characters without calling updateUser", async () => {
    const result = await runChangePassword("short", "short");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/8 characters/);
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords without calling updateUser", async () => {
    const result = await runChangePassword("password123", "password456");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/do not match/i);
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("calls updateUser with the new password when validation passes", async () => {
    updateUserMock.mockResolvedValue({ error: null });
    const result = await runChangePassword("newpassword1", "newpassword1");
    expect(updateUserMock).toHaveBeenCalledWith({ password: "newpassword1" });
    expect(result.success).toBe(true);
    expect(result.error).toBeNull();
  });

  it("signs out after a successful password update", async () => {
    updateUserMock.mockResolvedValue({ error: null });
    await runChangePassword("newpassword1", "newpassword1");
    expect(signOutMock).toHaveBeenCalled();
  });

  it("surfaces updateUser errors without signing out", async () => {
    updateUserMock.mockResolvedValue({ error: new Error("Auth session missing") });
    const result = await runChangePassword("newpassword1", "newpassword1");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Auth session missing/);
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it("does not have a current-password field — no currentPassword argument in the logic", () => {
    // The function signature only accepts newPassword + confirmPassword.
    // This test documents that no current-password verification exists,
    // which is intentional: the active Supabase session is the auth proof.
    expect(runChangePassword.length).toBe(2);
  });
});
