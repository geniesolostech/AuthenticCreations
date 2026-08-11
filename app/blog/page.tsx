import GrannyCornerMotif from '@/components/granny-corner-motif';
import PostCard from '@/components/post-card';
import RevealGrid from '@/components/reveal-grid';
import YarnUnderline from '@/components/yarn-underline';
import { getPosts, type PostSummary } from '@/lib/sanity/queries';

export const revalidate = 60;

export default async function BlogPage() {
  // Guarded the same way as the shop grid (Task 6): a Sanity hiccup degrades
  // to the empty-shelf message rather than a crashed page.
  let posts: PostSummary[] = [];
  try {
    posts = await getPosts();
  } catch (error) {
    console.error('[blog] failed to fetch posts from Sanity', error);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* Woven spec §3/§4: page-title motif + sage underline. */}
      <div className="inline-flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-3xl text-charcoal sm:text-4xl">From the Blog</h1>
          <GrannyCornerMotif size="sm" />
        </div>
        <YarnUnderline color="sage" />
      </div>

      {posts.length === 0 ? (
        <p className="mt-8 font-body text-charcoal">stories are on their way. Check back soon.</p>
      ) : (
        <RevealGrid className="mt-8 grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, index) => (
            <PostCard key={post._id} post={post} quiltIndex={index} />
          ))}
        </RevealGrid>
      )}
    </div>
  );
}
