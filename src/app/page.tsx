import Link from "next/link";
import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { DEMO_BUSINESS, DEMO_SERVICES, formatPrice } from "@/lib/demo";
import { minutesToLabel } from "@/lib/availability";

export const metadata: Metadata = {
  title: "Fade District — Book your appointment",
  description:
    "Professional cuts & grooming in a relaxed environment. Book online in under a minute.",
};

export default function HomePage() {
  return (
    <>
      <Navbar />

      {/* Hero */}
      <section className="bg-ink text-paper">
        <div className="mx-auto grid max-w-5xl gap-10 px-5 py-20 sm:py-28 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold">
              {DEMO_BUSINESS.name} · {DEMO_BUSINESS.address}
            </p>
            <h1 className="mt-5 max-w-xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Your next cut,
              <br />
              without the wait.
            </h1>
            <p className="mt-5 max-w-md text-lg text-paper/70">
              Professional cuts & grooming in a relaxed environment. Pick a
              time, book in under a minute — no phone calls needed.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link
                href="/book"
                className="rounded-full bg-gold px-8 py-4 text-center text-base font-semibold text-white transition-colors hover:bg-gold-strong"
              >
                Book appointment
              </Link>
              <Link
                href="/manage/demo"
                className="text-center text-sm font-medium text-paper/70 hover:text-paper"
              >
                Manage an existing appointment →
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-paper/60">
              <li>No account needed</li>
              <li>Instant confirmation</li>
              <li>Free rescheduling</li>
            </ul>
          </div>

          {/* Hero card preview */}
          <div className="rounded-2xl border border-paper/10 bg-paper/5 p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-paper/50">
              Next available
            </p>
            <div className="mt-5 space-y-3">
              {DEMO_SERVICES.slice(0, 2).map((service, index) => {
                const start = new Date();
                start.setHours(9 + index, 0, 0, 0);
                return (
                  <div
                    key={service.id}
                    className="flex items-center justify-between rounded-xl border border-paper/10 bg-paper/5 px-4 py-3.5"
                  >
                    <div>
                      <p className="font-medium">{service.name}</p>
                      <p className="text-sm text-paper/60">
                        {minutesToLabel(service.durationMinutes)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm tabular-nums">
                        {start.toLocaleTimeString("en-MU", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })}
                      </p>
                      <p className="text-sm text-gold">
                        {formatPrice(service.price)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <Link
              href="/book"
              className="mt-5 flex items-center justify-center rounded-full border border-paper/20 px-6 py-3 text-sm font-medium text-paper hover:border-gold hover:text-gold"
            >
              See all times
            </Link>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="mx-auto max-w-5xl px-5 py-16 sm:py-24">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold-strong">
          Services
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Cut, styled, done.
        </h2>
        <div className="mt-9 grid gap-4 sm:grid-cols-3">
          {DEMO_SERVICES.map((service) => (
            <div
              key={service.id}
              className="flex flex-col rounded-2xl border border-line bg-card p-6"
            >
              <h3 className="text-lg font-semibold">{service.name}</h3>
              <p className="mt-1.5 flex-1 text-sm text-ink-soft">
                {service.description}
              </p>
              <div className="mt-5 flex items-baseline justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
                  {minutesToLabel(service.durationMinutes)}
                </p>
                <p className="text-xl font-semibold tabular-nums">
                  {formatPrice(service.price)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Hours + Location */}
      <section className="border-y border-line bg-card">
        <div className="mx-auto grid max-w-5xl gap-10 px-5 py-14 sm:py-20 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Hours</h2>
            <dl className="mt-6 space-y-3">
              <div className="flex items-center justify-between gap-4 border-b border-line pb-3">
                <dt className="text-ink-soft">Monday – Friday</dt>
                <dd className="font-medium tabular-nums">
                  {DEMO_BUSINESS.hours.mondayFriday}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-line pb-3">
                <dt className="text-ink-soft">Saturday</dt>
                <dd className="font-medium tabular-nums">
                  {DEMO_BUSINESS.hours.saturday}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-ink-soft">Sunday</dt>
                <dd className="font-medium">{DEMO_BUSINESS.hours.sunday}</dd>
              </div>
            </dl>
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Location</h2>
            <p className="mt-6 font-medium">{DEMO_BUSINESS.address}</p>
            <p className="mt-1 text-ink-soft">{DEMO_BUSINESS.addressNote}</p>
            <p className="mt-4 text-ink-soft">
              Book online or call {DEMO_BUSINESS.phone}.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-5 py-16 text-center sm:py-20">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Ready for your next cut?
        </h2>
        <p className="mx-auto mt-3 max-w-md text-ink-soft">
          Your slot is waiting. Choose a service and pick a time that suits you.
        </p>
        <Link
          href="/book"
          className="mt-7 inline-block rounded-full bg-ink px-8 py-4 text-base font-semibold text-paper transition-colors hover:bg-black"
        >
          Book appointment
        </Link>
      </section>

      <Footer />
    </>
  );
}