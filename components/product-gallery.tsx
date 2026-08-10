'use client';

import { useState } from 'react';

import { urlFor } from '@/lib/sanity/image';
import type { SanityImage } from '@/lib/sanity/queries';

import PlaceholderImage from './placeholder-image';

export interface ProductGalleryProps {
  title: string;
  photos?: SanityImage[];
}

/** Product-detail hero image with a thumbnail strip. Falls back to the
 * on-brand placeholder when the product has no photos yet. */
export default function ProductGallery({ title, photos }: ProductGalleryProps) {
  const usable = (photos ?? []).filter((photo) => photo.asset);
  const [selected, setSelected] = useState(0);

  if (usable.length === 0) {
    return (
      <div className="aspect-square w-full max-w-full overflow-hidden rounded-2xl bg-linen">
        <PlaceholderImage title={title} />
      </div>
    );
  }

  const activeIndex = Math.min(selected, usable.length - 1);
  const mainUrl = urlFor(usable[activeIndex]).width(1200).height(1200).fit('crop').auto('format').url();

  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-square w-full max-w-full overflow-hidden rounded-2xl bg-linen">
        {/* eslint-disable-next-line @next/next/no-img-element -- see product-card.tsx */}
        <img src={mainUrl} alt={title} className="h-full w-full max-w-full object-cover" />
      </div>
      {usable.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {usable.map((photo, index) => {
            const thumbUrl = urlFor(photo).width(160).height(160).fit('crop').auto('format').url();
            return (
              <button
                key={index}
                type="button"
                aria-label={`Photo ${index + 1}`}
                aria-pressed={index === activeIndex}
                onClick={() => setSelected(index)}
                className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                  index === activeIndex ? 'border-rust' : 'border-transparent hover:border-khaki'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- see product-card.tsx */}
                <img src={thumbUrl} alt="" className="h-full w-full max-w-full object-cover" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
