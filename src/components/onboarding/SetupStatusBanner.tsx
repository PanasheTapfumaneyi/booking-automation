import Link from "next/link";
import { getSupabase } from "@/lib/supabase/server";
import { getSetupRequest } from "@/lib/server/onboarding";

/**
 * Calm setup-status banner for the business dashboard. Renders only while
 * the business has a non-live setup request; existing businesses (no row)
 * and live businesses see nothing. Never a giant warning.
 */
export default async function SetupStatusBanner({
  businessId,
}: {
  businessId: string;
}) {
  const setup = await getSetupRequest(businessId, getSupabase()).catch(() => null);
  if (!setup || setup.status === "live") return null;

  let title: string;
  let body: string;
  let action: { href: string; label: string } | null = null;

  switch (setup.status) {
    case "new":
      title = "Finish setting up Kivo";
      body = "Choose whether Kivo handles your setup or you configure it yourself.";
      action = { href: "/onboarding", label: "Choose setup path" };
      break;
    case "self_configuring":
      title = "You're currently setting up Kivo";
      body = "Your page is available for testing. We'll contact you before finalizing your setup.";
      action = { href: "/onboarding", label: "Continue setup" };
      break;
    case "ready_for_review":
      title = "Your setup is under review";
      body = "Thanks for configuring your page. We'll contact you shortly to finalize everything before you go live.";
      break;
    default:
      title = "Setup in progress";
      body = "Kivo is helping finish your booking setup. We'll contact you shortly.";
      action = { href: "/onboarding/success", label: "View setup status" };
      break;
  }

  return (
    <div
      role="status"
      className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-blue/30 bg-blue-mist px-5 py-4"
    >
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-semibold text-blue-ink">{title}</span>{" "}
        <span className="text-ink-soft">{body}</span>
      </p>
      {action && (
        <Link
          href={action.href}
          className="shrink-0 text-sm font-semibold text-blue-strong hover:text-blue-ink hover:underline"
        >
          {action.label} →
        </Link>
      )}
    </div>
  );
}
