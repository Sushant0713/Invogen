import PDFDocument from 'pdfkit';

const PRIMARY = '#ff7700';
const TEXT = '#111827';
const MUTED = '#6b7280';
const BORDER = '#e5e7eb';

export interface SubscriptionInvoicePdfInput {
  invoiceNumber: string;
  invoiceTitle: string;
  issueDate: Date;
  seller: {
    name: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    gstin?: string;
    pan?: string;
    email?: string;
    phone?: string;
    website?: string;
  };
  buyer: {
    name: string;
    email?: string;
    phone?: string;
    gst?: string;
    pan?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      country?: string;
      zipCode?: string;
    };
  };
  planName: string;
  billingCycle: string;
  orderId?: string;
  currency: string;
  subtotal: number;
  discount: number;
  discountCode?: string;
  cgst: number;
  sgst: number;
  tax: number;
  total: number;
  terms?: string;
  thankYouNote?: string;
  subscriptionNote?: string;
}

const formatInr = (amount: number, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount);

const formatDate = (date: Date) =>
  date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

function sellerAddress(seller: SubscriptionInvoicePdfInput['seller']) {
  return [
    seller.addressLine1,
    seller.addressLine2,
    [seller.city, seller.state, seller.zipCode].filter(Boolean).join(', '),
    seller.country,
  ]
    .filter(Boolean)
    .join('\n');
}

function buyerAddress(buyer: SubscriptionInvoicePdfInput['buyer']) {
  const addr = buyer.address;
  if (!addr) return '';
  return [
    addr.street,
    [addr.city, addr.state, addr.zipCode].filter(Boolean).join(', '),
    addr.country,
  ]
    .filter(Boolean)
    .join('\n');
}

function writeBlock(
  doc: InstanceType<typeof PDFDocument>,
  title: string,
  lines: string[],
  x: number,
  y: number,
  width: number
) {
  doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED).text(title.toUpperCase(), x, y, { width });
  let cursor = y + 14;
  for (const line of lines.filter(Boolean)) {
    doc.font('Helvetica').fontSize(10).fillColor(TEXT).text(line, x, cursor, { width });
    cursor = doc.y + 2;
  }
  return cursor;
}

export function buildSubscriptionInvoicePdf(input: SubscriptionInvoicePdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const left = doc.page.margins.left;

    doc.font('Helvetica-Bold').fontSize(26).fillColor(PRIMARY).text(input.invoiceTitle, left, 48);
    doc.font('Helvetica').fontSize(10).fillColor(MUTED).text('Subscription billing', left, 78);

    const metaX = left + pageWidth - 180;
    doc.font('Helvetica-Bold').fontSize(10).fillColor(TEXT).text(`Invoice ${input.invoiceNumber}`, metaX, 48, {
      width: 180,
      align: 'right',
    });
    doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(`Date: ${formatDate(input.issueDate)}`, metaX, 64, {
      width: 180,
      align: 'right',
    });
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#15803d').text('PAID', metaX, 82, {
      width: 180,
      align: 'right',
    });

    const blockTop = 118;
    const colWidth = pageWidth / 2 - 12;

    const sellerLines = [
      input.seller.name,
      sellerAddress(input.seller),
      input.seller.gstin ? `GSTIN: ${input.seller.gstin}` : '',
      input.seller.pan ? `PAN: ${input.seller.pan}` : '',
      input.seller.email || '',
      input.seller.phone || '',
    ];

    const buyerLines = [
      input.buyer.name,
      buyerAddress(input.buyer),
      input.buyer.gst ? `GSTIN: ${input.buyer.gst}` : '',
      input.buyer.pan ? `PAN: ${input.buyer.pan}` : '',
      input.buyer.email || '',
      input.buyer.phone || '',
    ];

    const afterBlocks = Math.max(
      writeBlock(doc, 'From', sellerLines, left, blockTop, colWidth),
      writeBlock(doc, 'Bill to', buyerLines, left + colWidth + 24, blockTop, colWidth)
    );

    let tableTop = afterBlocks + 20;
    const tableHeaders = ['Description', 'Qty', 'Amount'];
    const colWidths = [pageWidth - 140, 50, 90];
    const colXs = [left, left + colWidths[0], left + colWidths[0] + colWidths[1]];

    doc.rect(left, tableTop, pageWidth, 24).fill('#f9fafb');
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9);
    tableHeaders.forEach((header, index) => {
      const align = index === 0 ? 'left' : 'right';
      const x = index === 0 ? colXs[index] + 10 : colXs[index] + (index === 1 ? 0 : colWidths[index] - 10);
      doc.text(header.toUpperCase(), x, tableTop + 8, {
        width: colWidths[index] - 10,
        align,
      });
    });

    tableTop += 24;
    const rowHeight = 52;
    doc.rect(left, tableTop, pageWidth, rowHeight).strokeColor(BORDER).lineWidth(1).stroke();

    const description = `${input.planName}\n${input.billingCycle} subscription${
      input.orderId ? ` · Order ${input.orderId}` : ''
    }`;

    doc.fillColor(TEXT).font('Helvetica').fontSize(10);
    doc.text(description, colXs[0] + 10, tableTop + 10, { width: colWidths[0] - 16 });
    doc.text('1', colXs[1], tableTop + 10, { width: colWidths[1] - 4, align: 'right' });
    doc.text(formatInr(input.subtotal, input.currency), colXs[2], tableTop + 10, {
      width: colWidths[2] - 10,
      align: 'right',
    });

    let totalsY = tableTop + rowHeight + 18;
    const totalsX = left + pageWidth - 220;
    const totalsWidth = 220;

    const totalRow = (label: string, value: string, bold = false) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor(bold ? TEXT : MUTED);
      doc.text(label, totalsX, totalsY, { width: 110 });
      doc.fillColor(TEXT).text(value, totalsX + 110, totalsY, { width: 110, align: 'right' });
      totalsY += 18;
    };

    totalRow('Subtotal', formatInr(input.subtotal, input.currency));
    if (input.discount > 0) {
      totalRow(
        `Discount${input.discountCode ? ` (${input.discountCode})` : ''}`,
        `-${formatInr(input.discount, input.currency)}`
      );
    }
    if (input.cgst > 0) totalRow('CGST', formatInr(input.cgst, input.currency));
    if (input.sgst > 0) totalRow('SGST', formatInr(input.sgst, input.currency));
    if (input.tax > 0 && input.cgst === 0 && input.sgst === 0) {
      totalRow('Tax', formatInr(input.tax, input.currency));
    }
    totalRow('Total paid', formatInr(input.total, input.currency), true);

    totalsY += 8;
    doc.moveTo(totalsX, totalsY).lineTo(totalsX + totalsWidth, totalsY).strokeColor(BORDER).stroke();
    totalsY += 16;

    if (input.subscriptionNote) {
      doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(input.subscriptionNote, left, totalsY, {
        width: pageWidth,
      });
      totalsY = doc.y + 10;
    }

    if (input.thankYouNote) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(PRIMARY).text(input.thankYouNote, left, totalsY, {
        width: pageWidth,
      });
      totalsY = doc.y + 12;
    }

    if (input.terms) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(TEXT).text('Terms & conditions', left, totalsY);
      totalsY = doc.y + 4;
      doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(input.terms, left, totalsY, {
        width: pageWidth,
        lineGap: 2,
      });
    }

    doc.end();
  });
}
