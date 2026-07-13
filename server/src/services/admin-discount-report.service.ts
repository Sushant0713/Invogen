import mongoose from 'mongoose';
import type { TemplatePage } from '@invogen/shared';
import { Customer, Invoice, Product } from '../models';
import { getPagination, buildMeta } from '../utils/response';
import {
  getInvoiceCustomerName,
  resolveInvoiceTotals,
} from '../utils/invoice-gst';
import { extractInvoiceProductLines } from '../utils/invoice-products';
import { buildSalesInvoiceMatch, parseReportDate } from '../utils/sales-report';
import {
  mapRevenueAggregation,
  resolveRevenueGroupBy,
  type RevenueGroupBy,
} from '../utils/revenue-aggregation';

type InvoiceDoc = {
  _id: mongoose.Types.ObjectId;
  invoiceNumber: string;
  status: string;
  createdAt: Date;
  issueDate?: Date;
  customerId?: mongoose.Types.ObjectId | null;
  customerSnapshot?: Record<string, unknown>;
  totals?: {
    subtotal?: number;
    discount?: number;
    tax?: number;
    total?: number;
  };
  templateSnapshot?: TemplatePage[];
  lineItems?: { productId?: mongoose.Types.ObjectId; name?: string }[];
};

type ResolvedInvoiceRow = {
  _id: string;
  invoiceNumber: string;
  status: string;
  customerId: string | null;
  customerName: string;
  discountAmount: number;
  subtotal: number;
  invoiceTotal: number;
  createdAt: Date;
};

function resolveDiscountRows(invoices: InvoiceDoc[]): ResolvedInvoiceRow[] {
  return invoices
    .map((invoice) => {
      const totals = resolveInvoiceTotals(invoice);
      if ((totals.discount ?? 0) <= 0) return null;

      return {
        _id: invoice._id.toString(),
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        customerId: invoice.customerId ? invoice.customerId.toString() : null,
        customerName: getInvoiceCustomerName(invoice),
        discountAmount: totals.discount ?? 0,
        subtotal: totals.subtotal ?? 0,
        invoiceTotal: totals.total ?? 0,
        createdAt: invoice.createdAt,
      } satisfies ResolvedInvoiceRow;
    })
    .filter((row): row is ResolvedInvoiceRow => row !== null);
}

function periodKey(date: Date, groupBy: RevenueGroupBy): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return groupBy === 'month' ? `${year}-${month}` : `${year}-${month}-${day}`;
}

function invoiceMatchesProduct(
  invoice: InvoiceDoc,
  productId: string,
  productName: string
): boolean {
  if (
    invoice.lineItems?.some((item) => item.productId && String(item.productId) === productId)
  ) {
    return true;
  }

  const normalizedName = productName.trim().toLowerCase();
  const lines = extractInvoiceProductLines({
    templateSnapshot: invoice.templateSnapshot,
    lineItems: invoice.lineItems as Parameters<typeof extractInvoiceProductLines>[0]['lineItems'],
  });
  return lines.some((line) => {
    if (line.productId === productId) return true;
    return line.name.trim().toLowerCase() === normalizedName;
  });
}

export const adminDiscountReportService = {
  async getFilters(companyId: string) {
    const companyObjectId = new mongoose.Types.ObjectId(companyId);
    const [customers, products] = await Promise.all([
      Customer.find({ companyId: companyObjectId }).select('name').sort({ name: 1 }).lean(),
      Product.find({ companyId: companyObjectId })
        .select('name sku')
        .collation({ locale: 'en', numericOrdering: true })
        .sort({ name: 1 })
        .lean(),
    ]);

    return {
      customers: customers.map((c) => ({ _id: c._id.toString(), name: c.name })),
      products: products.map((p) => ({
        _id: p._id.toString(),
        name: p.name,
        sku: p.sku || null,
      })),
    };
  },

  async getReport(companyId: string, query: Record<string, unknown>) {
    const from =
      query.from && typeof query.from === 'string'
        ? parseReportDate(query.from)
        : new Date(0);
    const to =
      query.to && typeof query.to === 'string'
        ? parseReportDate(query.to, true)
        : new Date();

    const status =
      typeof query.status === 'string' && query.status.trim() && query.status !== 'all'
        ? query.status.trim()
        : 'all';

    const match = buildSalesInvoiceMatch(companyId, from, to, { status });
    const productId =
      typeof query.productId === 'string' && query.productId.trim()
        ? query.productId.trim()
        : null;
    const customerId =
      typeof query.customerId === 'string' && query.customerId.trim()
        ? query.customerId.trim()
        : null;

    if (customerId) {
      match.customerId = new mongoose.Types.ObjectId(customerId);
    }

    const groupBy = resolveRevenueGroupBy(
      query.groupBy,
      query.from as string,
      query.to as string
    );

    let productName: string | null = null;
    if (productId) {
      const product = await Product.findOne({
        _id: new mongoose.Types.ObjectId(productId),
        companyId: new mongoose.Types.ObjectId(companyId),
      })
        .select('name')
        .lean();
      productName = product?.name ?? null;
    }

    const invoices = (await Invoice.find(match)
      .select(
        'invoiceNumber status createdAt issueDate customerId customerSnapshot totals templateSnapshot lineItems'
      )
      .lean()) as unknown as InvoiceDoc[];

    let rows = resolveDiscountRows(invoices);

    if (productId && productName) {
      rows = rows.filter((row) => {
        const invoice = invoices.find((inv) => inv._id.toString() === row._id);
        return invoice ? invoiceMatchesProduct(invoice, productId, productName!) : false;
      });
    }

    const totalDiscount = rows.reduce((sum, row) => sum + row.discountAmount, 0);
    const invoiceCount = rows.length;
    const totalSubtotal = rows.reduce((sum, row) => sum + row.subtotal, 0);
    const totalInvoiceValue = rows.reduce((sum, row) => sum + row.invoiceTotal, 0);

    const seriesMap = new Map<string, { total: number; count: number }>();
    for (const row of rows) {
      const key = periodKey(row.createdAt, groupBy);
      const current = seriesMap.get(key) ?? { total: 0, count: 0 };
      current.total += row.discountAmount;
      current.count += 1;
      seriesMap.set(key, current);
    }

    const series = mapRevenueAggregation(
      [...seriesMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, value]) => ({ _id: period, total: value.total, count: value.count }))
    );

    const { page, limit, skip } = getPagination(query.page as number, query.limit as number);
    const sortedLedger = [...rows].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
    const ledger = sortedLedger.slice(skip, skip + limit);

    return {
      series,
      groupBy,
      totalDiscount,
      invoiceCount,
      averageDiscount: invoiceCount > 0 ? Math.round(totalDiscount / invoiceCount) : 0,
      totalSubtotal,
      totalInvoiceValue,
      from: (query.from as string) || null,
      to: (query.to as string) || null,
      ledger,
      ledgerMeta: buildMeta(page, limit, sortedLedger.length),
    };
  },
};
