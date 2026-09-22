/**
 * About block: constrained reading width inside a bordered card.
 * Renders nothing without a description (caller guarantees).
 */
export default function StorefrontAbout({
  businessName,
  description,
}: {
  businessName: string;
  description: string;
}) {
  return (
    <section id="about" aria-labelledby="about-title" className="scroll-mt-20">
      <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:py-16">
        <div className="rounded-2xl border border-line bg-card p-6 shadow-sm sm:p-8">
          <h2
            id="about-title"
            className="text-2xl font-bold tracking-tight text-ink sm:text-[1.75rem]"
          >
            About {businessName}
          </h2>
          <p className="mt-4 max-w-3xl whitespace-pre-line text-[16px] leading-relaxed text-ink-soft">
            {description}
          </p>
        </div>
      </div>
    </section>
  );
}
