import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import PlaceholderImage from '@/components/placeholder-image';
import RichText from '@/components/portable-text';
import { formatPostDate } from '@/lib/format-date';
import { urlFor } from '@/lib/sanity/image';
import { getPost, getPosts } from '@/lib/sanity/queries';

export const revalidate = 60;

interface PostPageParams {
  slug: string;
}

export async function generateStaticParams(): Promise<PostPageParams[]> {
  try {
    const posts = await getPosts();
    return posts.map((post) => ({ slug: post.slug }));
  } catch (error) {
    // Sanity unreachable at build time: fall back to on-demand rendering for
    // every post page instead of failing the whole build (same posture as
    // the shop's [slug] route from Task 6).
    console.error('[blog] failed to list posts for generateStaticParams', error);
    return [];
  }
}

async function fetchPost(slug: string) {
  try {
    return await getPost(slug);
  } catch (error) {
    console.error('[blog] failed to fetch post from Sanity', error);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PostPageParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchPost(slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.excerpt,
  };
}

export default async function BlogPostPage({ params }: { params: Promise<PostPageParams> }) {
  const { slug } = await params;

  const post = await fetchPost(slug);
  if (!post) notFound();

  const coverUrl = post.coverImage?.asset
    ? urlFor(post.coverImage).width(1200).height(675).fit('crop').auto('format').url()
    : undefined;

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-6 aspect-[16/9] w-full overflow-hidden rounded-2xl bg-linen">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- see components/product-card.tsx
          <img src={coverUrl} alt={post.title} className="h-full w-full object-cover" />
        ) : (
          <PlaceholderImage title={post.title} />
        )}
      </div>

      <h1 className="font-heading text-3xl text-charcoal sm:text-4xl">{post.title}</h1>
      {post.publishedAt ? (
        <p className="mt-2 font-body text-sm text-khaki">{formatPostDate(post.publishedAt)}</p>
      ) : null}

      <div className="mt-8">
        <RichText value={post.body} />
      </div>
    </article>
  );
}
