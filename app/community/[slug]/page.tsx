import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import EventDateTime from '@/components/event-date-time';
import RsvpForm from '@/components/rsvp-form';
import {
  CIRCLE_FULL_MESSAGE,
  CIRCLE_MET_MESSAGE,
  hasStarted,
  spotsNote,
  spotsRemaining,
} from '@/lib/events';
import { getEventBySlug, getRsvpCount, type EventDoc } from '@/lib/sanity/queries';

export const revalidate = 60;

interface EventPageParams {
  slug: string;
}

/**
 * Logs and rethrows, deliberately — the throw is the point.
 *
 * Returning null here would funnel a transient Sanity outage into `notFound()`,
 * and a 404 is a *statement* that this circle does not exist: Next may cache it
 * and serve it for the rest of the page's lifetime, so a few seconds of
 * trouble takes a real, RSVP-able circle off the site long after Sanity is
 * back. An escaping error is a 500 instead — retryable, never cached.
 * `getEventBySlug` resolves null for a genuine miss, which is the only thing
 * that should reach `notFound()`.
 */
async function fetchEvent(slug: string): Promise<EventDoc | null> {
  try {
    return await getEventBySlug(slug);
  } catch (error) {
    console.error('[community] failed to fetch event from Sanity', error);
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<EventPageParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await fetchEvent(slug);
  if (!event) return {};

  return {
    title: event.title,
    description: event.description,
  };
}

export default async function CommunityEventPage({
  params,
}: {
  params: Promise<EventPageParams>;
}) {
  const { slug } = await params;

  const event = await fetchEvent(slug);
  if (!event) notFound();

  const past = hasStarted(event.startsAt, new Date());

  // Only counted for a circle that can still be joined, and only when there is
  // a capacity to count against.
  let spotsLeft: number | null = null;
  if (!past && typeof event.capacity === 'number') {
    try {
      spotsLeft = spotsRemaining(event.capacity, await getRsvpCount(event._id));
    } catch (error) {
      console.error('[community] failed to count RSVPs', error);
    }
  }

  const full = spotsLeft !== null && spotsLeft <= 0;
  // The full message has its own home below, so don't say it twice.
  const note = full ? null : spotsNote(spotsLeft);

  return (
    <article className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link href="/community" className="font-body text-sm text-khaki hover:text-rust">
        ← all circles
      </Link>

      <h1 className="mt-4 font-heading text-3xl text-charcoal sm:text-4xl">{event.title}</h1>
      <EventDateTime startsAt={event.startsAt} className="mt-2 block font-body text-charcoal" />

      {event.description ? (
        <p className="mt-6 font-body leading-relaxed text-charcoal">{event.description}</p>
      ) : null}

      {note ? <p className="mt-6 font-body text-sm font-semibold text-rust">{note}</p> : null}

      <div className="mt-8">
        {past ? (
          <p className="rounded-xl bg-linen px-4 py-3 font-body text-charcoal">
            {CIRCLE_MET_MESSAGE}
          </p>
        ) : full ? (
          <p className="rounded-xl bg-linen px-4 py-3 font-body text-charcoal">
            {CIRCLE_FULL_MESSAGE}
          </p>
        ) : (
          <RsvpForm eventSlug={event.slug} />
        )}
      </div>
    </article>
  );
}
