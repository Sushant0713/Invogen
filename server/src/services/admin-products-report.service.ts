import { InvoiceStatus } from '@invogen/shared';
import { Product, Invoice } from '../models';
import type { LineItem, TemplatePage } from '@invogen/shared';
import { getPagination, buildMeta } from '../utils/response';
import {
  buildSalesInvoiceMatch,
  getPreviousPeriod,
  percentChange,
  resolveReportDateRange,
  toCompanyObjectId,
} from '../utils/sales-report';
import {
  getRevenueGroupFormat,
  resolveRevenueGroupBy,
} from '../utils/revenue-aggregation';
import { extractInvoiceProductLines } from '../utils/invoice-products';

type InvoiceDoc = {
  createdAt: Date;
  templateSnapshot?: TemplatePage[];
  lineItems?: LineItem[];
};

function extractLines(invoice: InvoiceDoc) {
  return extractInvoiceProductLines({
    templateSnapshot: invoice.templateSnapshot,
    lineItems: invoice.lineItems,
  });
}

type ProductLedgerRow = {
  productKey: string;
  productId: string | null;
  name: string;
  category?: string;
  unitsSold: number;
  totalRevenue: number;
  sharePercent: number;
  growthPercent: number | null;
};

function periodKey(date: Date, format: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  if (format === '%Y-%m') return `${year}-${month}`;
  return `${year}-${month}-${day}`;
}

function normalizeSearchName(name: string): string {
  return name.replace(/\s*\([^)]+\)\s*$/, '').trim().toLowerCase();
}

function aggregateProductSales(invoices: InvoiceDoc[]) {
  const byProduct = new Map<
    string,
    { productKey: string; productId: string | null; name: string; unitsSold: number; totalRevenue: number }
  >();

  for (const invoice of invoices) {
    const lines = extractLines(invoice);

    for (const line of lines) {
      const existing =
        byProduct.get(line.productKey)
        ?? {
          productKey: line.productKey,
          productId: line.productId,
          name: line.name,
          unitsSold: 0,
          totalRevenue: 0,
        };
      existing.unitsSold += line.quantity;
      existing.totalRevenue += line.revenue;
      if (!existing.productId && line.productId) {
        existing.productId = line.productId;
      }
      byProduct.set(line.productKey, existing);
    }
  }

  return byProduct;
}

function buildUnitsTrend(invoices: InvoiceDoc[], groupFormat: string) {
  const totals = new Map<string, number>();

  for (const invoice of invoices) {
    const lines = extractLines(invoice);
    const units = lines.reduce((sum, line) => sum + line.quantity, 0);
    if (units <= 0) continue;
    const key = periodKey(new Date(invoice.createdAt), groupFormat);
    totals.set(key, (totals.get(key) ?? 0) + units);
  }

  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, unitsSold]) => ({ period, unitsSold }));
}

function buildRevenueDistribution(rows: ProductLedgerRow[]) {
  const ranked = [...rows]
    .filter((row) => row.totalRevenue > 0)
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  const total = ranked.reduce((sum, row) => sum + row.totalRevenue, 0);
  const palette = ['#f97316', '#8b5cf6', '#3b82f6', '#d1d5db'];
  const topItems = ranked.slice(0, 4);
  const othersRevenue = Math.max(
    0,
    total - topItems.reduce((sum, row) => sum + row.totalRevenue, 0)
  );

  const segments = topItems.map((row, index) => ({
    key: row.productKey,
    name: row.name,
    revenue: row.totalRevenue,
    color: palette[index] ?? '#d1d5db',
  }));

  if (othersRevenue > 0) {
    segments.push({
      key: 'others',
      name: 'Others',
      revenue: othersRevenue,
      color: '#e5e7eb',
    });
  }

  const top = ranked[0];
  return {
    segments,
    total,
    topProductName: top?.name ?? '—',
    topProductPercent: top && total > 0 ? (top.totalRevenue / total) * 100 : 0,
  };
}

function sortLedger(rows: ProductLedgerRow[], sort: string) {
  const sorted = [...rows];
  switch (sort) {
    case 'units':
      sorted.sort((a, b) => b.unitsSold - a.unitsSold);
      break;
    case 'share':
      sorted.sort((a, b) => b.sharePercent - a.sharePercent);
      break;
    case 'growth':
      sorted.sort((a, b) => (b.growthPercent ?? -Infinity) - (a.growthPercent ?? -Infinity));
      break;
    case 'name':
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'revenue':
    default:
      sorted.sort((a, b) => b.totalRevenue - a.totalRevenue);
      break;
  }
  return sorted;
}

function buildPaidProductsInvoiceMatch(
  companyId: string,
  from: Date,
  to: Date,
  query: Record<string, unknown>
) {
  return buildSalesInvoiceMatch(companyId, from, to, {
    ...query,
    status: InvoiceStatus.PAID,
    state: 'all',
  });
}

