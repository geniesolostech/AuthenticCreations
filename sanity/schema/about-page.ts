import { defineField, defineType } from 'sanity';

// Singleton — pinned in the Studio structure (sanity.config.ts), one document
// with a fixed _id ("aboutPage").
export default defineType({
  name: 'aboutPage',
  title: 'About Page',
  type: 'document',
  fields: [
    defineField({
      name: 'heading',
      title: 'Heading',
      type: 'string',
    }),
    defineField({
      name: 'photo',
      title: 'Photo',
      type: 'image',
      options: { hotspot: true },
    }),
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
    select: { title: 'heading', media: 'photo' },
    prepare: ({ title, media }) => ({ title: title || 'About Page', media }),
  },
});
