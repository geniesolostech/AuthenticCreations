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
      description:
        'The ready-made item’s Square catalog variation id. Filled in during launch. Leave this empty on a product sold as variants — each variant carries its own id.',
      type: 'string',
      // Enforced, not just documented. The grid tile prices a product from this
      // field and falls back to the first variant only when it is empty, while
      // the detail page always prices from the variants — so filling in both
      // lets the tile and the buy button quote different prices for the same
      // hat. The runbook and the catalog checklist both say so in prose; this
      // is the copy that cannot be skim-read past.
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const variants = context.document?.variants;
          if (!Array.isArray(variants) || variants.length === 0) return true;
          if (typeof value !== 'string' || value.trim() === '') return true;
          return 'This product uses variants — leave this field empty; each variant carries its own Square ID.';
        }),
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
              // A warning, not an error, and the difference is whether CJ can
              // press Publish. Studio blocks publishing while any error stands,
              // so at error level a product whose variants exist but whose
              // Square ids have not been pasted in yet — exactly what the seed
              // creates, and exactly the state the launch runbook walks through
              // — could not be published at all. The site already handles a
              // variant with no id (no price, disabled buy button), so the
              // honest level for "not filled in yet" is a nudge.
              validation: (Rule) =>
                Rule.required().warning(
                  'Paste this variant’s Square variation ID before launch — until you do, this variant shows “Price at checkout” and cannot be bought.',
                ),
            }),
            defineField({
              name: 'customSquareVariationId',
              title: 'Custom Square Variation ID',
              description:
                'The matching "Custom — [product]" Square item’s variation id for this variant, if this variant can be ordered custom.',
              // No validation at all, not even a warning: an empty one is a
              // real catalog state, not an oversight. The custom page offers
              // only the variants that have an id, so a variant CJ has not
              // built a custom SKU for yet is simply absent from the picker
              // rather than shown as an unbuyable choice.
              type: 'string',
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
