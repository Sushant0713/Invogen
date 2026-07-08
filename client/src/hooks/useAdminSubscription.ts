import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';

export interface SubscriptionPlanRef {
  _id?: string;
  name?: string;
  price?: number;
  currency?: string;
  billingCycle?: string;
  description?: string;
  features?: string[];
  featureIds?: { _id?: string; name: string }[];
  planTypeId?: { _id?: string; name?: string };
}

export interface AdminSubscriptionRecord {
  _id: string;
  status: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  maintenanceDueDate?: string;
  cancelledAt?: string;
  createdAt?: string;
  razorpayOrderId?: string;
  planId?: SubscriptionPlanRef;
}

export interface SubscriptionStatusPayload {
  active: boolean;
  subscription: AdminSubscriptionRecord | null;
  /** Whether the company's plan allows creating custom templates. */
  canAddTemplate?: boolean;
  templateAccessConfigured?: boolean;
  /** Pre-built template ids allowed by the plan. `null` = all system templates. */
  allowedTemplateIds?: string[] | null;
  /** Show "Made with Invogen" badge on templates/invoices for this plan. */
  showMadeWithInvogen?: boolean;
}

export interface BillingSummary {
  active: boolean;
  totalSpent: number;
  paymentCount: number;
  subscription: AdminSubscriptionRecord | null;
  recentPayments: PaymentRecord[];
}

export interface PaymentRecord {
  _id: string;
  amount: number;
  currency?: string;
  status: string;
  razorpayOrderId?: string;
  createdAt?: string;
  metadata?: {
    discountCode?: string;
    subtotal?: number;
    taxableAmount?: number;
    cgstAmount?: number;
    sgstAmount?: number;
    totalGst?: number;
  };
}

export function planFeatures(plan?: SubscriptionPlanRef): string[] {
  if (!plan) return [];
  if (plan.featureIds?.length) {
    return plan.featureIds.map((f) => f.name).filter(Boolean);
  }
  return plan.features || [];
}

export function isActiveSubscriptionStatus(status?: string) {
  return status === 'active' || status === 'trial';
}

export function useSubscriptionStatus() {
  return useQuery({
    queryKey: ['admin-subscription-status'],
    queryFn: async () => {
      const res = await api.get<{ data: SubscriptionStatusPayload }>('/admin/subscription/status');
      return res.data.data;
    },
    staleTime: 0,
  });
}

export function useAdminSubscription() {
  return useQuery({
    queryKey: ['admin-subscription'],
    queryFn: async () => {
      const res = await api.get<{ data: AdminSubscriptionRecord | null }>('/admin/subscription');
      return res.data.data;
    },
    staleTime: 0,
  });
}

export function useBillingSummary() {
  return useQuery({
    queryKey: ['admin-subscription-billing-summary'],
    queryFn: async () => {
      const res = await api.get<{ data: BillingSummary }>('/admin/subscription/billing-summary');
      return res.data.data;
    },
    staleTime: 0,
  });
}
