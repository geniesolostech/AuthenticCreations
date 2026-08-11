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

  test('h1 pairs a motif with a sage underline (Woven spec §3/§4)', async () => {
    mockedGetPosts.mockResolvedValue([]);

    render(await BlogPage());

    const heading = screen.getByRole('heading', { level: 1 });
    const motif = screen.getByTestId('granny-motif');
    expect(heading.parentElement).toContainElement(motif);
    expect(screen.getByTestId('yarn-underline').querySelector('path')).toHaveClass('stroke-sage');
  });

  test('the grid rotates quilt frames by position and is wrapped for the entrance stagger', async () => {
    const posts: PostSummary[] = [
      { _id: '1', title: 'First Post', slug: 'first-post' },
      { _id: '2', title: 'Second Post', slug: 'second-post' },
      { _id: '3', title: 'Third Post', slug: 'third-post' },
    ];
    mockedGetPosts.mockResolvedValue(posts);

    render(await BlogPage());

    const cards = screen.getAllByRole('link', { name: /(first|second|third) post/i });
    expect(cards[0]).toHaveClass('border-mustard');
    expect(cards[1]).toHaveClass('border-rose');
    expect(cards[2]).toHaveClass('border-sage');
    expect(document.querySelector('.reveal-grid')).not.toBeNull();
  });
});
