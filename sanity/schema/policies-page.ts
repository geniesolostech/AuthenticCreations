import { defineField, defineType } from 'sanity';

// Singleton — pinned in the Studio structure (sanity.config.ts), one document
// with a fixed _id ("policiesPage").
export default defineType({
  name: 'policiesPage',
  title: 'Policies Page',
  type: 'document',
  fields: [
    defineField({
      name: 'body',
      title: 'Body',
      type: 'array',
      of: [
        { type: 'block' },
        { type: 'image', options: { hotspot: true } },
      ],
    }),
  ],
  preview: {
    prepare: () => ({ title: 'Policies Page' }),
  },
});
