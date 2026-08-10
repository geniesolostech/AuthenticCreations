import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import RsvpForm from '@/components/rsvp-form';

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status });
}

/** Fills both fields and submits — the path every real sign-up takes. */
async function signUp(
  user: ReturnType<typeof userEvent.setup>,
  fields: { name?: string; email?: string } = {},
) {
  const { name = 'Marisol Vega', email = 'marisol@example.com' } = fields;
  await user.type(screen.getByLabelText(/name/i), name);
  await user.type(screen.getByLabelText(/email/i), email);
  await user.click(screen.getByRole('button', { name: /save my seat/i }));
}

function nameField(): HTMLElement | null {
  return screen.queryByLabelText(/name/i);
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('RsvpForm — the form itself', () => {
  test('offers a labelled, required name and email, and a submit button', () => {
    render(<RsvpForm eventSlug="august-circle" />);

    expect(screen.getByLabelText(/name/i)).toBeRequired();
    expect(screen.getByLabelText(/email/i)).toBeRequired();
    expect(screen.getByRole('button', { name: /save my seat/i })).toBeEnabled();
  });

  test('POSTs the event slug with the typed name and email', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(json({ result: 'CREATED' }, 201));
    const user = userEvent.setup();

    render(<RsvpForm eventSlug="august-circle" />);
    await signUp(user);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/rsvp');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      eventSlug: 'august-circle',
      name: 'Marisol Vega',
      email: 'marisol@example.com',
    });
  });

  test('shows the pending label and locks the fields while the POST is in flight', async () => {
    let resolve: (value: Response) => void = () => {};
    vi.spyOn(global, 'fetch').mockReturnValue(
      new Promise<Response>((r) => {
        resolve = r;
      }),
    );
    const user = userEvent.setup();

    render(<RsvpForm eventSlug="august-circle" />);
    await signUp(user);

    expect(screen.getByRole('button', { name: /saving your seat/i })).toBeDisabled();
    expect(screen.getByLabelText(/name/i)).toBeDisabled();
    expect(screen.getByLabelText(/email/i)).toBeDisabled();

    resolve(json({ result: 'CREATED' }, 201));
    await screen.findByText(/You're in!/);
  });

  test('a double submit only ever books one seat', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(json({ result: 'CREATED' }, 201));
    const user = userEvent.setup();

    render(<RsvpForm eventSlug="august-circle" />);
    await user.type(screen.getByLabelText(/name/i), 'Marisol Vega');
    await user.type(screen.getByLabelText(/email/i), 'marisol@example.com');
    const button = screen.getByRole('button', { name: /save my seat/i });
    await user.dblClick(button);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});

describe('RsvpForm — terminal answers', () => {
  test('201 shows the you-are-in copy and retires the form', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(json({ result: 'CREATED' }, 201));
    const user = userEvent.setup();

    render(<RsvpForm eventSlug="august-circle" />);
    await signUp(user);

    expect(
      await screen.findByText("You're in! CJ will email you the call link before we start."),
    ).toBeInTheDocument();
    expect(nameField()).not.toBeInTheDocument();
  });

  test('409 shows the already-signed-up copy', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(json({ error: 'DUPLICATE' }, 409));
    const user = userEvent.setup();

    render(<RsvpForm eventSlug="august-circle" />);
    await signUp(user);

    expect(
      await screen.findByText("you're already signed up, see you there!"),
    ).toBeInTheDocument();
    expect(nameField()).not.toBeInTheDocument();
  });

  test('403 shows the full-circle copy', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(json({ error: 'FULL' }, 403));
    const user = userEvent.setup();

    render(<RsvpForm eventSlug="august-circle" />);
    await signUp(user);

    expect(
      await screen.findByText('this circle is full 💛, check back for the next one'),
    ).toBeInTheDocument();
    expect(nameField()).not.toBeInTheDocument();
  });

  test('410 says the circle has already met', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(json({ error: 'PAST' }, 410));
    const user = userEvent.setup();

    render(<RsvpForm eventSlug="august-circle" />);
    await signUp(user);

    expect(await screen.findByText(/this circle has already met/i)).toBeInTheDocument();
    expect(nameField()).not.toBeInTheDocument();
  });

  test('404 says the circle could not be found', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(json({ error: 'NOT_FOUND' }, 404));
    const user = userEvent.setup();

    render(<RsvpForm eventSlug="gone" />);
    await signUp(user);

    expect(await screen.findByText(/couldn't find that circle/i)).toBeInTheDocument();
    expect(nameField()).not.toBeInTheDocument();
  });

  test('an unreadable body does not stop the status from being understood', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('not json', { status: 403 }));
    const user = userEvent.setup();

    render(<RsvpForm eventSlug="august-circle" />);
    await signUp(user);

    expect(
      await screen.findByText('this circle is full 💛, check back for the next one'),
    ).toBeInTheDocument();
  });
});

