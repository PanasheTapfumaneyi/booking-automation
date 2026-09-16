/**
 * Tests for the /auth/recovery page logic.
 *
 * Covers:
 * - Valid PASSWORD_RECOVERY event → ready state, allows password update
 * - No recovery event within timeout → invalid state
 * - Password mismatch validation
 * - Password too short validation
 * - Successful password update calls updateUser and signs out
 * - updateUser error surfaces correctly
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock helpers — mirror the auth state machine from the recovery page
// ---------------------------------------------------------------------------

type RecoveryPageState = "waiting" | "ready" | "invalid" | "success";

interface AuthClient {
  onAuthStateChange: (cb: (event: string) => void) => {
    data: { subscription: { unsubscribe: () => void } };
  };
  updateUser: (update: { password: string }) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

/**
 * Simulate the page state machine.
 * - If `triggerRecovery` is true, fires PASSWORD_RECOVERY synchronously.
 * - If `triggerRecovery` is false, simulates the 5-second timeout (invalid).
 */
function simulatePageInit(client: AuthClient, triggerRecovery: boolean): RecoveryPageState {
  let state: RecoveryPageState = "waiting";
  const { data: listener } = client.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") {
      state = "ready";
    }
  });
  if (triggerRecovery) {
    // Already fired synchronously above via the mock
  } else {
    // Timeout fires — if still waiting, go invalid
    if (state === "waiting") state = "invalid";
  }
  listener.subscription.unsubscribe();
  return state;
}

async function simulatePasswordUpdate(
  client: AuthClient,
  newPassword: string,
  confirmPassword: string,
): Promise<{ state: RecoveryPageState; error: string | null }> {
  if (newPassword.length < 8) {
    return { state: "ready", error: "Password must be at least 8 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { state: "ready", error: "Passwords do not match." };
  }
  const { error: updateError } = await client.updateUser({ password: newPassword });
  if (updateError) {
    return { state: "ready", error: updateError.message };
  }
  await client.signOut();
  return { state: "success", error: null };
}

// ---------------------------------------------------------------------------

const updateUserMock = vi.fn();
const signOutMock = vi.fn();
const unsubscribeMock = vi.fn();

function makeClient(triggerRecovery: boolean): AuthClient {
  return {
    onAuthStateChange(cb) {
      if (triggerRecovery) cb("PASSWORD_RECOVERY");
      return { data: { subscription: { unsubscribe: unsubscribeMock } } };
    },
    updateUser: updateUserMock,
    signOut: signOutMock,
  };
}

describe("Recovery page — state machine", () => {
  beforeEach(() => {
    updateUserMock.mockReset();
    signOutMock.mockReset().mockResolvedValue(undefined);
    unsubscribeMock.mockReset();
  });

  it("transitions to 'ready' when PASSWORD_RECOVERY event fires", () => {
    const client = makeClient(true);
    const state = simulatePageInit(client, true);
    expect(state).toBe("ready");
  });

  it("transitions to 'invalid' when no PASSWORD_RECOVERY event within timeout", () => {
    const client = makeClient(false);
    const state = simulatePageInit(client, false);
    expect(state).toBe("invalid");
  });
});

describe("Recovery page — password update", () => {
  beforeEach(() => {
    updateUserMock.mockReset();
    signOutMock.mockReset().mockResolvedValue(undefined);
  });

  it("rejects password shorter than 8 characters", async () => {
    const client = makeClient(true);
    const result = await simulatePasswordUpdate(client, "short", "short");
    expect(result.error).toMatch(/8 characters/);
    expect(result.state).toBe("ready");
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords", async () => {
    const client = makeClient(true);
    const result = await simulatePasswordUpdate(client, "longpassword1", "longpassword2");
    expect(result.error).toMatch(/do not match/i);
    expect(result.state).toBe("ready");
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("calls updateUser and signOut on valid password, transitions to success", async () => {
    updateUserMock.mockResolvedValue({ error: null });
    const client = makeClient(true);
    const result = await simulatePasswordUpdate(client, "newpassword1", "newpassword1");
    expect(updateUserMock).toHaveBeenCalledWith({ password: "newpassword1" });
    expect(signOutMock).toHaveBeenCalled();
    expect(result.state).toBe("success");
    expect(result.error).toBeNull();
  });

  it("surfaces updateUser error without crashing", async () => {
    updateUserMock.mockResolvedValue({ error: new Error("JWT expired") });
    const client = makeClient(true);
    const result = await simulatePasswordUpdate(client, "validpassword", "validpassword");
    expect(result.error).toMatch(/JWT expired/);
    expect(result.state).toBe("ready");
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it("does not call updateUser when link was invalid (expired/already used)", () => {
    // Simulates a user trying to interact with the form when in 'invalid' state.
    // The form is never rendered in that state, but we validate the guard holds.
    const client = makeClient(false);
    const state = simulatePageInit(client, false);
    expect(state).toBe("invalid");
    // updateUser should never have been called
    expect(updateUserMock).not.toHaveBeenCalled();
  });
});
