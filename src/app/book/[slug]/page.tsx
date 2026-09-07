import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BookingFlow from "@/components/BookingFlow";
import { getSupabase } from "@/lib/supabase/server";
import { fetchBusinessBySlug } from "@/lib/server/database";

interface BookSlugPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BookSlugPageProps): Promise<Metadata> {
  const { slug } = await params;
  const business = await fetchBusinessBySlug(slug, getSupabase()).catch(() => null);
  if (!business) return { title: "Business not found — Kivo" };
  return {
    title: `Book an appointment — ${business.name}`,
    description: `Pick a service, choose a time and book at ${business.name} in under a minute.`,
  };
}

export default async function BookSlugPage({ params }: BookSlugPageProps) {
  const { slug } = await params;
  const business = await fetchBusinessBySlug(slug, getSupabase()).catch(() => null);
  if (!business) notFound();

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <BookingFlow businessSlug={business.slug ?? slug} />
      </main>
      <Footer />
    </>
  );
}
