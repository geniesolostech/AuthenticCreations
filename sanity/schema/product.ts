import { defineField, defineType } from 'sanity';

// No price or stock fields here — Square owns money and inventory.
// Products carry squareVariationId/customSquareVariationId strings only.
export default defineType({
  name: 'product',
  title: 'Product',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title', maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'section',
      title: 'Section',
      type: 'string',
      options: {
        list: [
          { title: 'Hats', value: 'hats' },
          { title: 'Accessories', value: 'accessories' },
        ],
        layout: 'radio',
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
    }),
    defineField({
      name: 'photos',
      title: 'Photos',
      type: 'array',
      of: [{ type: 'image', options: { hotspot: true } }],
    }),
    defineField({
      name: 'squareVariationId',
      title: 'Square Variation ID',
      description: 'The ready-made item’s Square catalog variation id. Filled in during launch.',
      type: 'string',
    }),
    defineField({
      name: 'customSquareVariationId',
      title: 'Custom Square Variation ID',
      description: 'The matching "Custom — [product]" Square item’s variation id, if this product offers a custom order.',
      type: 'string',
    }),
    defineField({
      name: 'variants',
      title: 'Variants',
      description: 'Optional per-variant Square variation ids, e.g. crochet flowers (rose/tulip/lavender).',
      type: 'array',
      of: [
        {
          type: 'object',
          name: 'variant',
          fields: [
            defineField({
              name: 'label',
              title: 'Label',
              type: 'string',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'squareVariationId',
              title: 'Square Variation ID',
              type: 'string',
              validation: (Rule) => Rule.required(),
            }),
          ],
          preview: {
            select: { title: 'label', subtitle: 'squareVariationId' },
          },
        },
      ],
    }),
    defineField({
      name: 'displayOrder',
      title: 'Display Order',
      type: 'number',
      validation: (Rule) => Rule.integer(),
    }),
    defineField({
      name: 'featured',
      title: 'Featured',
      type: 'boolean',
      initialValue: false,
    }),
  ],
  preview: {
    select: { title: 'title', subtitle: 'section', media: 'photos.0' },
  },
});
