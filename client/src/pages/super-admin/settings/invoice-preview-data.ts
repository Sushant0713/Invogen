import type { InvoiceSettings } from './invoice-settings.types';

export const PREVIEW_LINE_ITEMS = [
  { description: 'Invogen Professional Plan Subscription (Monthly)', qty: 1, unitPrice: 3999, amount: 3999 },
  { description: 'Custom Invoice Template Setup', qty: 1, unitPrice: 2500, amount: 2500 },
  { description: 'Employee Access Configuration (Up to 10 Users)', qty: 1, unitPrice: 1500, amount: 1500 },
];

export const formatInr = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

export function computeInvoiceTotals(form: InvoiceSettings) {
  const subTotal = PREVIEW_LINE_ITEMS.reduce((sum, item) => sum + item.amount, 0);
  const discount = form.showDiscount ? (subTotal * form.defaultDiscount) / 100 : 0;
  const taxable = subTotal - discount;
  const cgst = (taxable * form.cgstRate) / 100;
  const sgst = (taxable * form.sgstRate) / 100;
  const taxTotal = cgst + sgst;
  const grandTotal = taxable + taxTotal;
  const roundedTotal = form.enableRounding ? Math.round(grandTotal) : grandTotal;

  return { subTotal, discount, taxable, cgst, sgst, taxTotal, grandTotal, roundedTotal };
}
