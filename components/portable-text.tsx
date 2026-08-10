import { PortableText, type PortableTextComponents } from '@portabletext/react';

import { urlFor } from '@/lib/sanity/image';
import type { PortableTextBlock } from '@/lib/sanity/queries';

/** True for absolute http(s) URLs — the only hrefs that should open in a new
 * tab with `rel="noopener noreferrer"`. Relative site links (`/about`,
 * `/shop/hats`, `#section`, etc.) stay in-tab with no extra attributes. */
function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

const components: PortableTextComponents = {
  block: {
    h1: ({ children }) => <h1 className="font-heading text-3xl text-charcoal">{children}</h1>,
    h2: ({ children }) => <h2 className="font-heading text-2xl text-charcoal">{children}</h2>,
    h3: ({ children }) => <h3 className="font-heading text-xl text-charcoal">{children}</h3>,
    h4: ({ children }) => <h4 className="font-heading text-lg text-charcoal">{children}</h4>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-khaki pl-4 font-body italic leading-relaxed text-charcoal">
        {children}
      </blockquote>
    ),
    normal: ({ children }) => <p className="font-body leading-relaxed text-charcoal">{children}</p>,
  },
  marks: {
    link: ({ value, children }) => {
      const href = typeof value?.href === 'string' ? value.href : '';
      const external = isExternalHref(href);
      return (
        <a
          href={href}
          className="text-rust underline underline-offset-2 hover:text-rust-soft"
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {children}
        </a>
      );
    },
  },
  types: {
    image: ({ value }) => {
      if (!value?.asset) return null;
      const imageUrl = urlFor(value).width(1200).auto('format').url();
      const alt = typeof value.alt === 'string' ? value.alt : '';
      return (
        // Sanity's CDN already serves responsive, optimized images; no
        // next/image remotePatterns config exists yet for cdn.sanity.io (see
        // components/product-card.tsx for the same tradeoff).
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={alt} className="w-full rounded-2xl" />
      );
    },
  },
};

export interface RichTextProps {
  value?: PortableTextBlock[] | null;
}

/** Renders a Sanity Portable Text body: headings in the brand heading font,
 * rust-colored links (external ones opening safely in a new tab), and
 * inline images sourced through the Sanity CDN with real alt text. Renders
 * nothing for an empty/missing body — callers own their own empty state. */
export default function RichText({ value }: RichTextProps) {
  if (!value || value.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <PortableText value={value} components={components} />
    </div>
  );
}
