import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import PostCard from '@/components/post-card';
import type { PostSummary } from '@/lib/sanity/queries';

const basePost: PostSummary = {
  _id: 'post1',
  title: 'A Weekend with the Fiber Guild',
  slug: 'fiber-guild-weekend',
  coverImage: { asset: { _ref: 'image-abc123def456-1200x800-jpg', _type: 'reference' } },
  excerpt: 'Notes from a cozy weekend of swapping yarn and stories.',
  publishedAt: '2026-08-09T12:00:00.000Z',
};

describe('PostCard', () => {
  test('links to the post page by slug', () => {
    render(<PostCard post={basePost} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/blog/fiber-guild-weekend');
  });

  test('shows the title, excerpt, and a human-friendly date', () => {
    render(<PostCard post={basePost} />);
    expect(screen.getByText('A Weekend with the Fiber Guild')).toBeInTheDocument();
    expect(screen.getByText(/notes from a cozy weekend/i)).toBeInTheDocument();
    expect(screen.getByText('August 9, 2026')).toBeInTheDocument();
  });

  test('shows the real cover photo with the post title as alt text when one exists', () => {
    render(<PostCard post={basePost} />);
    expect(screen.getByRole('img', { name: 'A Weekend with the Fiber Guild' })).toBeInTheDocument();
  });

  test('shows an on-brand placeholder when there is no cover image', () => {
    const post: PostSummary = { ...basePost, coverImage: undefined };
    render(<PostCard post={post} />);
    expect(screen.getByRole('img', { name: /photo coming soon/i })).toBeInTheDocument();
  });

  test('renders no date when publishedAt is missing', () => {
    const post: PostSummary = { ...basePost, publishedAt: undefined };
    render(<PostCard post={post} />);
    expect(screen.queryByText('August 9, 2026')).not.toBeInTheDocument();
  });

  test('renders no excerpt paragraph when excerpt is missing', () => {
    const post: PostSummary = { ...basePost, excerpt: undefined };
    render(<PostCard post={post} />);
    expect(screen.queryByText(/notes from a cozy weekend/i)).not.toBeInTheDocument();
  });
});
