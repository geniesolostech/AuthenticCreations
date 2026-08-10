import PlaceholderImage from '@/components/placeholder-image';
import RichText from '@/components/portable-text';
import { urlFor } from '@/lib/sanity/image';
import { getAboutPage, type AboutPage as AboutPageDoc } from '@/lib/sanity/queries';

export const revalidate = 60;

const FALLBACK_HEADING = 'Meet CJ';

export default async function AboutPage() {
  // Guarded like every other Sanity read in the app (Tasks 6/7): a hiccup
  // degrades to a tasteful fallback instead of a crashed page.
  let about: AboutPageDoc | null = null;
  try {
    about = await getAboutPage();
  } catch (error) {
    console.error('[about] failed to fetch the about page from Sanity', error);
  }

  const heading = about?.heading || FALLBACK_HEADING;
  const photoUrl = about?.photo?.asset
    ? urlFor(about.photo).width(800).height(800).fit('crop').auto('format').url()
    : undefined;
  const hasBody = Boolean(about?.body && about.body.length > 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mx-auto mb-8 aspect-square w-full max-w-sm overflow-hidden rounded-full bg-linen">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- see components/product-card.tsx
          <img src={photoUrl} alt={heading} className="h-full w-full object-cover" />
        ) : (
          <PlaceholderImage title={heading} hideTitle />
        )}
      </div>

      <h1 className="text-center font-heading text-3xl text-charcoal sm:text-4xl">{heading}</h1>

      {hasBody ? (
        <div className="mt-8">
          <RichText value={about?.body} />
        </div>
      ) : (
        <p className="mt-8 font-body text-charcoal">
          Her story is still being written. Check back soon to learn more about CJ.
        </p>
      )}
    </div>
  );
}
