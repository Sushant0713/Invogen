import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarRange,
  Loader2,
  Percent,
  Tag,
  Ticket,
  TrendingDown,
  Users,
} from 'lucide-react';
import api from '@/api/client';
import { ChartCard } from '@/components/dashboard/ChartCard';
import { StatCard } from '@/components/dashboard/StatCard';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Loader } from '@/components/ui/Loader';
import { formatCompactCurrency, formatCurrency, formatDate } from '@/lib/utils';
import {
  buildRevenueChartData,
  fillRevenueSeriesGaps,
  formatRevenueRangeLabel,
  getPresetRange,
  getRevenueGroupLabel,
  type RevenueGroupBy,
  type RevenuePreset,
  type RevenueSeriesPoint,
} from '@/lib/revenue-chart';

const PRESETS: { id: RevenuePreset; label: string }[] = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '3m', label: '3 months' },
  { id: '12m', label: '12 months' },
  { id: 'all', label: 'All time' },
];

const selectClass =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';

type DiscountLedgerRow = {
  _id: string;
  companyId: string;
  companyName: string;
  planId: string | null;
  planName: string;
  billingCycle: string | null;
  discountCode: string;
  discountAmount: number;
  originalAmount: number;
  amountPaid: number;
  currency: string;
  createdAt: string;
};

type DiscountReportResponse = {
  series: RevenueSeriesPoint[];
  groupBy: RevenueGroupBy;
  totalDiscount: number;
  redemptionCount: number;
  averageDiscount: number;
  totalOriginal: number;
  totalPaid: number;
  from: string | null;
  to: string | null;
  ledger: DiscountLedgerRow[];
  ledgerMeta: { page: number; totalPages: number; total: number };
};

type DiscountFilters = {
  companies: { _id: string; name: string }[];
  coupons: { _id: string; code: string; name: string }[];
  plans: { _id: string; name: string; billingCycle: string }[];
};

