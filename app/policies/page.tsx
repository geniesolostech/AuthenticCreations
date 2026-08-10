import RichText from '@/components/portable-text';
import { getPoliciesPage, type PoliciesPage as PoliciesPageDoc } from '@/lib/sanity/queries';

export const revalidate = 60;

// Spec-mandated, verbatim (Task 12's analytics cookie disclosure) — must
// render after the CMS body and always be present, even when the CMS has no
// policies content yet. Do not reword.
const ANALYTICS_COOKIE_DISCLOSURE =
  'We use a small analytics cookie to understand visits — nothing is sold or shared.';

export default async function PoliciesPage() {
  // Guarded like every other Sanity read in the app (Tasks 6/7): a hiccup
  // degrades to a tasteful fallback instead of a crashed page — and the
  // static disclosure below still renders regardless.
  let policies: PoliciesPageDoc | null = null;
  try {
    policies = await getPoliciesPage();
  } catch (error) {
    console.error('[policies] failed to fetch the policies page from Sanity', error);
  }

  const hasBody = Boolean(policies?.body && policies.body.length > 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-heading text-3xl text-charcoal sm:text-4xl">Shipping &amp; Returns</h1>

      {hasBody ? (
        <div className="mt-8">
          <RichText value={policies?.body} />
        </div>
      ) : (
        <p className="mt-8 font-body text-charcoal">
          Our shipping and returns details are being written up — check back soon.
        </p>
      )}

      <p className="mt-8 font-body text-sm text-khaki">{ANALYTICS_COOKIE_DISCLOSURE}</p>
    </div>
  );
}
