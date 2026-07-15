import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/api/client';
import { PlanCatalog, type CatalogPlan, type BillingCycle } from '@/features/plans/PlanCatalog';
import { storeCheckoutCart } from '@/lib/subscription-checkout';
import { useSubscriptionStatus } from '@/hooks/useAdminSubscription';

interface SubscriptionRecord {
  _id: string;
  status: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  planId: CatalogPlan | { _id?: string; name?: string; billingCycle?: BillingCycle; price?: number };
}

export default function AdminSubscription() {
  const navigate = useNavigate();

  const { data: paymentConfig, isLoading: configLoading } = useQuery({
    queryKey: ['admin-payment-config'],
    queryFn: async () =>
      (await api.get('/admin/subscription/payment-config')).data.data as {
        razorpayEnabled: boolean;
      },
    staleTime: 0,
  });

  const { data: status, isLoading: statusLoading } = useSubscriptionStatus();

  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ['admin-subscription'],
    queryFn: async () => (await api.get('/admin/subscription')).data.data as SubscriptionRecord | null,
    staleTime: 0,
  });

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['admin-plans'],
    queryFn: async () => (await api.get('/admin/plans')).data.data as CatalogPlan[],
    staleTime: 0,
  });

  const razorpayEnabled = paymentConfig?.razorpayEnabled ?? false;
  const hasActivePlan = status?.active ?? false;
  const currentPlan = subscription?.planId as CatalogPlan | undefined;
  const currentPlanId = currentPlan?._id;

  const handleChoosePlan = (planId: string) => {
    storeCheckoutCart({ planId });
    navigate(`/admin/subscription/cart?planId=${planId}`);
  };

  return (
    <PlanCatalog
      plans={plans || []}
      loading={statusLoading || subLoading || plansLoading || configLoading}
      currentPlanId={currentPlanId}
      hasActivePlan={hasActivePlan}
      currentPlanName={currentPlan?.name}
      currentPlanStatus={subscription?.status}
      currentPeriodEnd={subscription?.currentPeriodEnd}
      currentBillingCycle={currentPlan?.billingCycle}
      razorpayEnabled={razorpayEnabled}
      showSandboxHint={!razorpayEnabled}
      onChoosePlan={handleChoosePlan}
      onReturnDashboard={() => navigate('/admin/dashboard')}
    />
  );
}
