import type { Metadata } from "next";
import { requirePlatformAdmin } from "@/lib/server/auth";
import { getSupabase } from "@/lib/supabase/server";
import { listSetupRequests } from "@/lib/server/onboarding";
import type { SetupRequestWithBusiness } from "@/lib/server/onboarding";
import LeadsTable from "@/components/admin/LeadsTable";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Setup requests",
  description: "New onboarding leads and setup lifecycle.",
  robots: { index: false, follow: false },
};

function ageLabel(iso: string, nowMs: number): string {
  const ms = nowMs - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return "";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Attach display ages outside the render body (render purity). */
function withAges(requests: SetupRequestWithBusiness[]) {
  const nowMs = Date.now();
  return requests.map((request) => ({
    businessId: request.business_id,
    businessName: request.business_name,
    businessSlug: request.business_slug,
    bookingMode: request.booking_mode,
    businessType: request.business_type,
    preference: request.preference,
    contactPhone: request.contact_phone,
    status: request.status,
    age: ageLabel(request.created_at, nowMs),
    isActive: request.business_is_active,
  }));
}

/**
 * Platform-admin lead list: every onboarding setup request in one place
 * so no lead disappears. Deliberately not a CRM — status moves + contact
 * + business links only.
 */
export default async function LeadsPage() {
  await requirePlatformAdmin();
  const requests = await listSetupRequests(getSupabase());
  const leads = withAges(requests);

  return (
    <div className="min-h-screen bg-paper">
      <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:py-10">
        <p className="text-sm text-ink-soft">
          <a href="/admin/operations" className="font-medium hover:text-ink">
            ‹ Operations
          </a>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          New setup requests
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Every business that started onboarding, with its setup choice and
          lifecycle status. Only platform admins see this page.
        </p>
        <div className="mt-6">
          <LeadsTable leads={leads} />
        </div>
      </main>
    </div>
  );
}
