import Link from 'next/link';

import EventCard from '@/components/event-card';
import EventDateTime from '@/components/event-date-time';
import GrannyCornerMotif from '@/components/granny-corner-motif';
import RevealGrid from '@/components/reveal-grid';
import YarnUnderline from '@/components/yarn-underline';
import { NO_CIRCLES_MESSAGE, spotsRemaining } from '@/lib/events';
import { getPastEvents, getRsvpCount, getUpcomingEvents, type EventDoc } from '@/lib/sanity/queries';

export const revalidate = 60;

/**
 * Free seats for one circle, counted server-side so the card can say how many
 * are left. Guarded on its own: one uncountable circle should cost that circle
 * its note, not the whole page its listing.
 */
async function spotsFor(event: EventDoc): Promise<number | null> {
  if (typeof event.capacity !== 'number') return null;

  try {
    return spotsRemaining(event.capacity, await getRsvpCount(event._id));
  } catch (error) {
    console.error('[community] failed to count RSVPs', error);
    return null;
  }
}

export default async function CommunityPage() {
  const now = new Date();

  // Guarded the same way as the blog and shop grids: a Sanity hiccup degrades
  // to the empty-calendar message rather than a crashed page.
  let upcoming: EventDoc[] = [];
  try {
    upcoming = await getUpcomingEvents(now);
  } catch (error) {
    console.error('[community] failed to fetch upcoming events from Sanity', error);
  }

  let past: EventDoc[] = [];
  try {
    past = await getPastEvents(now);
  } catch (error) {
    console.error('[community] failed to fetch past events from Sanity', error);
  }

  const spots = await Promise.all(upcoming.map(spotsFor));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      {/* Woven spec §3/§4: page-title motif + plum underline. */}
      <div className="inline-flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-3xl text-charcoal sm:text-4xl">Community</h1>
          <GrannyCornerMotif size="sm" />
        </div>
        <YarnUnderline color="plum" />
      </div>
      <p className="mt-3 font-body text-charcoal">
        Cozy virtual crochet circles: bring your yarn, a warm drink, and whatever you&apos;re
        working on. Save a seat with just your name and email; CJ sends the call link before we
        start.
      </p>

      {upcoming.length === 0 ? (
        <p className="mt-8 font-body text-charcoal">{NO_CIRCLES_MESSAGE}</p>
      ) : (
        <RevealGrid className="mt-8 grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
          {upcoming.map((event, index) => (
            <EventCard key={event._id} event={event} spotsLeft={spots[index]} quiltIndex={index} />
          ))}
        </RevealGrid>
      )}

      {past.length > 0 && (
        <details className="mt-12 rounded-2xl bg-linen px-5 py-4">
          <summary className="cursor-pointer font-heading text-lg text-charcoal">
            past circles
          </summary>
          <ul className="mt-3 flex flex-col gap-2">
            {past.map((event) => (
              <li key={event._id} className="font-body text-sm text-charcoal">
                <Link href={`/community/${event.slug}`} className="hover:text-rust">
                  {event.title}
                </Link>{' '}
                <EventDateTime startsAt={event.startsAt} className="text-khaki" />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
