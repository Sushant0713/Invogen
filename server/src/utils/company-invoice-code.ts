import mongoose from 'mongoose';
import { Company } from '../models';

const MAX_CODE_LENGTH = 6;
const STOP_WORDS = new Set([
  'PVT',
  'LTD',
  'LIMITED',
  'PRIVATE',
  'INC',
  'LLC',
  'THE',
  'AND',
  'OF',
  'CO',
  'COMPANY',
  'CORP',
  'CORPORATION',
]);

export function deriveCompanyInvoiceCode(name: string): string {
  const words = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word && !STOP_WORDS.has(word));

  if (words.length === 0) {
    return 'CO';
  }

  if (words.length === 1) {
    const word = words[0];
    return word.length <= MAX_CODE_LENGTH ? word : word.slice(0, MAX_CODE_LENGTH);
  }

  const initials = words.map((word) => word[0]).join('');
  return initials.slice(0, MAX_CODE_LENGTH);
}

export async function ensureUniqueCompanyInvoiceCode(
  baseCode: string,
  excludeCompanyId?: mongoose.Types.ObjectId | string,
): Promise<string> {
  const normalizedBase = baseCode.replace(/[^A-Z0-9]/g, '').slice(0, MAX_CODE_LENGTH) || 'CO';

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = attempt === 0 ? '' : String(attempt);
    const candidate = `${normalizedBase.slice(0, MAX_CODE_LENGTH - suffix.length)}${suffix}`;

    const filter: Record<string, unknown> = { invoiceCode: candidate };
    if (excludeCompanyId) {
      filter._id = { $ne: excludeCompanyId };
    }

    const exists = await Company.exists(filter);
    if (!exists) {
      return candidate;
    }
  }

  throw new Error('Unable to generate a unique company invoice code');
}

type CompanyCodeCarrier = {
  _id: mongoose.Types.ObjectId;
  name: string;
  invoiceCode?: string;
  save?: () => Promise<unknown>;
};

export async function ensureCompanyInvoiceCode(company: CompanyCodeCarrier): Promise<string> {
  if (company.invoiceCode) {
    return company.invoiceCode;
  }

  const base = deriveCompanyInvoiceCode(company.name);
  const code = await ensureUniqueCompanyInvoiceCode(base, company._id);
  company.invoiceCode = code;

  if (typeof company.save === 'function') {
    await company.save();
  } else {
    await Company.updateOne({ _id: company._id }, { $set: { invoiceCode: code } });
  }

  return code;
}

export async function backfillMissingCompanyInvoiceCodes(): Promise<number> {
  const companies = await Company.find({
    $or: [{ invoiceCode: { $exists: false } }, { invoiceCode: null }, { invoiceCode: '' }],
  }).select('_id name invoiceCode');

  let updated = 0;
  for (const company of companies) {
    await ensureCompanyInvoiceCode(company);
    updated += 1;
  }

  return updated;
}
