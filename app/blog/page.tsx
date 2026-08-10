import PostCard from '@/components/post-card';
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
      <h1 className="font-heading text-3xl text-charcoal sm:text-4xl">From the Blog</h1>

      {posts.length === 0 ? (
        <p className="mt-8 font-body text-charcoal">stories are on their way, check back soon</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <PostCard key={post._id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
