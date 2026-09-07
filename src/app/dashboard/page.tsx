import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getRequestUser, getMyMemberships } from "@/lib/server/auth";
import { fetchBusiness } from "@/lib/server/database";
import { getSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard — Kivo",
  description: "Your businesses on Kivo.",
};

/**
 * Minimal business home (NOT the operational dashboard — Phase 6B).
 * Lists the owner's businesses with links to their booking page and settings.
 */
export default async function DashboardPage() {
  const user = await getRequestUser().catch(() => null);
  if (!user) redirect("/login?next=/dashboard");
  const memberships = await getMyMemberships(user.id).catch(() => []);
  if (memberships.length === 0) redirect("/onboarding");

  const db = getSupabase();
  const businesses = [];
  for (const membership of memberships) {
    const business = await fetchBusiness(membership.business_id, db).catch(() => null);
    if (business) businesses.push(business);
  }

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-xl px-5 py-10">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">Your businesses</h1>
            <Link href="/logout" className="text-sm font-medium text-ink-soft hover:text-ink">
              Log out
            </Link>
          </div>
          <div className="mt-6 flex flex-col gap-4">
            {businesses.map((business) => (
              <section
                key={business.id}
                className="rounded-2xl border border-line bg-card p-6"
              >
                <h2 className="text-lg font-semibold">{business.name}</h2>
                <p className="mt-1 text-sm text-ink-soft">
                  {business.booking_mode === "appointment" && "Appointments"}
                  {business.booking_mode === "resource" && "Rentals"}
                  {business.booking_mode === "capacity" && "Group sessions"}
                  {" · "}
                  {business.timezone}
                </p>
                <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
                  {business.slug && (
                    <Link
                      href={`/book/${business.slug}`}
                      className="rounded-full bg-ink px-5 py-2.5 text-center text-sm font-semibold text-paper hover:bg-black"
                    >
                      View booking page
                    </Link>
                  )}
                  <Link
                    href={`/settings?business=${business.id}`}
                    className="rounded-full border border-line bg-paper px-5 py-2.5 text-center text-sm font-medium hover:text-ink"
                  >
                    Settings
                  </Link>
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
