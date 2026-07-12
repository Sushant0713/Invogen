import type { ICompany } from '../models/Company.model';
import { ensureCompanyInvoiceCode } from './company-invoice-code';

export const DEFAULT_COMPANY_INVOICE_NUMBER_FORMAT = '{CODE}-{PREFIX}-{YYYY}-{NNNNN}';

export function formatCompanyInvoiceNumber(
  company: Pick<ICompany, 'invoiceCode' | 'invoiceSettings'>,
  sequence: number,
  issueDate: Date = new Date(),
): string {
  const format = company.invoiceSettings.numberFormat || DEFAULT_COMPANY_INVOICE_NUMBER_FORMAT;
  const paddedFive = String(sequence).padStart(5, '0');
  const year = issueDate.getFullYear();

  return format
    .replace(/\{CODE\}/g, company.invoiceCode || 'CO')
    .replace(/\{PREFIX\}/g, company.invoiceSettings.prefix || 'INV')
    .replace(/\{YYYY\}/g, String(year))
    .replace(/\{NNNNN\}/g, paddedFive)
    .replace(/\{NNNN\}/g, paddedFive.slice(-4));
}

type InvoiceNumberCompany = ICompany & {
  _id: import('mongoose').Types.ObjectId;
  save: () => Promise<unknown>;
};

export async function assignNextCompanyInvoiceNumber(
  company: InvoiceNumberCompany,
  issueDate: Date = new Date(),
): Promise<string> {
  await ensureCompanyInvoiceCode(company);

  const sequence = company.invoiceSettings.nextNumber;
  company.invoiceSettings.nextNumber = sequence + 1;
  await company.save();

  return formatCompanyInvoiceNumber(company, sequence, issueDate);
}