describe('RsvpForm — 400 inline guidance', () => {
  test('points at the email when the email is the thing that is off', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(json({ error: 'INVALID' }, 400));
    const user = userEvent.setup();

    render(<RsvpForm eventSlug="august-circle" />);
    await signUp(user, { email: 'marisol@example' });

    expect(await screen.findByText(/check that email address/i)).toBeInTheDocument();
    // The form stays put, with what they typed still in it.
    expect(screen.getByLabelText(/email/i)).toHaveValue('marisol@example');
    expect(screen.getByRole('button', { name: /save my seat/i })).toBeEnabled();
  });

  test('points at the name when the name is the thing that is off', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(json({ error: 'INVALID' }, 400));
    const user = userEvent.setup();

    render(<RsvpForm eventSlug="august-circle" />);
    await signUp(user, { name: '   ' });

    expect(await screen.findByText(/add your name/i)).toBeInTheDocument();
    expect(nameField()).toBeInTheDocument();
  });

  test('falls back to a general nudge when both fields look fine to us', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(json({ error: 'INVALID' }, 400));
    const user = userEvent.setup();

    render(<RsvpForm eventSlug="august-circle" />);
    await signUp(user);

    expect(await screen.findByText(/check your name and email/i)).toBeInTheDocument();
    expect(nameField()).toBeInTheDocument();
  });

  test('a corrected retry can still succeed', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(json({ error: 'INVALID' }, 400))
      .mockResolvedValueOnce(json({ result: 'CREATED' }, 201));
    const user = userEvent.setup();

    render(<RsvpForm eventSlug="august-circle" />);
    await signUp(user, { email: 'marisol@example' });
    await screen.findByText(/check that email address/i);

    await user.type(screen.getByLabelText(/email/i), '.com');
    await user.click(screen.getByRole('button', { name: /save my seat/i }));

    expect(
      await screen.findByText("You're in! CJ will email you the call link before we start."),
    ).toBeInTheDocument();
  });
});

