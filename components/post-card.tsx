import Link from 'next/link';

import { formatPostDate } from '@/lib/format-date';
import { urlFor } from '@/lib/sanity/image';
import type { PostSummary } from '@/lib/sanity/queries';

import PlaceholderImage from './placeholder-image';

export interface PostCardProps {
  post: PostSummary;
}

/** Grid tile for `/blog`: cover photo (or on-brand placeholder), date,
 * title, and excerpt — links through to the post page. Mirrors
 * `ProductCard`'s shape. */
export default function PostCard({ post }: PostCardProps) {
  const imageUrl = post.coverImage?.asset
    ? urlFor(post.coverImage).width(600).height(400).fit('crop').auto('format').url()
    : undefined;

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-linen transition hover:shadow-md"
    >
      <div className="relative aspect-[3/2] w-full overflow-hidden">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- see product-card.tsx
          <img
            src={imageUrl}
            alt={post.title}
            className="h-full w-full max-w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <PlaceholderImage title={post.title} />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 px-4 py-4">
        {post.publishedAt ? (
          <p className="font-body text-xs text-khaki">{formatPostDate(post.publishedAt)}</p>
        ) : null}
        <h3 className="font-heading text-lg text-charcoal">{post.title}</h3>
        {post.excerpt ? <p className="font-body text-sm text-charcoal">{post.excerpt}</p> : null}
      </div>
    </Link>
  );
}
