import { Badge } from '@/components/ui/Badge';
import {
  resolveDiscountStatus,
  formatDiscountDate,
  type DiscountLifecycleStatus,
  type DiscountStatusSnapshot,
} from '@invogen/shared';
import { Tag, CheckCircle, Calendar, Ticket, Clock, Ban, type LucideIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export type DiscountType = 'percentage' | 'fixed';
export type ApplyScope = 'all' | 'products' | 'category';

export interface ProductDiscountRecord {
  _id: string;
  name: string;
  code?: string;
  description?: string;
  discountType: DiscountType;
  value: number;
  applyScope: ApplyScope;
  productIds?: Array<{ _id: string; name: string; sku?: string; price?: number } | string>;
  category?: string;
  companyId?: { _id: string; name: string } | string;
  minOrderAmount?: number;
  minQuantity?: number;
  maxUses?: number;
  usedCount: number;
  startDate?: string;
  endDate?: string;
  priority?: number;
  isActive: boolean;
  statusSnapshot?: DiscountStatusSnapshot;
}

export const selectClass =
  'w-full rounded-xl border border-gray-200 bg-white/80 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

export const generateCouponCode = () => `PD${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

export const getStatusSnapshot = (discount: ProductDiscountRecord): DiscountStatusSnapshot =>
  discount.statusSnapshot ||
  resolveDiscountStatus({
    isActive: discount.isActive,
    startDate: discount.startDate,
    endDate: discount.endDate,
    maxUses: discount.maxUses,
    usedCount: discount.usedCount,
  });

export const lifecycleBadgeVariant = (
  lifecycle: DiscountLifecycleStatus
): 'success' | 'warning' | 'default' => {
  if (lifecycle === 'active') return 'success';
  if (lifecycle === 'scheduled') return 'default';
  return 'warning';
};

export function LifecycleStatusBadge({ discount }: { discount: ProductDiscountRecord }) {
  const status = getStatusSnapshot(discount);
  return (
    <div className="space-y-1">
      <Badge variant={lifecycleBadgeVariant(status.lifecycle)}>{status.label}</Badge>
      <p className="text-xs text-gray-500 max-w-[180px]">{status.description}</p>
    </div>
  );
}

export const formatDiscountValue = (discount: Pick<ProductDiscountRecord, 'discountType' | 'value'>) =>
  discount.discountType === 'percentage' ? `${discount.value}%` : formatCurrency(discount.value);

export const scopeLabel = (discount: ProductDiscountRecord) => {
  if (discount.applyScope === 'all') return 'All products';
  if (discount.applyScope === 'category') return `Category: ${discount.category || '—'}`;
  const count = Array.isArray(discount.productIds) ? discount.productIds.length : 0;
  return `${count} selected product${count === 1 ? '' : 's'}`;
};

export const resolveCompanyName = (ref?: { name?: string } | string) =>
  typeof ref === 'string' ? ref : ref?.name;

type DiscountStatKey = 'total' | 'active' | 'scheduled' | 'ended' | 'inactive' | 'redemptions';

type DiscountStats = Record<DiscountStatKey, number>;

export function buildDiscountStats(discounts: ProductDiscountRecord[]): DiscountStats {
  const lifecycles = discounts.map((d) => getStatusSnapshot(d).lifecycle);
  return {
    total: discounts.length,
    active: lifecycles.filter((s) => s === 'active').length,
    scheduled: lifecycles.filter((s) => s === 'scheduled').length,
    ended: lifecycles.filter((s) => s === 'expired' || s === 'exhausted').length,
    inactive: lifecycles.filter((s) => s === 'inactive').length,
    redemptions: discounts.reduce((sum, d) => sum + (d.usedCount || 0), 0),
  };
}

const DISCOUNT_STAT_ITEMS: { key: DiscountStatKey; label: string; icon: LucideIcon }[] = [
  { key: 'total', label: 'Total', icon: Tag },
  { key: 'active', label: 'Active', icon: CheckCircle },
  { key: 'scheduled', label: 'Scheduled', icon: Clock },
  { key: 'ended', label: 'Ended', icon: Calendar },
  { key: 'inactive', label: 'Disabled', icon: Ban },
  { key: 'redemptions', label: 'Redeemed', icon: Ticket },
];

export function DiscountStatsBar({ stats }: { stats: DiscountStats }) {
  return (
    <div className="flex rounded-lg border border-gray-200 bg-white overflow-x-auto">
      {DISCOUNT_STAT_ITEMS.map(({ key, label, icon: Icon }, index) => (
        <div
          key={key}
          className={`flex flex-1 min-w-[88px] items-center gap-1.5 px-2 py-1.5 ${
            index > 0 ? 'border-l border-gray-100' : ''
          }`}
        >
          <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
          <div className="min-w-0 leading-none">
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500 truncate">{label}</p>
            <p className="mt-0.5 text-sm font-bold text-gray-900 tabular-nums">{stats[key]}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function LifecyclePreview({
  form,
  editingUsedCount,
}: {
  form: {
    isActive: boolean;
    startDate: string;
    endDate: string;
    maxUses: string;
  };
  editingUsedCount?: number;
}) {
  const preview = resolveDiscountStatus({
    isActive: form.isActive,
    startDate: form.startDate || undefined,
    endDate: form.endDate || undefined,
    maxUses: form.maxUses ? Number(form.maxUses) : undefined,
    usedCount: editingUsedCount || 0,
  });

  return (
    <div className="grid md:grid-cols-2 gap-4 rounded-xl border border-dashed border-primary/30 bg-primary-50/40 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Lifecycle preview</p>
        <div className="mt-2 flex items-center gap-2">
          <Badge variant={lifecycleBadgeVariant(preview.lifecycle)}>{preview.label}</Badge>
          {preview.redeemable && (
            <span className="text-xs text-green-700 font-medium">Active now</span>
          )}
        </div>
        <p className="mt-2 text-sm text-gray-600">{preview.description}</p>
      </div>
      <div className="text-sm text-gray-600 space-y-1">
        <p>
          <span className="font-medium text-gray-800">Starts:</span>{' '}
          {form.startDate ? formatDiscountDate(form.startDate) : 'Immediately when enabled'}
        </p>
        <p>
          <span className="font-medium text-gray-800">Ends:</span>{' '}
          {form.endDate ? formatDiscountDate(form.endDate) : 'No end date'}
        </p>
      </div>
    </div>
  );
}
