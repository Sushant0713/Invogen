import { pdf } from '@react-pdf/renderer';
import { formatInvoiceNumber, type InvoiceSettings } from './invoice-settings.types';
import { type CompanyBranding, resolveBrandingForPdf } from './company-branding';
import { ModernInvoicePdfDocument } from './ModernInvoicePdf';

export async function downloadInvoicePdf(form: InvoiceSettings, branding: CompanyBranding) {
  const resolvedBranding = await resolveBrandingForPdf(branding);
  const blob = await pdf(<ModernInvoicePdfDocument form={form} branding={resolvedBranding} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${formatInvoiceNumber(form)}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
