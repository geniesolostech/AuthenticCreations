import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, test } from 'vitest';

import EventCard from '@/components/event-card';
import EventDateTime from '@/components/event-date-time';
import type { EventDoc } from '@/lib/sanity/queries';

const EVENT: EventDoc = {
  _id: 'e1',
  title: 'August Crochet Circle',
  slug: 'august-circle',
  startsAt: '2026-08-20T23:00:00.000Z',
  description: 'Bring your yarn and a cup of something warm.',
};

/** ICU sometimes uses a narrow no-break space before AM/PM; readers do not care. */
function normalize(text: string | null | undefined): string {
  return (text ?? '').replace(/ /g, ' ');
}

describe('EventCard', () => {
  test('links to the circle and shows its title and description', () => {
    render(<EventCard event={EVENT} />);

    expect(screen.getByRole('link', { name: /august crochet circle/i })).toHaveAttribute(
      'href',
      '/community/august-circle',
    );
    expect(screen.getByText(/bring your yarn/i)).toBeInTheDocument();
  });

  test('says nothing about spots for an unlimited circle', () => {
    render(<EventCard event={EVENT} />);

    expect(screen.queryByText(/spots? left/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/full/i)).not.toBeInTheDocument();
  });

  test('says nothing when there is plenty of room', () => {
    render(<EventCard event={EVENT} spotsLeft={6} />);

    expect(screen.queryByText(/spots? left/i)).not.toBeInTheDocument();
  });

  test('counts down when the circle is filling up', () => {
    render(<EventCard event={EVENT} spotsLeft={3} />);

    expect(screen.getByText('3 spots left')).toBeInTheDocument();
  });

  test('announces a full circle in the brief’s words', () => {
    render(<EventCard event={EVENT} spotsLeft={0} />);

    expect(
      screen.getByText('this circle is full 💛. Check back for the next one.'),
    ).toBeInTheDocument();
  });

  test('renders no description node when the event has none', () => {
    render(<EventCard event={{ ...EVENT, description: undefined }} />);

    expect(screen.queryByText(/bring your yarn/i)).not.toBeInTheDocument();
  });
});

describe('EventDateTime', () => {
  const originalTZ = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTZ;
  });

  test('shows the start in the reader’s own timezone once mounted', () => {
    process.env.TZ = 'America/New_York';

    render(<EventDateTime startsAt="2026-08-20T23:00:00.000Z" />);

    // 23:00 UTC is 7:00 PM in New York — a live call is an appointment, so the
    // reader's clock is the one that matters.
    expect(normalize(screen.getByText(/August 20, 2026/).textContent)).toBe(
      'August 20, 2026 at 7:00 PM',
    );
  });

  test('carries the machine-readable instant in a <time> element', () => {
    render(<EventDateTime startsAt="2026-08-20T23:00:00.000Z" />);

    expect(screen.getByText(/August 2\d, 2026/).tagName).toBe('TIME');
    expect(screen.getByText(/August 2\d, 2026/)).toHaveAttribute(
      'datetime',
      '2026-08-20T23:00:00.000Z',
    );
  });

  test('the server render is the UTC reading, labelled — never the server’s own clock', () => {
    process.env.TZ = 'Pacific/Kiritimati'; // UTC+14: a "server" nowhere near the reader

    const html = renderToStaticMarkup(<EventDateTime startsAt="2026-08-20T23:00:00.000Z" />);

    expect(normalize(html)).toContain('August 20, 2026 at 11:00 PM UTC');
    expect(normalize(html)).not.toContain('August 21');
  });

  test('renders nothing at all for an unreadable date', () => {
    const { container } = render(<EventDateTime startsAt="one day soon" />);

    expect(container).toBeEmptyDOMElement();
  });
});
