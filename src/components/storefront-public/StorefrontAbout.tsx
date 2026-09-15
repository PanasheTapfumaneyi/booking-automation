/**
 * Editorial about block: constrained reading width, never a full-width
 * wall of text. Renders nothing without a description (caller guarantees).
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
      <div className="mx-auto w-full max-w-4xl px-5 py-14 sm:py-20">
        <h2
          id="about-title"
          className="text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-ink"
        >
          About {businessName}
        </h2>
        <p className="mt-6 max-w-2xl whitespace-pre-line text-lg leading-relaxed text-ink-soft">
          {description}
        </p>
      </div>
    </section>
  );
}
