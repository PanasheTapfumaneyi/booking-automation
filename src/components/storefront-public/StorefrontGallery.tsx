"use client";

import { useState } from "react";
import GalleryLightbox, { type LightboxImage } from "./GalleryLightbox";

/**
 * Editorial gallery grid: the first image takes a large span, the rest
 * fill uniformly. Renders nothing when empty (caller guarantees).
 */
export default function StorefrontGallery({
  businessName,
  images,
}: {
  businessName: string;
  images: LightboxImage[];
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="gallery" aria-labelledby="gallery-title" className="scroll-mt-20">
      <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:py-20">
        <h2
          id="gallery-title"
          className="text-[clamp(1.5rem,3vw,2rem)] font-bold tracking-tight text-ink"
        >
          Gallery
        </h2>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {images.map((image, index) => (
            <button
              key={`${image.src}-${index}`}
              type="button"
              onClick={() => setOpenIndex(index)}
              aria-label={`View photo ${index + 1} of ${images.length}`}
              className={[
                "group relative block w-full overflow-hidden rounded-xl bg-surface-muted transition-transform duration-200 hover:scale-[1.01] sm:rounded-2xl",
                index === 0
                  ? "aspect-[4/3] col-span-2 row-span-2 sm:aspect-auto sm:h-full sm:min-h-[320px]"
                  : "aspect-square",
              ].join(" ")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.src}
                alt={image.alt || `${businessName} photo ${index + 1}`}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      </div>
      {openIndex !== null && (
        <GalleryLightbox images={images} startIndex={openIndex} onClose={() => setOpenIndex(null)} />
      )}
    </section>
  );
}
