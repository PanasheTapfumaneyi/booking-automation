import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/server/auth";
import { getSupabase } from "@/lib/supabase/server";
import TransferOwnerButton from "@/components/admin/TransferOwnerButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Businesses — Kivo Admin",
  description: "All businesses on the Kivo platform.",
  robots: { index: false, follow: false },
};

interface BusinessRow {
  id: string;
  name: string;
  slug: string | null;
  booking_mode: string;
  category: string | null;
  is_demo: boolean;
  is_active: boolean;
  created_at: string;
}

interface MemberRow {
  business_id: string;
  user_id: string;
  role: string;
}

function StatusBadge({ active, demo }: { active: boolean; demo: boolean }) {
  if (demo) {
    return (
      <span className="inline-flex items-center rounded-full border border-line bg-ink/5 px-2 py-0.5 text-xs text-ink-soft">
        Demo
      </span>
    );
  }
  return active ? (
    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
      Live
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-line bg-ink/5 px-2 py-0.5 text-xs text-ink-soft">
      Inactive
    </span>
  );
}

export default async function AdminBusinessesPage() {
  await requirePlatformAdmin();
  const db = getSupabase();

  const [businessesRes, membersRes] = await Promise.all([
    db
      .from("businesses")
      .select(
        "id, name, slug, booking_mode, category, is_demo, is_active, created_at",
      )
      .order("created_at", { ascending: false }),
    db
      .from("business_members")
      .select("business_id, user_id, role")
      .eq("role", "owner"),
  ]);

  const businesses = ((businessesRes.data ?? []) as unknown[]) as BusinessRow[];
  const owners = ((membersRes.data ?? []) as unknown[]) as MemberRow[];
  const ownerMap = new Map(owners.map((m) => [m.business_id, m.user_id]));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Businesses</h1>
          <p className="mt-1 text-sm text-ink-soft">
            All businesses on the platform · {businesses.length} total
          </p>
        </div>
        <Link
          href="/admin/create-business"
          className="shrink-0 rounded-full bg-blue px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-strong"
        >
          Create Business
        </Link>
      </div>

      {businesses.length === 0 ? (
        <p className="text-sm text-ink-soft">No businesses yet.</p>
      ) : (
        <ul className="space-y-2">
          {businesses.map((biz) => (
            <li
              key={biz.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{biz.name}</span>
                  <StatusBadge active={biz.is_active} demo={biz.is_demo} />
                  {biz.category && (
                    <span className="text-xs text-ink-soft">{biz.category}</span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-soft">
                  {biz.slug && <span>/{biz.slug}</span>}
                  <span className="capitalize">{biz.booking_mode}</span>
                  {ownerMap.has(biz.id) && (
                    <span className="font-mono">owner: {ownerMap.get(biz.id)!.slice(0, 8)}…</span>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {biz.slug && !biz.is_demo && (
                  <Link
                    href={`/business/${biz.slug}`}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft hover:text-ink"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Storefront ↗
                  </Link>
                )}
                {biz.slug && (
                  <Link
                    href={`/book/${biz.slug}`}
                    className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft hover:text-ink"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Book ↗
                  </Link>
                )}
                <Link
                  href={`/admin/integrations?business=${biz.id}`}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft hover:text-ink"
                >
                  Diagnostics
                </Link>
                <TransferOwnerButton
                  businessId={biz.id}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
