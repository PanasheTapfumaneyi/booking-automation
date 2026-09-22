/**
 * Pricing FAQ — server-compatible using native <details>/<summary>.
 * No client JS required for basic expand/collapse.
 */

const FAQ_ITEMS = [
  {
    q: "What happens after the free month?",
    a: "You choose a plan that fits your business. Base starts at Rs 900/month, Plus at Rs 1,400/month, and Premium at Rs 2,400/month. No payment is required during your first month.",
  },
  {
    q: "Can I change plans later?",
    a: "Contact us on WhatsApp and we'll adjust your plan. The timing will be confirmed with you — there is no automated billing system.",
  },
  {
    q: "What's included in the free month?",
    a: "All currently available features in your chosen plan. Full setup, support, and everything listed on this page. AI early-access features are coming soon and will be available to Premium subscribers as they roll out.",
  },
  {
    q: "Do I need technical knowledge?",
    a: "No. Kivo is a managed service. We handle setup, configuration, and ongoing maintenance. You just manage your bookings.",
  },
  {
    q: "What is Premium AI early access?",
    a: "Premium includes early access to upcoming AI features like an AI booking assistant, automated customer responses, and smarter business insights. These are currently in development and will roll out progressively to Premium subscribers.",
  },
  {
    q: "How does the SEO support work in Plus?",
    a: "Plus includes a search-optimised storefront, custom metadata, Google Business Profile setup, and ongoing improvements. We don't guarantee rankings — visibility depends on competition, reviews, and Google's systems.",
  },
  {
    q: "Is there a setup fee?",
    a: "No setup fee. No long-term contract. Your first month is free and includes full setup.",
  },
];

export default function PricingFAQ() {
  return (
    <section className="bg-paper">
      <div className="mx-auto max-w-[1200px] px-6 py-24 sm:py-32">
        <h2 className="text-[clamp(1.5rem,3vw,2.25rem)] font-bold leading-[1.1] tracking-tight text-ink">
          Frequently asked questions
        </h2>
        <div className="mt-10 max-w-2xl space-y-4">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-line bg-card px-6 py-4"
            >
              <summary className="flex cursor-pointer items-center justify-between text-base font-semibold text-ink marker:hidden">
                {item.q}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="shrink-0 text-ink-soft transition-transform duration-200 group-open:rotate-180"
                  aria-hidden="true"
                >
                  <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
