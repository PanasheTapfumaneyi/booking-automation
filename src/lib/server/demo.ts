/**
 * Demo-business identification (server-side only).
 *
 * Demo state is an explicit `businesses.is_demo` boolean resolved from a
 * server-fetched business row. It is NEVER trusted from client input —
 * every guard below receives a row (or row-derived object) loaded via the
 * service-role client.
 *
 * Only the literal value `true` counts as demo. Missing/nullable flags
 * (e.g. hand-built test rows) are treated as production.
 */
export function isDemoBusiness(business: {
  id: string;
  is_demo?: boolean | null;
}): boolean {
  return business.is_demo === true;
}
