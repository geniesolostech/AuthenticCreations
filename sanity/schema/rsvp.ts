import { defineField, defineType } from 'sanity';

// RSVPs are created only by the server API route (POST /api/rsvp) using
// sanityWriteClient — never directly in Studio. `readOnly: true` locks every
// field in the editing form; sanity.config.ts additionally strips all
// create/edit/delete document actions for this type so CJ can only view.
export default defineType({
  name: 'rsvp',
  title: 'RSVP',
  type: 'document',
  readOnly: true,
  fields: [
    defineField({
      name: 'event',
      title: 'Event',
      type: 'reference',
      to: [{ type: 'event' }],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'email',
      title: 'Email',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'createdAt',
      title: 'Created At',
      type: 'datetime',
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: { title: 'name', subtitle: 'email' },
  },
});
