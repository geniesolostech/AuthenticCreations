import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import BlogPostPage, { generateMetadata } from '@/app/blog/[slug]/page';
import { getPost } from '@/lib/sanity/queries';
import type { Post } from '@/lib/sanity/queries';

vi.mock('@/lib/sanity/queries', () => ({
  getPost: vi.fn(),
  getPosts: vi.fn(),
}));

const mockedGetPost = vi.mocked(getPost);

const basePost: Post = {
  _id: 'p1',
  title: 'Notes from the Studio',
  slug: 'notes-from-the-studio',
  excerpt: 'A peek behind the yarn.',
  publishedAt: '2026-08-09T12:00:00.000Z',
  body: [
    {
      _type: 'block',
      _key: 'b1',
      style: 'normal',
      children: [{ _type: 'span', _key: 'b1s', text: 'Hello there.', marks: [] }],
    },
  ],
};

describe('/blog/[slug]', () => {
  beforeEach(() => {
    mockedGetPost.mockReset();
  });

  test('renders the title, human-friendly date, and body', async () => {
    mockedGetPost.mockResolvedValue(basePost);

    render(await BlogPostPage({ params: Promise.resolve({ slug: 'notes-from-the-studio' }) }));

    expect(screen.getByRole('heading', { level: 1, name: 'Notes from the Studio' })).toBeInTheDocument();
    expect(screen.getByText('August 9, 2026')).toBeInTheDocument();
    expect(screen.getByText('Hello there.')).toBeInTheDocument();
  });

  test('calls notFound() for an unknown slug', async () => {
    mockedGetPost.mockResolvedValue(null);

    await expect(
      BlogPostPage({ params: Promise.resolve({ slug: 'does-not-exist' }) }),
    ).rejects.toThrow();
  });

  test('calls notFound() instead of crashing when Sanity throws', async () => {
    mockedGetPost.mockRejectedValue(new Error('network down'));

    await expect(
      BlogPostPage({ params: Promise.resolve({ slug: 'notes-from-the-studio' }) }),
    ).rejects.toThrow();
  });

  test('generateMetadata builds title and description from the post', async () => {
    mockedGetPost.mockResolvedValue(basePost);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'notes-from-the-studio' }),
    });

    expect(metadata.title).toBe('Notes from the Studio');
    expect(metadata.description).toBe('A peek behind the yarn.');
  });

  test('generateMetadata is happy with an unknown slug (no crash)', async () => {
    mockedGetPost.mockResolvedValue(null);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: 'does-not-exist' }),
    });

    expect(metadata).toBeTruthy();
  });
});
