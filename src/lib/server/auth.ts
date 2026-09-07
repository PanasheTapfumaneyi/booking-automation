/**
 * Business authentication + membership enforcement (Phase 6A).
 *
 * Layering:
 *  - Identity comes from the request's Supabase session (cookie-bound server
 *    client). `getUser()` verifies the JWT against the Auth API — never
 *    trust a client-supplied user id.
 *  - Authorization is a server-side membership lookup
 *    (`business_members`) via the service-role client. RLS policies mirror
 *    the same rule in the database as defense in depth.
 *  - Every business API route goes through requireBusinessMembership /
 *    requireBusinessOwner — never trust a client-supplied business_id alone.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/server";
import { createServerAuthClient } from "@/lib/supabase/server-auth";
import { ApiError } from "@/lib/server/errors";
import { fetchBusiness, type BusinessRow } from "@/lib/server/database";

export interface AuthUser {
  id: string;
  email: string | null;
}

export interface Membership {
  business_id: string;
  role: string;
}

/** Minimal structural type for the session client (real or fake). */
export interface SessionClientLike {
  auth: {
    getUser: () => Promise<{ data: { user: { id: string; email?: string | null } | null } }>;
  };
}

type DbLike = Pick<SupabaseClient, "from">;

async function defaultSessionClient(): Promise<SessionClientLike> {
  return createServerAuthClient();
}

/** Returns the logged-in user, or null for anonymous requests. */
export async function getRequestUser(
  client?: SessionClientLike,
): Promise<AuthUser | null> {
  const session = client ?? (await defaultSessionClient());
  const { data } = await session.auth.getUser();
  if (!data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

/** 401 unless the request carries a valid business-user session. */
export async function requireAuthenticatedUser(
  client?: SessionClientLike,
): Promise<AuthUser> {
  const user = await getRequestUser(client);
  if (!user) {
    throw new ApiError(401, "UNAUTHENTICATED", "Please log in to continue.");
  }
  return user;
}

/** All memberships of a user (service-side read, newest business first). */
export async function getMyMemberships(
  userId: string,
  db?: DbLike,
): Promise<Membership[]> {
  const client = (db ?? getSupabase()) as SupabaseClient;
  const { data, error } = await client
    .from("business_members")
    .select("business_id, role")
    .eq("user_id", userId);
  if (error || !Array.isArray(data)) return [];
  return (data as Array<Record<string, unknown>>)
    .filter((r) => typeof r.business_id === "string")
    .map((r) => ({ business_id: r.business_id as string, role: String(r.role ?? "owner") }));
}

/**
 * Business ids of the current session user (empty when anonymous or when
 * auth is unconfigured). Used to admit member businesses to self-service
 * flows without trusting client input.
 */
export async function getMyBusinessIds(
  client?: SessionClientLike,
): Promise<string[]> {
  const user = await getRequestUser(client).catch(() => null);
  if (!user) return [];
  const memberships = await getMyMemberships(user.id).catch(() => []);
  return memberships.map((m) => m.business_id);
}

/** True when at least one owner/member row exists (service-side, no user). */
export async function businessHasMembers(
  businessId: string,
  db?: DbLike,
): Promise<boolean> {
  const client = (db ?? getSupabase()) as SupabaseClient;
  const { data } = await client
    .from("business_members")
    .select("id")
    .eq("business_id", businessId)
    .limit(1);
  return Array.isArray(data) && data.length > 0;
}

/** Single membership lookup — the ownership check everything funnels through. */
export async function findMembership(
  userId: string,
  businessId: string,
  db?: DbLike,
): Promise<Membership | null> {
  const client = (db ?? getSupabase()) as SupabaseClient;
  const { data, error } = await client
    .from("business_members")
    .select("business_id, role")
    .eq("user_id", userId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  return { business_id: row.business_id as string, role: String(row.role ?? "owner") };
}

export interface BusinessContext {
  user: AuthUser;
  membership: Membership;
  business: BusinessRow;
}

/**
 * 401 when anonymous, 403 when the user is not a member of `businessId`,
 * 404 when the business does not exist. Returns everything downstream
 * handlers need so routes never re-query membership themselves.
 */
export async function requireBusinessMembership(
  businessId: string,
  opts?: { client?: SessionClientLike; db?: DbLike },
): Promise<BusinessContext> {
  const user = await requireAuthenticatedUser(opts?.client);
  const membership = await findMembership(user.id, businessId, opts?.db);
  if (!membership) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "You don't have access to this business.",
    );
  }
  const business = await fetchBusiness(businessId, opts?.db as SupabaseClient | undefined).catch(
    () => null,
  );
  if (!business) {
    throw new ApiError(404, "BOOKING_NOT_FOUND", "Business not found.");
  }
  return { user, membership, business };
}

/**
 * Pilot ownership gate. Today every member is an owner; the role check
 * future-proofs Phase 6B staff roles without changing call sites.
 */
export async function requireBusinessOwner(
  businessId: string,
  opts?: { client?: SessionClientLike; db?: DbLike },
): Promise<BusinessContext> {
  const ctx = await requireBusinessMembership(businessId, opts);
  if (ctx.membership.role !== "owner") {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Only the business owner can do this.",
    );
  }
  return ctx;
}