describe('RsvpForm — announcements and focus', () => {
  /** The persistent live region. It is in the DOM from first paint. */
  function liveRegion(): HTMLElement {
    return screen.getByRole('status');
  }

  test('the live region is mounted and empty before anything is submitted', () => {
    render(<RsvpForm eventSlug="august-circle" />);

    // Mounted up front on purpose: a live region inserted *with* its message
    // already in it is routinely not announced at all, because there is no
    // change for the screen reader to notice.
    expect(liveRegion()).toBeInTheDocument();
    expect(liveRegion()).toHaveTextContent('');
    expect(liveRegion()).toHaveAttribute('aria-live', 'polite');
  });

  test('a terminal answer lands in that same region, and takes focus with it', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(json({ result: 'CREATED' }, 201));
    const user = userEvent.setup();

    render(<RsvpForm eventSlug="august-circle" />);
    await signUp(user);

    await waitFor(() => expect(liveRegion()).toHaveTextContent(/You're in!/));
    // Both fields were disabled mid-flight, which drops focus to <body>; the
    // form is then gone entirely. Without this the visitor is left nowhere.
    expect(liveRegion()).toHaveFocus();
  });

  test('a retryable hiccup announces and takes focus without retiring the form', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
    const user = userEvent.setup();

    render(<RsvpForm eventSlug="august-circle" />);
    await signUp(user);

    await waitFor(() => expect(liveRegion()).toHaveTextContent(/something hiccuped/i));
    expect(liveRegion()).toHaveFocus();
    expect(screen.getByRole('button', { name: /save my seat/i })).toBeEnabled();
  });

  test('a 400 about the email marks that field invalid and puts the cursor in it', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(json({ error: 'INVALID' }, 400));
    const user = userEvent.setup();

    render(<RsvpForm eventSlug="august-circle" />);
    await signUp(user, { email: 'marisol@example' });

    await screen.findByText(/check that email address/i);
    const email = screen.getByLabelText(/email/i);
    expect(email).toHaveAttribute('aria-invalid', 'true');
    // Focus goes to the thing to fix, not to a general notice: its hint is
    // wired up with aria-describedby, so landing there reads the hint out.
    expect(email).toHaveFocus();
    expect(screen.getByLabelText(/name/i)).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('a 400 about the name marks that field invalid and puts the cursor in it', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(json({ error: 'INVALID' }, 400));
    const user = userEvent.setup();

    render(<RsvpForm eventSlug="august-circle" />);
    await signUp(user, { name: '   ' });

    await screen.findByText(/add your name/i);
    expect(nameField()).toHaveAttribute('aria-invalid', 'true');
    expect(nameField()).toHaveFocus();
  });

  test('a 400 we cannot pin on a field announces in the live region instead', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(json({ error: 'INVALID' }, 400));
    const user = userEvent.setup();

    render(<RsvpForm eventSlug="august-circle" />);
    await signUp(user);

    await waitFor(() => expect(liveRegion()).toHaveTextContent(/check your name and email/i));
    expect(liveRegion()).toHaveFocus();
    expect(nameField()).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('neither field is marked invalid before anything has been submitted', () => {
    render(<RsvpForm eventSlug="august-circle" />);

    expect(nameField()).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/email/i)).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('typing after a rejection does not yank focus back to the notice', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(json({ error: 'INVALID' }, 400));
    const user = userEvent.setup();

    render(<RsvpForm eventSlug="august-circle" />);
    await signUp(user, { email: 'marisol@example' });
    await screen.findByText(/check that email address/i);

    await user.type(screen.getByLabelText(/email/i), '.com');

    // The hint disappears as the address becomes valid again; focus must stay
    // where the visitor is typing rather than following the vanishing hint.
    expect(screen.getByLabelText(/email/i)).toHaveFocus();
  });
});

describe('RsvpForm — retryable faults', () => {
  test('a dropped connection says something hiccuped and keeps the form', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
    const user = userEvent.setup();

    render(<RsvpForm eventSlug="august-circle" />);
    await signUp(user);

    expect(await screen.findByText(/something hiccuped, try again\?/i)).toBeInTheDocument();
    expect(nameField()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save my seat/i })).toBeEnabled();
  });

  test('503 lands in the same retryable bucket', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(json({ error: 'TRY_AGAIN' }, 503));
    const user = userEvent.setup();

    render(<RsvpForm eventSlug="august-circle" />);
    await signUp(user);

    expect(await screen.findByText(/something hiccuped, try again\?/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save my seat/i })).toBeEnabled();
  });

  test('an unexpected 500 does too', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(json({ error: 'BOOM' }, 500));
    const user = userEvent.setup();

    render(<RsvpForm eventSlug="august-circle" />);
    await signUp(user);

    expect(await screen.findByText(/something hiccuped, try again\?/i)).toBeInTheDocument();
  });

  test('retrying after a hiccup can still book the seat, and clears the notice', async () => {
    vi.spyOn(global, 'fetch')
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(json({ result: 'CREATED' }, 201));
    const user = userEvent.setup();

    render(<RsvpForm eventSlug="august-circle" />);
    await signUp(user);
    await screen.findByText(/something hiccuped/i);

    await user.click(screen.getByRole('button', { name: /save my seat/i }));

    expect(
      await screen.findByText("You're in! CJ will email you the call link before we start."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/something hiccuped/i)).not.toBeInTheDocument();
  });
});
