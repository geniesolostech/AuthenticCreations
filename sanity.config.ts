import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import type { StructureResolver } from 'sanity/structure';

import { schemaTypes } from './sanity/schema';

// NEXT_PUBLIC_SANITY_PROJECT_ID is empty until `npx sanity init` is run (see
// docs/launch-runbook.md). 'placeholder' is a syntactically valid project id
// so the Studio config — and `next build` — never throws before that.
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'placeholder';
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production';

const SINGLETON_TYPES = new Set(['aboutPage', 'policiesPage']);
// One fixed document id per singleton type, matching the seed script's ids.
const SINGLETON_ID: Record<string, string> = {
  aboutPage: 'aboutPage',
  policiesPage: 'policiesPage',
};

const structure: StructureResolver = (S) =>
  S.list()
    .title('Content')
    .items([
      S.listItem()
        .title('Products')
        .child(S.documentTypeList('product').title('Products')),
      S.listItem()
        .title('Blog Posts')
        .child(S.documentTypeList('post').title('Blog Posts')),
      S.divider(),
      S.listItem()
        .title('About Page')
        .id('aboutPage')
        .child(
          S.document()
            .schemaType('aboutPage')
            .documentId(SINGLETON_ID.aboutPage)
        ),
      S.listItem()
        .title('Policies Page')
        .id('policiesPage')
        .child(
          S.document()
            .schemaType('policiesPage')
            .documentId(SINGLETON_ID.policiesPage)
        ),
      S.divider(),
      S.listItem()
        .title('Community')
        .child(
          S.list()
            .title('Community')
            .items([
              S.listItem()
                .title('Events')
                .child(S.documentTypeList('event').title('Events')),
              S.listItem()
                .title('RSVPs')
                .child(S.documentTypeList('rsvp').title('RSVPs')),
            ])
        ),
    ]);

export default defineConfig({
  name: 'default',
  title: 'Authentic Creations',
  projectId,
  dataset,
  basePath: '/studio',
  plugins: [structureTool({ structure })],
  schema: {
    types: schemaTypes,
    // Singletons are only reachable via the pinned structure items above —
    // remove them from the generic "create new document" template list.
    templates: (templates) =>
      templates.filter(({ schemaType }) => !SINGLETON_TYPES.has(schemaType)),
  },
  document: {
    // Hide singletons from the global "+ new document" search/creation menu.
    newDocumentOptions: (prev, { creationContext }) => {
      if (creationContext.type === 'global') {
        return prev.filter((option) => !SINGLETON_TYPES.has(option.templateId));
      }
      return prev;
    },
    // rsvp: CJ views only, never edits — created solely by POST /api/rsvp
    // via sanityWriteClient. Strip every action (publish/edit/delete/...).
    // Singletons: keep edit/publish, drop duplicate/delete so there's always
    // exactly one of each.
    actions: (prev, { schemaType }) => {
      if (schemaType === 'rsvp') {
        return [];
      }
      if (SINGLETON_TYPES.has(schemaType)) {
        return prev.filter(
          ({ action }) => action !== 'duplicate' && action !== 'delete'
        );
      }
      return prev;
    },
  },
});