export default function SuperAdminDiscountsPage() {
  const initialRange = getPresetRange('12m');
  const [preset, setPreset] = useState<RevenuePreset | null>('12m');
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const [groupBy, setGroupBy] = useState<RevenueGroupBy | 'auto'>('auto');
  const [companyId, setCompanyId] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [planId, setPlanId] = useState('');
  const [page, setPage] = useState(1);

  const { data: filters } = useQuery({
    queryKey: ['super-admin-discount-filters'],
    queryFn: async () =>
      (await api.get('/super-admin/discounts/filters')).data.data as DiscountFilters,
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'super-admin-discount-report',
      fromDate,
      toDate,
      groupBy,
      companyId,
      discountCode,
      planId,
      page,
    ],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit: 15 };
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      if (groupBy !== 'auto') params.groupBy = groupBy;
      if (companyId) params.companyId = companyId;
      if (discountCode) params.discountCode = discountCode;
      if (planId) params.planId = planId;
      return (await api.get('/super-admin/discounts/report', { params })).data
        .data as DiscountReportResponse;
    },
  });

  const chartData = useMemo(() => {
    if (!data) return [];
    const filled = fillRevenueSeriesGaps(data.series, fromDate, toDate, data.groupBy);
    return buildRevenueChartData(filled, data.groupBy);
  }, [data, fromDate, toDate]);

  const handlePreset = (nextPreset: RevenuePreset) => {
    const range = getPresetRange(nextPreset);
    setPreset(nextPreset);
    setFromDate(range.from);
    setToDate(range.to);
    setPage(1);
  };

  const clearFilters = () => {
    setCompanyId('');
    setDiscountCode('');
    setPlanId('');
    setPage(1);
  };

  const rangeLabel = formatRevenueRangeLabel(fromDate, toDate);
  const subtitle = data
    ? `${getRevenueGroupLabel(data.groupBy)} · ${rangeLabel}`
    : 'Plan coupon redemptions';

  if (isLoading && !data) return <Loader />;

  return (
    <div className="space-y-5">
      <Card className="p-4 border-primary/10 bg-gradient-to-r from-primary-50/60 to-white">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Plan discount analytics</h2>
            <p className="text-sm text-gray-500 mt-1">
              Track coupon redemptions from{' '}
              <Link to="/super-admin/plans/discounts" className="font-medium text-primary hover:underline">
                Plans → Discount
              </Link>
              . Create and edit coupons there; use this page to see how much was given.
            </p>
          </div>
          {isFetching ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-medium text-primary">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Updating
            </span>
          ) : null}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total discount given"
          value={formatCurrency(data?.totalDiscount || 0)}
          icon={TrendingDown}
        />
        <StatCard title="Redemptions" value={data?.redemptionCount || 0} icon={Ticket} />
        <StatCard
          title="Average per redemption"
          value={formatCurrency(data?.averageDiscount || 0)}
          icon={Percent}
        />
        <StatCard
          title="Original value (before discount)"
          value={formatCurrency(data?.totalOriginal || 0)}
          icon={Tag}
        />
      </div>

      <Card glass={false} className="border border-gray-100 bg-white shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium text-gray-900">Date range &amp; filters</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {PRESETS.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={preset === item.id ? 'primary' : 'outline'}
              onClick={() => handlePreset(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Input
            label="From"
            type="date"
            value={fromDate}
            onChange={(e) => {
              setPreset(null);
              setFromDate(e.target.value);
              setPage(1);
            }}
          />
          <Input
            label="To"
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => {
              setPreset(null);
              setToDate(e.target.value);
              setPage(1);
            }}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">View by</label>
            <select
              className={selectClass}
              value={groupBy}
              onChange={(e) => {
                setGroupBy(e.target.value as RevenueGroupBy | 'auto');
                setPage(1);
              }}
            >
              <option value="auto">Auto (daily / monthly)</option>
              <option value="day">Daily</option>
              <option value="month">Monthly</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Client</label>
            <select
              className={selectClass}
              value={companyId}
              onChange={(e) => {
                setCompanyId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All clients</option>
              {(filters?.companies || []).map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Coupon code</label>
            <select
              className={selectClass}
              value={discountCode}
              onChange={(e) => {
                setDiscountCode(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All coupons</option>
              {(filters?.coupons || []).map((c) => (
                <option key={c._id} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Plan</label>
            <select
              className={selectClass}
              value={planId}
              onChange={(e) => {
                setPlanId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All plans</option>
              {(filters?.plans || []).map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} ({p.billingCycle})
                </option>
              ))}
            </select>
          </div>
        </div>

        {(companyId || discountCode || planId) && (
          <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </Card>

      <ChartCard
        title="Discount given over time"
        subtitle={subtitle}
        data={chartData.length ? chartData : [{ name: 'No redemptions', value: 0 }]}
        valueFormatter={formatCurrency}
        axisValueFormatter={formatCompactCurrency}
        variant="bar"
        height={360}
      />

      <Card glass={false} className="border border-gray-100 bg-white shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="text-base font-semibold text-gray-900">Redemption history</h3>
        </div>
        <DataTable
          columns={[
            { key: 'createdAt', label: 'Date', render: (r) => formatDate((r as DiscountLedgerRow).createdAt) },
            { key: 'companyName', label: 'Client' },
            {
              key: 'discountCode',
              label: 'Coupon',
              render: (r) => (
                <code className="text-sm font-semibold text-primary">
                  {(r as DiscountLedgerRow).discountCode}
                </code>
              ),
            },
            { key: 'planName', label: 'Plan' },
            {
              key: 'originalAmount',
              label: 'List price',
              render: (r) => formatCurrency((r as DiscountLedgerRow).originalAmount),
            },
            {
              key: 'discountAmount',
              label: 'Discount',
              render: (r) => (
                <span className="font-medium text-green-700">
                  −{formatCurrency((r as DiscountLedgerRow).discountAmount)}
                </span>
              ),
            },
            {
              key: 'amountPaid',
              label: 'Paid',
              render: (r) => formatCurrency((r as DiscountLedgerRow).amountPaid),
            },
          ]}
          data={(data?.ledger || []) as unknown as Record<string, unknown>[]}
          keyField="_id"
          pagination={
            data?.ledgerMeta && data.ledgerMeta.totalPages > 1
              ? {
                  page: data.ledgerMeta.page,
                  totalPages: data.ledgerMeta.totalPages,
                  onPageChange: setPage,
                }
              : undefined
          }
        />
        {!data?.ledger?.length ? (
          <p className="mt-3 text-center text-sm text-gray-500">
            No coupon redemptions in this range. Coupons are created under Plans → Discount.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
