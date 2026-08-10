'use client';

import { useState, type FormEvent } from 'react';

import { CIRCLE_FULL_MESSAGE, CIRCLE_MET_MESSAGE } from '@/lib/events';
import {
  RSVP_EMAIL_MAX,
  RSVP_NAME_MAX,
  isValidRsvpEmail,
  isValidRsvpName,
} from '@/lib/rsvp-service';

/**
 * Every way an attempt can end, from the browser's side. The five `terminal`
 * ones replace the form — there is nothing left to type. `invalid` and
 * `hiccup` leave it in place so the visitor can fix or retry.
 */
type Outcome = 'created' | 'duplicate' | 'full' | 'past' | 'notFound' | 'invalid' | 'hiccup';

const TERMINAL: ReadonlySet<Outcome> = new Set<Outcome>([
  'created',
  'duplicate',
  'full',
  'past',
  'notFound',
]);

const MESSAGES: Record<Outcome, string> = {
  created: "You're in! CJ will email you the call link before we start.",
  duplicate: "you're already signed up — see you there!",
  full: CIRCLE_FULL_MESSAGE,
  past: `${CIRCLE_MET_MESSAGE} — watch for the next one`,
  notFound: "we couldn't find that circle — it may have moved",
  invalid: 'check your name and email, then try again?',
  hiccup: 'something hiccuped — try again?',
};

const FIELD_HINTS = {
  name: "add your name so CJ knows who's coming",
  email: 'check that email address — it is where the call link goes',
} as const;

/** HTTP status → outcome. Anything unlisted is a hiccup worth retrying. */
const BY_STATUS: Record<number, Outcome> = {
  201: 'created',
  400: 'invalid',
  403: 'full',
  404: 'notFound',
  409: 'duplicate',
  410: 'past',
};

export interface RsvpFormProps {
  eventSlug: string;
}

/**
 * Name + email, and that is the whole ask — no account, no password, no
 * confirmation step. `/api/rsvp` is the authority on whether a seat exists;
 * this form only reports what it said, in CJ's voice.
 */
export default function RsvpForm({ eventSlug }: RsvpFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  // Only shown after a 400 — the server is the one that decides validity, and
  // guessing at it while someone is still typing is nagging, not helping.
  const nameHint = outcome === 'invalid' && !isValidRsvpName(name);
  const emailHint = outcome === 'invalid' && !nameHint && !isValidRsvpEmail(email);
  // A banner only when there's no field to point at: a hiccup, or a 400 whose
  // cause we cannot see from here (both fields look fine to these same rules).
  const banner = outcome !== null && !nameHint && !emailHint ? MESSAGES[outcome] : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setOutcome(null);

    let response: Response;
    try {
      response = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventSlug, name, email }),
      });
    } catch (error) {
      console.error('[rsvp] request failed', error);
      setOutcome('hiccup');
      setSubmitting(false);
      return;
    }

    // The status carries the whole answer; the body is only ever a repeat of
    // it, so an unreadable one changes nothing.
    setOutcome(BY_STATUS[response.status] ?? 'hiccup');
    setSubmitting(false);
  }

  if (outcome !== null && TERMINAL.has(outcome)) {
    return (
      <p
        role="status"
        className="rounded-xl bg-linen px-4 py-3 font-body text-charcoal"
      >
        {MESSAGES[outcome]}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {banner !== null && (
        <p role="alert" className="rounded-xl bg-linen px-4 py-3 font-body text-sm text-charcoal">
          {banner}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="rsvp-name" className="font-body text-sm font-semibold text-charcoal">
          Your name
        </label>
        <input
          id="rsvp-name"
          name="name"
          type="text"
          required
          maxLength={RSVP_NAME_MAX}
          autoComplete="name"
          value={name}
          disabled={submitting}
          onChange={(event) => setName(event.target.value)}
          aria-describedby={nameHint ? 'rsvp-name-hint' : undefined}
          className="rounded-lg border border-khaki bg-cream px-3 py-2 font-body text-charcoal disabled:opacity-60"
        />
        {nameHint && (
          <p id="rsvp-name-hint" role="alert" className="font-body text-sm text-rust">
            {FIELD_HINTS.name}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="rsvp-email" className="font-body text-sm font-semibold text-charcoal">
          Email
        </label>
        <input
          id="rsvp-email"
          name="email"
          type="email"
          required
          maxLength={RSVP_EMAIL_MAX}
          autoComplete="email"
          value={email}
          disabled={submitting}
          onChange={(event) => setEmail(event.target.value)}
          aria-describedby={emailHint ? 'rsvp-email-hint' : undefined}
          className="rounded-lg border border-khaki bg-cream px-3 py-2 font-body text-charcoal disabled:opacity-60"
        />
        {emailHint && (
          <p id="rsvp-email-hint" role="alert" className="font-body text-sm text-rust">
            {FIELD_HINTS.email}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-full bg-rust px-6 py-3 font-body text-sm font-semibold text-cream transition hover:bg-rust-soft disabled:cursor-not-allowed disabled:bg-khaki disabled:hover:bg-khaki"
      >
        {submitting ? 'saving your seat…' : 'Save my seat'}
      </button>
    </form>
  );
}
