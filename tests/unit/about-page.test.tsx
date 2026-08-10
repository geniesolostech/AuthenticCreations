import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import AboutPage from '@/app/about/page';
import { getAboutPage } from '@/lib/sanity/queries';
import type { AboutPage as AboutPageData } from '@/lib/sanity/queries';

vi.mock('@/lib/sanity/queries', () => ({
  getAboutPage: vi.fn(),
}));

const mockedGetAboutPage = vi.mocked(getAboutPage);

describe('/about', () => {
  beforeEach(() => {
    mockedGetAboutPage.mockReset();
  });

  test('renders the CMS heading, photo, and body', async () => {
    const about: AboutPageData = {
      heading: 'Meet CJ',
      photo: { asset: { _ref: 'image-abc123def456-800x800-jpg', _type: 'reference' } },
      body: [
        {
          _type: 'block',
          _key: 'b1',
          style: 'normal',
          children: [
            { _type: 'span', _key: 'b1s', text: 'Artist, musician, therapist, and maker.', marks: [] },
          ],
        },
      ],
    };
    mockedGetAboutPage.mockResolvedValue(about);

    render(await AboutPage());

    expect(screen.getByRole('heading', { level: 1, name: 'Meet CJ' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Meet CJ' })).toBeInTheDocument();
    expect(screen.getByText('Artist, musician, therapist, and maker.')).toBeInTheDocument();
  });

  test('shows a tasteful fallback instead of crashing when there is no CMS content yet', async () => {
    mockedGetAboutPage.mockResolvedValue(null);

    render(await AboutPage());

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/check back soon/i)).toBeInTheDocument();
  });

  test('shows a tasteful fallback instead of crashing when Sanity throws', async () => {
    mockedGetAboutPage.mockRejectedValue(new Error('network down'));

    render(await AboutPage());

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/check back soon/i)).toBeInTheDocument();
  });
});
