/**
 * `<Rum/>` tests.
 *
 * The failure this file exists to prevent is the quiet one: analytics that
 * either crashes a dev machine that has no app monitor, or that ships a 100KB
 * client to every visitor to do nothing. So both directions are asserted —
 * unset means the module is never even fetched, set means the client starts
 * with the configuration the spec fixed.
 */
import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rum = vi.hoisted(() => ({ AwsRum: vi.fn() }));

vi.mock('aws-rum-web', () => ({ AwsRum: rum.AwsRum }));

import Rum from '@/components/rum';

const APP_MONITOR_ID = '00000000-0000-0000-0000-000000000000';
const IDENTITY_POOL_ID = 'us-east-1:11111111-2222-3333-4444-555555555555';
const REGION = 'us-east-1';

function configure(
  values: Partial<Record<'app' | 'pool' | 'region', string | undefined>> = {},
): void {
  vi.stubEnv('NEXT_PUBLIC_RUM_APP_MONITOR_ID', 'app' in values ? values.app : APP_MONITOR_ID);
  vi.stubEnv('NEXT_PUBLIC_RUM_IDENTITY_POOL_ID', 'pool' in values ? values.pool : IDENTITY_POOL_ID);
  vi.stubEnv('NEXT_PUBLIC_RUM_REGION', 'region' in values ? values.region : REGION);
}

beforeEach(() => {
  rum.AwsRum.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('<Rum/> — unconfigured', () => {
  it('renders nothing and does not throw when every variable is unset', () => {
    configure({ app: undefined, pool: undefined, region: undefined });

    const { container } = render(<Rum />);

    expect(container).toBeEmptyDOMElement();
  });

  it('never loads the RUM client when every variable is unset', async () => {
    configure({ app: undefined, pool: undefined, region: undefined });

    render(<Rum />);
    // The import is a microtask away at most; a tick is enough to catch it.
    await Promise.resolve();

    expect(rum.AwsRum).not.toHaveBeenCalled();
  });

  const partial: [string, Parameters<typeof configure>[0]][] = [
    ['the app monitor id', { app: undefined }],
    ['the identity pool id', { pool: undefined }],
    ['the region', { region: undefined }],
    ['a blank app monitor id', { app: '' }],
    ['a blank identity pool id', { pool: '' }],
    ['a blank region', { region: '' }],
  ];

  for (const [label, values] of partial) {
    it(`stays off when ${label} is missing`, async () => {
      // A half-configured client either throws on load or beacons into the
      // void; neither is better than being off.
      configure(values);

      render(<Rum />);
      await Promise.resolve();

      expect(rum.AwsRum).not.toHaveBeenCalled();
    });
  }
});

describe('<Rum/> — configured', () => {
  it('starts the client with the ids and region it was given', async () => {
    configure();

    render(<Rum />);

    await waitFor(() => expect(rum.AwsRum).toHaveBeenCalledTimes(1));
    const [applicationId, applicationVersion, region] = rum.AwsRum.mock.calls[0];
    expect(applicationId).toBe(APP_MONITOR_ID);
    expect(region).toBe(REGION);
    expect(applicationVersion).toEqual(expect.any(String));
  });

  it('uses the configuration the spec fixed', async () => {
    configure();

    render(<Rum />);

    await waitFor(() => expect(rum.AwsRum).toHaveBeenCalledTimes(1));
    const config = rum.AwsRum.mock.calls[0][3] as Record<string, unknown>;
    expect(config.identityPoolId).toBe(IDENTITY_POOL_ID);
    expect(config.allowCookies).toBe(true);
    expect(config.sessionSampleRate).toBe(1);
    expect(config.telemetries).toEqual(['performance', 'errors', 'http']);
    expect(config.endpoint).toBe(`https://dataplane.rum.${REGION}.amazonaws.com`);
  });

  it('still renders nothing', async () => {
    configure();

    const { container } = render(<Rum />);

    await waitFor(() => expect(rum.AwsRum).toHaveBeenCalledTimes(1));
    expect(container).toBeEmptyDOMElement();
  });

  it('starts the client once, not once per render', async () => {
    configure();

    const { rerender } = render(<Rum />);
    rerender(<Rum />);
    rerender(<Rum />);

    await waitFor(() => expect(rum.AwsRum).toHaveBeenCalledTimes(1));
  });

  it('survives a client that refuses to start', async () => {
    // An ad blocker or an offline first paint must not take the page down.
    rum.AwsRum.mockImplementation(() => {
      throw new Error('blocked');
    });
    configure();

    expect(() => render(<Rum />)).not.toThrow();
    await waitFor(() => expect(console.error).toHaveBeenCalled());
  });
});
