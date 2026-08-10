import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import BlogPage from '@/app/blog/page';
import { getPosts } from '@/lib/sanity/queries';
import type { PostSummary } from '@/lib/sanity/queries';

vi.mock('@/lib/sanity/queries', () => ({
  getPosts: vi.fn(),
}));

const mockedGetPosts = vi.mocked(getPosts);

describe('/blog', () => {
  beforeEach(() => {
    mockedGetPosts.mockReset();
  });

  test('renders a card per post, newest first as Sanity returns them', async () => {
    const posts: PostSummary[] = [
      { _id: '1', title: 'First Post', slug: 'first-post', publishedAt: '2026-08-05T00:00:00.000Z' },
      { _id: '2', title: 'Second Post', slug: 'second-post', publishedAt: '2026-08-01T00:00:00.000Z' },
    ];
    mockedGetPosts.mockResolvedValue(posts);

    render(await BlogPage());

    expect(screen.getByRole('link', { name: /first post/i })).toHaveAttribute('href', '/blog/first-post');
    expect(screen.getByRole('link', { name: /second post/i })).toHaveAttribute('href', '/blog/second-post');
  });

  test('shows the "stories are on their way" empty state when there are no posts', async () => {
    mockedGetPosts.mockResolvedValue([]);

    render(await BlogPage());

    expect(screen.getByText(/stories are on their way\. Check back soon\./i)).toBeInTheDocument();
  });

  test('degrades to the empty state instead of crashing when Sanity throws', async () => {
    mockedGetPosts.mockRejectedValue(new Error('network down'));

    render(await BlogPage());

    expect(screen.getByText(/stories are on their way\. Check back soon\./i)).toBeInTheDocument();
  });
});
