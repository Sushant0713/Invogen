import type { CanvasElement, TemplatePage } from './invoice';

/** Canonical object model for the document editor (maps to CanvasElement in the builder). */
export interface DocumentObject {
  id: string;
  type: string;
  page: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  zIndex: number;
  data: Record<string, unknown>;
}

export interface DocumentPage {
  id: string;
  name: string;
  margins: { top: number; right: number; bottom: number; left: number };
  pageSize?: { width: number; height: number };
  objects: DocumentObject[];
}

export interface DocumentProject {
  name?: string;
  category?: string;
  pages: DocumentPage[];
}

/** JSON save format — sufficient to recreate the entire document. */
export interface DocumentSaveFile {
  version: 1;
  name?: string;
  category?: string;
  pages: Array<{
    id: string;
    name: string;
    margins: DocumentPage['margins'];
    pageSize?: DocumentPage['pageSize'];
    objects: DocumentObject[];
  }>;
}

export interface TextObjectData {
  text: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  alignment?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
  letterSpacing?: number;
  listStyle?: string;
  textRuns?: Array<{
    text: string;
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    color?: string;
    highlight?: string;
    letterSpacing?: number;
    href?: string;
  }>;
}

export interface ImageObjectData {
  src: string;
  crop?: Record<string, unknown>;
  brightness?: number;
  contrast?: number;
  saturate?: number;
  shadow?: boolean;
  objectFit?: string;
  imageNaturalW?: number;
  imageNaturalH?: number;
}

export interface ShapeObjectData {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
  shadow?: boolean;
}

/** Flags set when a specific element could not be parsed and was rasterized alone. */
export const RASTER_FALLBACK_KEY = 'rasterFallback';

export type { CanvasElement, TemplatePage };
