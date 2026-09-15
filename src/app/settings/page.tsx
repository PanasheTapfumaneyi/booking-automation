import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SettingsForm, { type SettingsBundle } from "@/components/SettingsForm";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { getRequestUser, getMyMemberships } from "@/lib/server/auth";
import { getSupabase } from "@/lib/supabase/server";
import {
  getBusinessSettings,
  listServices,
  listResources,
  listSessions,
} from "@/lib/server/businesses";
import { fetchBusinessNotificationSettings } from "@/lib/server/notifications/records";
import { getConnectionStatus } from "@/lib/server/google-calendar/connections";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Business settings",
  description: "Edit your business profile, offering, hours and notifications.",
};

interface SettingsPageProps {
  searchParams: Promise<{ business?: string }>;
}

/** Owner settings for one business (defaults to the first membership). */
export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const user = await getRequestUser().catch(() => null);
  if (!user) redirect("/login?next=/settings");
  const memberships = await getMyMemberships(user.id).catch(() => []);
  if (memberships.length === 0) redirect("/onboarding");

  const params = await searchParams;
  // A supplied business id must be owned: malformed, nonexistent or
  // unowned ids are a 404, never a silent fallback to the first owned
  // business (KIVO-027: no cross-tenant leakage through the URL). Only an
  // absent parameter defaults to the first membership.
  const requestedBusiness =
    params.business && params.business.trim().length > 0 ? params.business : null;
  if (requestedBusiness && !memberships.some((m) => m.business_id === requestedBusiness)) {
    notFound();
  }
  const selectedId = (requestedBusiness ? requestedBusiness : memberships[0].business_id) as string;

  const db = getSupabase();
  const [settings, services, resources, sessions, notifications, calendar] =
    await Promise.all([
      getBusinessSettings(selectedId, db),
      listServices(selectedId, db),
      listResources(selectedId, db),
      listSessions(selectedId, db),
      fetchBusinessNotificationSettings(selectedId, db),
      getConnectionStatus(selectedId).catch(() => ({
        connected: false,
        calendarId: null,
        accountEmail: null,
        requiresReconnect: false,
        checked: false,
      })),
    ]);

  const bundle: SettingsBundle = {
    business: settings.business,
    services,
    resources,
    sessions,
    notifications: {
      business_notification_phone: notifications.business_notification_phone,
      customer_notifications_enabled: notifications.customer_notifications_enabled,
      business_notifications_enabled: notifications.business_notifications_enabled,
      whatsapp_enabled: notifications.whatsapp_enabled,
    },
    calendar,
    businesses: memberships.map((m) => m.business_id),
  };

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <DashboardShell
          businessId={settings.business.id}
          businessName={settings.business.name}
          businessSlug={settings.business.slug ?? null}
        >
          <SettingsForm bundle={bundle} />
        </DashboardShell>
      </main>
      <Footer />
    </>
  );
}
