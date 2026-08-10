import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import PoliciesPage from '@/app/policies/page';
import { getPoliciesPage } from '@/lib/sanity/queries';
import type { PoliciesPage as PoliciesPageData } from '@/lib/sanity/queries';

vi.mock('@/lib/sanity/queries', () => ({
  getPoliciesPage: vi.fn(),
}));

const mockedGetPoliciesPage = vi.mocked(getPoliciesPage);

// Spec-mandated, exact wording — Task 12's analytics cookie disclosure.
const COOKIE_SENTENCE =
  'We use a small analytics cookie to understand visits — nothing is sold or shared.';

describe('/policies', () => {
  beforeEach(() => {
    mockedGetPoliciesPage.mockReset();
  });

  test('renders the CMS body plus the static analytics-cookie sentence after it', async () => {
    const policies: PoliciesPageData = {
      body: [
        {
          _type: 'block',
          _key: 'b1',
          style: 'normal',
          children: [{ _type: 'span', _key: 'b1s', text: 'We ship within 5 business days.', marks: [] }],
        },
      ],
    };
    mockedGetPoliciesPage.mockResolvedValue(policies);

    render(await PoliciesPage());

    expect(screen.getByText('We ship within 5 business days.')).toBeInTheDocument();
    expect(screen.getByText(COOKIE_SENTENCE)).toBeInTheDocument();
  });

  test('always renders the analytics-cookie sentence even when the CMS has no content yet', async () => {
    mockedGetPoliciesPage.mockResolvedValue(null);

    render(await PoliciesPage());

    expect(screen.getByText(COOKIE_SENTENCE)).toBeInTheDocument();
  });

  test('always renders the analytics-cookie sentence even when Sanity throws', async () => {
    mockedGetPoliciesPage.mockRejectedValue(new Error('network down'));

    render(await PoliciesPage());

    expect(screen.getByText(COOKIE_SENTENCE)).toBeInTheDocument();
  });
});
