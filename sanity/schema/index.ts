import type { SchemaTypeDefinition } from 'sanity';

import aboutPage from './about-page';
import event from './event';
import policiesPage from './policies-page';
import post from './post';
import product from './product';
import rsvp from './rsvp';

export const schemaTypes: SchemaTypeDefinition[] = [
  product,
  post,
  event,
  rsvp,
  aboutPage,
  policiesPage,
];
