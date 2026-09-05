import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BookingFlow from "@/components/BookingFlow";

export const metadata: Metadata = {
  title: "Book an appointment — Fade District",
  description:
    "Pick a service, choose a time and book your appointment at Fade District in under a minute.",
};

export default function BookPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <BookingFlow />
      </main>
      <Footer />
    </>
  );
}