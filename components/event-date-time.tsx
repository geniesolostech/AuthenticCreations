'use client';

import { useSyncExternalStore } from 'react';

import { formatEventDateTime, formatEventDateTimeUtc } from '@/lib/format-date';

/**
 * "Are we running in the browser yet?", asked the way React sanctions: the
 * server snapshot is `false`, the client snapshot `true`, and nothing ever
 * changes, so the store never needs to notify anyone.
 */
const noopSubscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;

export interface EventDateTimeProps {
  /** The event's `startsAt`, an ISO datetime. */
  startsAt: string;
  className?: string;
}

/**
 * When a circle meets, in the reader's own timezone.
 *
 * A live call is an appointment, so the time that matters is the visitor's —
 * which the server cannot know. Rendering it server-side would either hard-code
 * the server's zone or produce a hydration mismatch, so the HTML ships with the
 * UTC-labelled reading (which is also what a visitor without JavaScript keeps)
 * and the local one takes over once hydrated. Both renders are deterministic,
 * so React sees no mismatch.
 */
export default function EventDateTime({ startsAt, className }: EventDateTimeProps) {
  const hydrated = useSyncExternalStore(noopSubscribe, onClient, onServer);

  const utc = formatEventDateTimeUtc(startsAt);
  if (utc === '') return null;

  const local = hydrated ? formatEventDateTime(startsAt) : '';

  return (
    <time dateTime={startsAt} className={className}>
      {local === '' ? utc : local}
    </time>
  );
}
