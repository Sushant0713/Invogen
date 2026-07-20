const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
] as const;

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'] as const;

function belowThousand(value: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  if (hundreds) parts.push(ONES[hundreds], 'Hundred');
  if (remainder < 20) {
    if (remainder) parts.push(ONES[remainder]);
  } else {
    parts.push(TENS[Math.floor(remainder / 10)]);
    if (remainder % 10) parts.push(ONES[remainder % 10]);
  }
  return parts.join(' ');
}

/** Indian numbering format: crore, lakh, thousand, hundred. */
export function amountInWords(value: number): string {
  if (!Number.isFinite(value)) return '';
  const absolute = Math.abs(value);
  let whole = Math.floor(absolute);
  const paise = Math.round((absolute - whole) * 100);
  if (paise === 100) whole += 1;

  const parts: string[] = [];
  const groups = [
    { size: 10_000_000, label: 'Crore' },
    { size: 100_000, label: 'Lakh' },
    { size: 1_000, label: 'Thousand' },
  ] as const;

  for (const group of groups) {
    const count = Math.floor(whole / group.size);
    if (count) {
      parts.push(belowThousand(count), group.label);
      whole %= group.size;
    }
  }
  if (whole) parts.push(belowThousand(whole));
  if (parts.length === 0) parts.push('Zero');

  const sign = value < 0 ? 'Minus ' : '';
  const paiseText = paise > 0 && paise < 100 ? ` and ${belowThousand(paise)} Paise` : '';
  return `${sign}${parts.join(' ')} Rupees${paiseText} Only`;
}

export function parseFormattedAmount(value: string): number {
  const parsed = Number(value.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}
