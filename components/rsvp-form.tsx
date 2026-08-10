'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';

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
type Outcome =
  | 'created'
  | 'duplicate'
  | 'full'
  | 'past'
  | 'notFound'
  | 'invalid'
  | 'throttled'
  | 'hiccup';

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
  // Distinct from `hiccup` on purpose: "try again" is exactly the wrong advice
  // for someone the server has just asked to slow down.
  throttled: "that's a few tries in a row — give it a couple of minutes and we'll try again",
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
  429: 'throttled',
};

/** Which field a 400 is about, if we can tell from here. `null` means we can't. */
type OffendingField = 'name' | 'email' | null;

/**
 * The one rule for reading a 400, used twice: to decide which hint to show and
 * to decide where focus should land. Two copies of it would drift, and the
 * drift would be a hint pointing at one field while the cursor sits in another.
 *
 * Only ever consulted after the server has said no — guessing at validity while
 * someone is still typing is nagging, not helping.
 */
function offendingField(outcome: Outcome | null, name: string, email: string): OffendingField {
  if (outcome !== 'invalid') return null;
  if (!isValidRsvpName(name)) return 'name';
  if (!isValidRsvpEmail(email)) return 'email';
  return null;
}

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

  const outcomeRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  /**
   * Where focus goes when the next answer lands, decided when the answer is
   * *read* rather than when it renders. Derived state would be re-derived on
   * every keystroke, and the effect below would then chase a hint that
   * disappears as the visitor fixes their address — pulling the cursor out of
   * the field they are typing in.
   */
  const focusTargetRef = useRef<OffendingField>(null);

  const hintField = offendingField(outcome, name, email);
  const nameHint = hintField === 'name';
  const emailHint = hintField === 'email';
  // The announcement is the message itself, except when there is a field to
  // point at — then the hint beside that field says it better.
  const announcement = outcome !== null && hintField === null ? MESSAGES[outcome] : null;
  const terminal = outcome !== null && TERMINAL.has(outcome);

  // Focus follows the answer. Both inputs are disabled while the POST is in
  // flight, which drops focus to <body>, and a terminal answer takes the whole
  // form away — so without this a keyboard or screen-reader visitor is left
  // standing nowhere, with nothing announced.
  useEffect(() => {
    if (outcome === null) return;
    const target =
      focusTargetRef.current === 'name'
        ? nameRef.current
        : focusTargetRef.current === 'email'
          ? emailRef.current
          : outcomeRef.current;
    target?.focus();
  }, [outcome]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setOutcome(null);

    function settle(next: Outcome) {
      focusTargetRef.current = offendingField(next, name, email);
      setOutcome(next);
      setSubmitting(false);
    }

    let response: Response;
    try {
      response = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventSlug, name, email }),
      });
    } catch (error) {
      console.error('[rsvp] request failed', error);
      settle('hiccup');
      return;
    }

    // The status carries the whole answer; the body is only ever a repeat of
    // it, so an unreadable one changes nothing.
    settle(BY_STATUS[response.status] ?? 'hiccup');
  }

  return (
    <div>
      {/*
        Mounted from first paint and never removed, including when the form
        below is retired. A live region that appears *with* its message already
        inside it is routinely not announced at all — there is no change for a
        screen reader to notice — and this one has to survive the form
        disappearing under it, since that is exactly when it has news.
        `tabIndex={-1}` makes it a place focus can be put without putting it in
        the tab order.
      */}
      <div
        ref={outcomeRef}
        role="status"
        aria-live="polite"
        tabIndex={-1}
        className={
          announcement === null
            ? undefined
            : `rounded-xl bg-linen px-4 py-3 font-body text-charcoal${terminal ? '' : ' mb-4'}`
        }
      >
        {announcement}
      </div>

      {!terminal && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="rsvp-name" className="font-body text-sm font-semibold text-charcoal">
              Your name
            </label>
            <input
              ref={nameRef}
              id="rsvp-name"
              name="name"
              type="text"
              required
              maxLength={RSVP_NAME_MAX}
              autoComplete="name"
              value={name}
              disabled={submitting}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={nameHint || undefined}
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
              ref={emailRef}
              id="rsvp-email"
              name="email"
              type="email"
              required
              maxLength={RSVP_EMAIL_MAX}
              autoComplete="email"
              value={email}
              disabled={submitting}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={emailHint || undefined}
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
      )}
    </div>
  );
}
