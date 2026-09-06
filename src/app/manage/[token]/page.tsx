import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ManageBooking from "@/components/ManageBooking";

interface ManagePageProps {
  params: Promise<{ token: string }>;
}

export const metadata: Metadata = {
  title: "Manage appointment — Fade District",
  description:
    "View, reschedule or cancel your appointment at Fade District.",
};

export default async function ManagePage({ params }: ManagePageProps) {
  const { token } = await params;

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