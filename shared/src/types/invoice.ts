export enum InvoiceType {
  TAX = 'tax',
  PROFORMA = 'proforma',
  QUOTATION = 'quotation',
  ESTIMATE = 'estimate',
  PURCHASE_ORDER = 'purchase_order',
  DELIVERY_CHALLAN = 'delivery_challan',
  CREDIT_NOTE = 'credit_note',
  DEBIT_NOTE = 'debit_note',
  RECURRING = 'recurring',
}

export enum InvoiceStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}

export interface CanvasElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  props: Record<string, unknown>;
  locked?: boolean;
  visible?: boolean;
  /** When true, element stays at its authored position and does not participate in document flow. */
  pinned?: boolean;
}

export interface TemplatePage {
  id: string;
  name: string;
  elements: CanvasElement[];
  margins: { top: number; right: number; bottom: number; left: number };
  /** Imported / custom canvas size (defaults to A4 when omitted). */
  pageSize?: { width: number; height: number };
  /** True when the user explicitly added this page tab (not auto table overflow). */
  userAuthored?: boolean;
}

export interface LineItem {
  productId?: string;
  name: string;
  description?: string;
  hsn?: string;
  quantity: number;
  unit: string;
  price: number;
  discount: number;
  tax: number;
  total: number;
}
