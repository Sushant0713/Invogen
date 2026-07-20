export const CUSTOM_INVOICE_NUMBER_FORMAT = '__custom__';

export const INVOICE_NUMBER_FORMAT_PRESETS = [
  {
    value: '{PREFIX}{NNN}/{YYYY}',
    label: 'Prefix + 3 digits / Year (INV001/2026)',
  },
  {
    value: '{PREFIX}-{YYYY}-{NNNNN}',
    label: 'Prefix - Year - 5 digits (INV-2026-00001)',
  },
  {
    value: '{PREFIX}/{YYYY}/{NNNN}',
    label: 'Prefix / Year / 4 digits (INV/2026/0001)',
  },
  {
    value: '{CODE}-{PREFIX}-{YYYY}-{NNNNN}',
    label: 'Company code - Prefix - Year - 5 digits',
  },
] as const;

export function invoiceNumberFormatSelectValue(format: string): string {
  return INVOICE_NUMBER_FORMAT_PRESETS.some((preset) => preset.value === format)
    ? format
    : CUSTOM_INVOICE_NUMBER_FORMAT;
}
