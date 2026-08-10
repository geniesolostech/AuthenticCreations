import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import CommunityEventPage, { generateMetadata } from '@/app/community/[slug]/page';
import { getEventBySlug, getRsvpCount } from '@/lib/sanity/queries';
import type { EventDoc } from '@/lib/sanity/queries';

vi.mock('@/lib/sanity/queries', () => ({
  getEventBySlug: vi.fn(),
  getRsvpCount: vi.fn(),
}));

const eventBySlug = vi.mocked(getEventBySlug);
const rsvpCount = vi.mocked(getRsvpCount);

const UPCOMING: EventDoc = {
  _id: 'e1',
  title: 'August Crochet Circle',
  slug: 'august-circle',
  startsAt: '2099-08-20T23:00:00.000Z',
  description: 'Bring your yarn and a cup of something warm.',
};

const PAST: EventDoc = { ...UPCOMING, _id: 'e0', title: 'July Circle', slug: 'july-circle', startsAt: '2020-07-20T23:00:00.000Z' };

function renderPage(slug: string) {
  return CommunityEventPage({ params: Promise.resolve({ slug }) });
}

beforeEach(() => {
  eventBySlug.mockReset();
  rsvpCount.mockReset();
  eventBySlug.mockResolvedValue(UPCOMING);
  rsvpCount.mockResolvedValue(0);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('/community/[slug] — an upcoming circle', () => {
  test('shows the circle and the RSVP form', async () => {
    render(await renderPage('august-circle'));

    expect(
      screen.getByRole('heading', { level: 1, name: 'August Crochet Circle' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/bring your yarn/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save my seat/i })).toBeInTheDocument();
  });

  test('links back to the calendar', async () => {
    render(await renderPage('august-circle'));

    expect(screen.getByRole('link', { name: /all circles/i })).toHaveAttribute(
      'href',
      '/community',
    );
  });

  test('says how many seats are left when the circle is filling up', async () => {
    eventBySlug.mockResolvedValue({ ...UPCOMING, capacity: 8 });
    rsvpCount.mockResolvedValue(7);

    render(await renderPage('august-circle'));

    expect(screen.getByText('1 spot left')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save my seat/i })).toBeInTheDocument();
  });

  test('never counts RSVPs for a circle with no capacity', async () => {
    render(await renderPage('august-circle'));

    expect(rsvpCount).not.toHaveBeenCalled();
  });

  test('a failed count costs the note, not the form', async () => {
    eventBySlug.mockResolvedValue({ ...UPCOMING, capacity: 8 });
    rsvpCount.mockRejectedValue(new Error('count failed'));

    render(await renderPage('august-circle'));

    expect(screen.getByRole('button', { name: /save my seat/i })).toBeInTheDocument();
    expect(screen.queryByText(/spots? left/i)).not.toBeInTheDocument();
  });
});

describe('/community/[slug] — a full circle', () => {
  test('says it is full and offers no form', async () => {
    eventBySlug.mockResolvedValue({ ...UPCOMING, capacity: 8 });
    rsvpCount.mockResolvedValue(8);

    render(await renderPage('august-circle'));

    expect(
      screen.getByText('this circle is full 💛 — check back for the next one'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save my seat/i })).not.toBeInTheDocument();
  });
});

describe('/community/[slug] — a past circle', () => {
  test('says it has already met and offers no form', async () => {
    eventBySlug.mockResolvedValue(PAST);

    render(await renderPage('july-circle'));

    expect(screen.getByText('this circle has already met')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save my seat/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });

  test('does not bother counting seats for a circle that has met', async () => {
    eventBySlug.mockResolvedValue({ ...PAST, capacity: 8 });

    render(await renderPage('july-circle'));

    expect(rsvpCount).not.toHaveBeenCalled();
  });
});

describe('/community/[slug] — unknown slugs', () => {
  test('calls notFound() for a slug that is not a circle', async () => {
    eventBySlug.mockResolvedValue(null);

    await expect(renderPage('does-not-exist')).rejects.toThrow();
  });

  test('calls notFound() instead of crashing when Sanity throws', async () => {
    eventBySlug.mockRejectedValue(new Error('network down'));

    await expect(renderPage('august-circle')).rejects.toThrow();
  });
});

describe('/community/[slug] — metadata', () => {
  test('builds title and description from the event', async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: 'august-circle' }) });

    expect(metadata.title).toBe('August Crochet Circle');
    expect(metadata.description).toBe('Bring your yarn and a cup of something warm.');
  });

  test('is happy with an unknown slug', async () => {
    eventBySlug.mockResolvedValue(null);

    await expect(
      generateMetadata({ params: Promise.resolve({ slug: 'nope' }) }),
    ).resolves.toBeTruthy();
  });
});
