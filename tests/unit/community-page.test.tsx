import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import CommunityPage from '@/app/community/page';
import { getPastEvents, getRsvpCount, getUpcomingEvents } from '@/lib/sanity/queries';
import type { EventDoc } from '@/lib/sanity/queries';

vi.mock('@/lib/sanity/queries', () => ({
  getUpcomingEvents: vi.fn(),
  getPastEvents: vi.fn(),
  getRsvpCount: vi.fn(),
}));

const upcoming = vi.mocked(getUpcomingEvents);
const past = vi.mocked(getPastEvents);
const rsvpCount = vi.mocked(getRsvpCount);

const AUGUST: EventDoc = {
  _id: 'e1',
  title: 'August Crochet Circle',
  slug: 'august-circle',
  startsAt: '2099-08-20T23:00:00.000Z',
  description: 'Bring your yarn.',
};

const SEPTEMBER: EventDoc = {
  _id: 'e2',
  title: 'September Crochet Circle',
  slug: 'september-circle',
  startsAt: '2099-09-20T23:00:00.000Z',
};

beforeEach(() => {
  upcoming.mockReset();
  past.mockReset();
  rsvpCount.mockReset();
  upcoming.mockResolvedValue([]);
  past.mockResolvedValue([]);
  rsvpCount.mockResolvedValue(0);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('/community — the calendar', () => {
  test('renders a card per upcoming circle, in the order Sanity returns them', async () => {
    upcoming.mockResolvedValue([AUGUST, SEPTEMBER]);

    render(await CommunityPage());

    expect(screen.getByRole('link', { name: /august crochet circle/i })).toHaveAttribute(
      'href',
      '/community/august-circle',
    );
    expect(screen.getByRole('link', { name: /september crochet circle/i })).toHaveAttribute(
      'href',
      '/community/september-circle',
    );
  });

  test('asks Sanity for events either side of one single "now"', async () => {
    await CommunityPage();

    const upcomingNow = upcoming.mock.calls[0][0];
    const pastNow = past.mock.calls[0][0];
    expect(upcomingNow).toBeInstanceOf(Date);
    expect(pastNow).toEqual(upcomingNow);
  });

  test('shows the empty-calendar copy when nothing is scheduled', async () => {
    render(await CommunityPage());

    expect(
      screen.getByText('no circles on the calendar right now — follow the blog for the next one'),
    ).toBeInTheDocument();
  });

  test('degrades to the empty state instead of crashing when Sanity throws', async () => {
    upcoming.mockRejectedValue(new Error('network down'));
    past.mockRejectedValue(new Error('network down'));

    render(await CommunityPage());

    expect(
      screen.getByText('no circles on the calendar right now — follow the blog for the next one'),
    ).toBeInTheDocument();
  });
});

describe('/community — spots left', () => {
  test('counts RSVPs server-side and says how many seats are left', async () => {
    upcoming.mockResolvedValue([{ ...AUGUST, capacity: 8 }]);
    rsvpCount.mockResolvedValue(6);

    render(await CommunityPage());

    expect(rsvpCount).toHaveBeenCalledWith('e1');
    expect(screen.getByText('2 spots left')).toBeInTheDocument();
  });

  test('stays quiet when the circle is roomy', async () => {
    upcoming.mockResolvedValue([{ ...AUGUST, capacity: 20 }]);
    rsvpCount.mockResolvedValue(1);

    render(await CommunityPage());

    expect(screen.queryByText(/spots? left/i)).not.toBeInTheDocument();
  });

  test('never counts a circle with no capacity', async () => {
    upcoming.mockResolvedValue([AUGUST]);

    render(await CommunityPage());

    expect(rsvpCount).not.toHaveBeenCalled();
    expect(screen.queryByText(/spots? left/i)).not.toBeInTheDocument();
  });

  test('a full circle says so on the card', async () => {
    upcoming.mockResolvedValue([{ ...AUGUST, capacity: 8 }]);
    rsvpCount.mockResolvedValue(8);

    render(await CommunityPage());

    expect(
      screen.getByText('this circle is full 💛 — check back for the next one'),
    ).toBeInTheDocument();
  });

  test('an uncountable circle loses its note, not its listing', async () => {
    upcoming.mockResolvedValue([{ ...AUGUST, capacity: 8 }]);
    rsvpCount.mockRejectedValue(new Error('count failed'));

    render(await CommunityPage());

    expect(screen.getByRole('link', { name: /august crochet circle/i })).toBeInTheDocument();
    expect(screen.queryByText(/spots? left/i)).not.toBeInTheDocument();
  });
});

describe('/community — past circles', () => {
  test('lists them, collapsed, under a "past circles" summary', async () => {
    past.mockResolvedValue([{ ...AUGUST, _id: 'old', title: 'July Circle', slug: 'july-circle' }]);

    render(await CommunityPage());

    const details = screen.getByText('past circles').closest('details');
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute('open');
    expect(screen.getByRole('link', { name: 'July Circle' })).toHaveAttribute(
      'href',
      '/community/july-circle',
    );
  });

  test('shows no past section at all when there are none', async () => {
    render(await CommunityPage());

    expect(screen.queryByText('past circles')).not.toBeInTheDocument();
  });
});
