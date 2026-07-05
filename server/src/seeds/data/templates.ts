import { v4 as uuidv4 } from 'uuid';
import type { TemplatePage } from '@invogen/shared';

/** Single empty page — no pre-placed elements. */
export const createBlankTemplate = (_category?: string): TemplatePage[] => [
  {
    id: uuidv4(),
    name: 'Page 1',
    margins: { top: 40, right: 40, bottom: 40, left: 40 },
    elements: [],
  },
];
