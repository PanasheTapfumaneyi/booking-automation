import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ManageBooking from "@/components/ManageBooking";
import { getSupabase } from "@/lib/supabase/server";

interface ManagePageProps {
  params: Promise<{ token: string }>;
}

export const metadata: Metadata = {
  title: "Manage your booking",
  description: "View, reschedule or cancel your booking.", // neutral: valid and invalid tokens share this
  robots: { index: false, follow: false },
};

export default async function ManagePage({ params }: ManagePageProps) {
  const { token } = await params;

  // Missing bookings get a real 404 status (not a 200 with "not found"
  // text): unknown tokens never resolve to another booking. Only a
  // confirmed-absent token 404s — a database error still renders the
  // client's retryable error state instead of a misleading 404.
  const decoded = decodeURIComponent(token);
  const { data, error } = await getSupabase()
    .from("bookings")
    .select("id")
    .eq("manage_token", decoded)
    .maybeSingle();
  if (!error && !data) notFound();

  return (
    <>
      <Navbar />
      <main className="flex-1">
        {/*
          Keyed by token so a new manage link always mounts a fresh view:
          no previous booking, mode, or not-found state can leak across
          tokens, including on client-side navigation between manage URLs.
        */}
        <ManageBooking key={token} token={token} />
      </main>
      <Footer />
    </>
  );
}