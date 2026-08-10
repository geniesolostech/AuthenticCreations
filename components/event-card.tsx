import Link from 'next/link';

import EventDateTime from '@/components/event-date-time';
import { spotsNote } from '@/lib/events';
import type { EventDoc } from '@/lib/sanity/queries';

export interface EventCardProps {
  event: EventDoc;
  /**
   * Free seats, counted on the server. `null`/omitted for a circle with no
   * capacity — unlimited, so there is nothing to count down.
   */
  spotsLeft?: number | null;
}

/** A single circle on `/community`: when it meets, what it is, how full it is,
 * and a way in. */
export default function EventCard({ event, spotsLeft = null }: EventCardProps) {
  const note = spotsNote(spotsLeft);

  return (
    <Link
      href={`/community/${event.slug}`}
      className="group flex flex-col gap-2 rounded-2xl bg-linen px-5 py-5 transition hover:shadow-md"
    >
      <EventDateTime startsAt={event.startsAt} className="font-body text-xs text-khaki" />
      <h3 className="font-heading text-lg text-charcoal">{event.title}</h3>
      {event.description ? (
        <p className="font-body text-sm text-charcoal">{event.description}</p>
      ) : null}
      {note ? <p className="font-body text-sm font-semibold text-rust">{note}</p> : null}
    </Link>
  );
}
