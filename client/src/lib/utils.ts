import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount);
}

export function formatCompactCurrency(amount: number, currency = 'INR') {
  const symbol = currency === 'INR' ? '₹' : `${currency} `;
  const abs = Math.abs(amount);

  if (abs >= 10_000_000) return `${symbol}${(amount / 10_000_000).toFixed(1)}Cr`;
  if (abs >= 100_000) return `${symbol}${(amount / 100_000).toFixed(1)}L`;
  if (abs >= 1_000) return `${symbol}${(amount / 1_000).toFixed(1)}K`;
  return formatCurrency(amount, currency);
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}
