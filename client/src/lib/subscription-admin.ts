export type SubscriptionBadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

export function subscriptionStatusBadge(status?: string): SubscriptionBadgeVariant {
  switch (status) {
    case 'active':
      return 'success';
    case 'trial':
      return 'info';
    case 'past_due':
      return 'warning';
    case 'cancelled':
    case 'paused':
      return 'danger';
    default:
      return 'default';
  }
}

export function paymentStatusBadge(status?: string): SubscriptionBadgeVariant {
  switch (status) {
    case 'captured':
      return 'success';
    case 'pending':
      return 'warning';
    case 'failed':
    case 'refunded':
      return 'danger';
    default:
      return 'default';
  }
}

export function formatStatusLabel(status?: string) {
  if (!status) return '—';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function billingCycleLabel(cycle?: string) {
  if (cycle === 'monthly') return 'Monthly';
  if (cycle === 'yearly') return 'Yearly';
  if (cycle === 'lifetime') return 'Lifetime';
  return cycle || '—';
}
