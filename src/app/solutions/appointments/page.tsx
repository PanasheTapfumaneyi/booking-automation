import type { Metadata } from "next";
import Link from "next/link";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { SITE_URL, OG_IMAGE } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Appointment Booking System Mauritius — Kivo",
  description:
    "Let customers book appointments online. Kivo handles scheduling, WhatsApp confirmations and Google Calendar sync for clinics, salons, consultants and service businesses in Mauritius.",
  alternates: { canonical: `${SITE_URL}/solutions/appointments` },
  openGraph: {
    title: "Appointment Booking System Mauritius — Kivo",
    description:
      "Let customers book appointments online. Kivo handles scheduling, WhatsApp confirmations and Google Calendar sync for service businesses in Mauritius.",
    url: `${SITE_URL}/solutions/appointments`,
    images: [{ url: OG_IMAGE }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Appointment Booking System Mauritius — Kivo",
    description:
      "Let customers book appointments online. Kivo handles scheduling, WhatsApp confirmations and Google Calendar sync for service businesses in Mauritius.",
    images: [OG_IMAGE],
  },
};

const PROBLEMS = [
  "Missed calls and voicemails from customers trying to book",
  "Double-booked time slots from manual scheduling",
  "No-shows because customers forget their appointments",
  "Hours spent on the phone confirming and reconfirming bookings",
];

const SOLUTIONS = [
  {
    title: "Your booking page",
    text: "Customers see your services, available times and prices — then book in under a minute. No phone call needed.",
  },
  {
    title: "Automatic confirmations",
    text: "Every booking triggers a WhatsApp confirmation for the customer and a notification for you. No manual follow-up.",
  },
  {
    title: "Calendar sync",
    text: "Bookings automatically appear on your Google Calendar. Your real availability is always up to date.",
  },
  {
    title: "Reduced no-shows",
    text: "WhatsApp reminders go out before each appointment. Customers remember their bookings.",
  },
];

const FAQS = [
  {
    q: "What types of appointment businesses use Kivo?",
    a: "Clinics, salons, barbershops, consultants, therapists, tutors, photographers and any business where customers book a specific time slot.",
  },
  {
    q: "Can customers reschedule or cancel?",
    a: "Yes. Customers can reschedule or cancel through the link in their WhatsApp confirmation, subject to your cancellation policy.",
  },
  {
    q: "Do I need technical knowledge to set up?",
    a: "No. Kivo handles the entire setup. You tell us your services and availability, and we build your booking page.",
  },
];

export default function AppointmentsPage() {
  return (
    <>
      <MarketingHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-[800px] px-6 py-20 sm:py-28">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">
            Appointments
          </p>
          <h1 className="mt-4 text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.05] tracking-tight text-ink">
            Online appointment booking for your business
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            Kivo gives appointment-based businesses in Mauritius a professional
            booking system. Customers pick a service, choose a time and book
            instantly — no phone calls, no back-and-forth.
          </p>

          <div className="mt-12">
            <h2 className="text-2xl font-bold tracking-tight text-ink">
              The problem with manual scheduling
            </h2>
            <ul className="mt-4 space-y-3">
              {PROBLEMS.map((p) => (
                <li key={p} className="flex items-start gap-3 text-ink-soft">
                  <span className="mt-1 text-red-500">✕</span>
                  {p}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-12">
            <h2 className="text-2xl font-bold tracking-tight text-ink">
              How Kivo solves it
            </h2>
            <div className="mt-6 space-y-6">
              {SOLUTIONS.map((s) => (
                <div key={s.title}>
                  <h3 className="font-semibold text-ink">{s.title}</h3>
                  <p className="mt-1 text-ink-soft">{s.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12">
            <h2 className="text-2xl font-bold tracking-tight text-ink">
              Your customer journey
            </h2>
            <ol className="mt-4 space-y-4 text-ink-soft">
              <li className="flex gap-3">
                <span className="font-bold text-brand">1.</span>
                Customer finds your booking page via Google, WhatsApp or your
                website.
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-brand">2.</span>
                They browse your services and pick a time that works.
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-brand">3.</span>
                They enter their details and confirm. Done in under a minute.
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-brand">4.</span>
                Both of you get a WhatsApp confirmation. The booking appears on
                your Google Calendar.
              </li>
            </ol>
          </div>

          <div className="mt-12">
            <h2 className="text-2xl font-bold tracking-tight text-ink">FAQs</h2>
            <div className="mt-6 space-y-6">
              {FAQS.map((f) => (
                <div key={f.q}>
                  <h3 className="font-semibold text-ink">{f.q}</h3>
                  <p className="mt-1 text-ink-soft">{f.a}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-7 py-3.5 text-base font-semibold text-white transition-all duration-150 hover:bg-brand-hover"
            >
              Start your free month
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-line px-7 py-3.5 text-base font-medium text-ink-soft transition-all duration-150 hover:border-line-strong hover:text-ink"
            >
              View pricing
            </Link>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
