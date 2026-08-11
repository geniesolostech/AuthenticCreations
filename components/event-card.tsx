import Link from 'next/link';

import EventDateTime from '@/components/event-date-time';
import { spotsNote } from '@/lib/events';
import { quiltStyle } from '@/lib/quilt';
import type { EventDoc } from '@/lib/sanity/queries';

export interface EventCardProps {
  event: EventDoc;
  /**
   * Free seats, counted on the server. `null`/omitted for a circle with no
   * capacity — unlimited, so there is nothing to count down.
   */
  spotsLeft?: number | null;
  /** Position in the grid — picks a frame/fill off the quilt rotation
   * (Woven spec §3). Omit for non-grid usages, which keep the plain card
   * look plus the shared card shadow. */
  quiltIndex?: number;
}

/** A single circle on `/community`: when it meets, what it is, how full it is,
 * and a way in. */
export default function EventCard({ event, spotsLeft = null, quiltIndex }: EventCardProps) {
  const note = spotsNote(spotsLeft);
  const quilt = quiltIndex === undefined ? null : quiltStyle(quiltIndex);

  return (
    <Link
      href={`/community/${event.slug}`}
      className={
        quilt
          ? `group flex flex-col gap-2 rounded-2xl px-5 py-5 border-2 ${quilt.frame} ${quilt.fill} shadow-card hover:shadow-card-hover transition-shadow duration-200`
          : 'group flex flex-col gap-2 rounded-2xl bg-linen px-5 py-5 transition hover:shadow-md shadow-card'
      }
    >
      <EventDateTime startsAt={event.startsAt} className="font-body text-xs text-khaki" />
      <h3 className="font-heading text-lg text-charcoal">{event.title}</h3>
      {event.description ? (
        <p className="font-body text-sm text-charcoal">{event.description}</p>
      ) : null}
      {note ? <p className="font-body text-sm font-semibold text-plum">{note}</p> : null}
    </Link>
  );
}
