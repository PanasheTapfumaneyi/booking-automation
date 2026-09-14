import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BookingFlow from "@/components/BookingFlow";

export const metadata: Metadata = {
  title: "Book",
  description:
    "Choose a business and book your appointment, rental or session online in under a minute.",
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