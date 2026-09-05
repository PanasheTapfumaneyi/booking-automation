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
        <ManageBooking token={token} />
      </main>
      <Footer />
    </>
  );
}