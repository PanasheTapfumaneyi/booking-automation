import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BookingFlow from "@/components/BookingFlow";
import { getSupabase } from "@/lib/supabase/server";
import { fetchBusinessBySlug } from "@/lib/server/database";

interface BookSlugPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ vehicle?: string }>;
}

const MODE_META: Record<string, { verb: string; blurb: string }> = {
  appointment: { verb: "Book an appointment", blurb: "pick a service and choose a time" },
  capacity: { verb: "Book a session", blurb: "join a scheduled session" },
  resource: { verb: "Book a rental", blurb: "reserve an item for your dates" },
};

export async function generateMetadata({ params }: BookSlugPageProps): Promise<Metadata> {
  const { slug } = await params;
  const business = await fetchBusinessBySlug(slug, getSupabase()).catch(() => null);
  // 404 here (not just in the page): generateMetadata resolves before the
  // loading.tsx suspense shell flushes, so the 404 status is committed.
  if (!business || business.is_active === false) {
    notFound();
  }
  const meta = MODE_META[business.booking_mode] ?? MODE_META.appointment;
  return {
    title: `${meta.verb} — ${business.name}`,
    description: `${meta.verb.at(0)?.toUpperCase()}${meta.verb.slice(1)} at ${business.name} — ${meta.blurb} in under a minute.`,
  };
}

export default async function BookSlugPage({ params, searchParams }: BookSlugPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const business = await fetchBusinessBySlug(slug, getSupabase()).catch(() => null);
  if (!business || business.is_active === false) notFound();

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <BookingFlow
          businessSlug={business.slug ?? slug}
          initialVehicleId={query.vehicle || undefined}
        />
      </main>
      <Footer />
    </>
  );
}
