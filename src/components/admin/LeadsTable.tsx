"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SETUP_STATUSES, type SetupStatus } from "@/lib/setup-status";

export interface LeadRow {
  businessId: string;
  businessName: string;
  businessSlug: string | null;
  bookingMode: string;
  businessType: string | null;
  preference: "managed" | "self" | null;
  contactPhone: string | null;
  status: SetupStatus;
  age: string;
  isActive: boolean;
}

const STATUS_LABELS: Record<SetupStatus, string> = {
  new: "New",
  pending_setup: "Pending setup",
  contacted: "Contacted",
  setting_up: "Setting up",
  self_configuring: "Self configuring",
  ready_for_review: "Ready for review",
  live: "Live",
};

function preferenceLabel(preference: LeadRow["preference"]): string {
  if (preference === "managed") return "Set it up for me";
  if (preference === "self") return "Configuring themselves";
  return "No choice yet";
}

/**
 * Admin lead table: contact links, business links, and a minimal status
 * control per row. Moving to `live` activates the public page; any other
 * status deactivates it (server-enforced, businesses without a setup row
 * are never touched).
 */
export default function LeadsTable({ leads }: { leads: LeadRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function changeStatus(businessId: string, status: SetupStatus) {
    if (busyId) return;
    setBusyId(businessId);
    setError(null);
    try {
      const response = await fetch("/api/admin/setup-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, status }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: { userMessage?: string };
      } | null;
      if (!response.ok) {
        throw new Error(data?.error?.userMessage ?? "Couldn't update the status. Please try again.");
      }
      router.refresh();
    } catch (updateError: unknown) {
      setError(updateError instanceof Error ? updateError.message : "Couldn't update the status.");
    } finally {
      setBusyId(null);
    }
  }

  if (leads.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-card p-8 text-center">
        <p className="font-medium">No setup requests yet</p>
        <p className="mt-1 text-sm text-ink-soft">
          New signups choosing a setup path appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}
      <ul className="flex flex-col gap-3">
        {leads.map((lead) => {
          const digits = (lead.contactPhone ?? "").replace(/\D/g, "");
          return (
            <li
              key={lead.businessId}
              className="rounded-2xl border border-line bg-card p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {lead.businessName}
                    {!lead.isActive && (
                      <span className="ml-2 rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-soft">
                        Not public
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    {[lead.businessType, preferenceLabel(lead.preference), lead.age]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {digits.length >= 7 && (
                      <a
                        href={`https://wa.me/${digits}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-blue-strong hover:underline"
                      >
                        WhatsApp {lead.contactPhone}
                      </a>
                    )}
                    {lead.businessSlug && (
                      <a
                        href={`/business/${lead.businessSlug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-ink-soft hover:text-ink"
                      >
                        View business →
                      </a>
                    )}
                  </div>
                </div>
                <label className="flex shrink-0 flex-col gap-1 text-xs font-medium text-ink-soft">
                  Status
                  <select
                    value={lead.status}
                    disabled={busyId !== null}
                    onChange={(e) => changeStatus(lead.businessId, e.target.value as SetupStatus)}
                    aria-label={`Setup status for ${lead.businessName}`}
                    className="min-h-[44px] rounded-xl border border-line bg-paper px-3 py-2 text-sm font-medium text-ink outline-none focus:border-blue disabled:opacity-40"
                  >
                    {SETUP_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