export const adminProductsReportService = {
  async getProductsReport(companyId: string, query: Record<string, unknown>) {
    const { from, to } = resolveReportDateRange(query);
    const { prevFrom, prevTo } = getPreviousPeriod(from, to);
    const groupBy = resolveRevenueGroupBy(query.groupBy, String(query.from || ''), String(query.to || ''));
    const groupFormat = getRevenueGroupFormat(groupBy);
    const companyObjectId = toCompanyObjectId(companyId);

    const periodMatch = buildPaidProductsInvoiceMatch(companyId, from, to, query);
    const prevMatch = buildPaidProductsInvoiceMatch(companyId, prevFrom, prevTo, query);
    const invoiceProjection = 'createdAt templateSnapshot lineItems';

    const [catalogProducts, periodInvoices, previousInvoices] = await Promise.all([
      Product.find({ companyId: companyObjectId, isActive: { $ne: false } })
        .select('name category price sku')
        .sort({ name: 1 })
        .lean(),
      Invoice.find(periodMatch).select(invoiceProjection).lean<InvoiceDoc[]>(),
      Invoice.find(prevMatch).select(invoiceProjection).lean<InvoiceDoc[]>(),
    ]);

    const catalogByName = new Map(
      catalogProducts.map((product) => [normalizeSearchName(product.name), product])
    );
    const catalogById = new Map(catalogProducts.map((product) => [String(product._id), product]));

    const currentSales = aggregateProductSales(periodInvoices);
    const previousSales = aggregateProductSales(previousInvoices);

    const enrichRow = (
      row: {
        productKey: string;
        productId: string | null;
        name: string;
        unitsSold: number;
        totalRevenue: number;
      },
      totalRevenue: number,
      previous?: { unitsSold: number; totalRevenue: number }
    ): ProductLedgerRow => {
      const catalog =
        (row.productId ? catalogById.get(row.productId) : undefined)
        ?? catalogByName.get(normalizeSearchName(row.name));
      return {
        productKey: row.productKey,
        productId: catalog ? String(catalog._id) : row.productId,
        name: catalog?.name ?? row.name,
        category: catalog?.category,
        unitsSold: row.unitsSold,
        totalRevenue: row.totalRevenue,
        sharePercent: totalRevenue > 0 ? (row.totalRevenue / totalRevenue) * 100 : 0,
        growthPercent: percentChange(row.totalRevenue, previous?.totalRevenue ?? 0),
      };
    };

    const totalRevenue = [...currentSales.values()].reduce((sum, row) => sum + row.totalRevenue, 0);
    const totalUnits = [...currentSales.values()].reduce((sum, row) => sum + row.unitsSold, 0);
    const previousRevenue = [...previousSales.values()].reduce((sum, row) => sum + row.totalRevenue, 0);
    const previousUnits = [...previousSales.values()].reduce((sum, row) => sum + row.unitsSold, 0);

    let ledger: ProductLedgerRow[] = [...currentSales.values()].map((row) =>
      enrichRow(row, totalRevenue, previousSales.get(row.productKey))
    );

    const rankedByUnits = [...ledger].sort((a, b) => b.unitsSold - a.unitsSold);
    const rankedByRevenue = [...ledger].sort((a, b) => b.totalRevenue - a.totalRevenue);
    const mostPopular = rankedByUnits[0];
    const highestGrossing = rankedByRevenue[0];
    const avgRevenuePerProduct = ledger.length > 0 ? totalRevenue / ledger.length : 0;

    const search = String(query.search || '').trim().toLowerCase();
    if (search) {
      ledger = ledger.filter(
        (row) =>
          row.name.toLowerCase().includes(search)
          || (row.category ?? '').toLowerCase().includes(search)
          || row.productKey.toLowerCase().includes(search)
          || (row.productId ?? '').toLowerCase().includes(search)
      );
    }

    const distribution = buildRevenueDistribution(ledger);
    const volume = [...ledger]
      .sort((a, b) => b.unitsSold - a.unitsSold)
      .slice(0, 6)
      .map((row) => ({ name: row.name, unitsSold: row.unitsSold }));

    const sort = String(query.sort || 'revenue');
    ledger = sortLedger(ledger, sort);

    const { page, limit, skip } = getPagination(query.page as number, query.limit as number);
    const totalLedger = ledger.length;
    const pagedLedger = ledger.slice(skip, skip + limit);

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      groupBy,
      summary: {
        totalRevenue,
        totalRevenueChange: percentChange(totalRevenue, previousRevenue),
        totalUnitsSold: totalUnits,
        totalUnitsSoldChange: percentChange(totalUnits, previousUnits),
        mostPopularPlan: mostPopular?.name ?? '—',
        mostPopularUnits: mostPopular?.unitsSold ?? 0,
        highestGrossingPlan: highestGrossing?.name ?? '—',
        highestGrossingRevenue: highestGrossing?.totalRevenue ?? 0,
        avgRevenuePerProduct,
      },
      trend: buildUnitsTrend(periodInvoices, groupFormat),
      distribution,
      volume,
      ledger: pagedLedger,
      ledgerMeta: buildMeta(page, limit, totalLedger),
    };
  },
};
