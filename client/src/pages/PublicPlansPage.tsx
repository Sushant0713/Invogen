import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import api from '@/api/client';
import { PlanCatalog, type CatalogPlan } from '@/features/plans/PlanCatalog';
import { useAppSelector } from '@/hooks/useAppDispatch';
import { UserRole } from '@invogen/shared';
import {
  checkoutPathForPlan,
  storeCheckoutCart,
} from '@/lib/subscription-checkout';
import { loginPath, registerPath } from '@/lib/workspace-portal';
import { Button } from '@/components/ui/Button';
import invogenFullLogo from '@/assets/invogen-full-logo.png';

export default function PublicPlansPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAppSelector((s) => s.auth);
  const isAdmin = isAuthenticated && user?.role === UserRole.ADMIN;

  const { data: plans, isLoading } = useQuery({
    queryKey: ['public-plans'],
    queryFn: async () => (await api.get('/public/plans')).data.data as CatalogPlan[],
    staleTime: 60_000,
  });

  const handleChoosePlan = (planId: string) => {
    storeCheckoutCart({ planId });
    if (isAdmin) {
      navigate(checkoutPathForPlan(planId));
      return;
    }
    navigate(registerPath('admin', { planId }));
  };

  return (
    <PlanCatalog
      plans={plans || []}
      loading={isLoading}
      onChoosePlan={handleChoosePlan}
      topBar={
        <div className="mx-auto mb-8 flex max-w-4xl items-center justify-between gap-4">
          <Link to="/" className="inline-flex items-center">
            <img
              src={invogenFullLogo}
              alt="Invogen"
              className="h-9 w-auto max-w-[160px] object-contain object-left"
            />
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {isAdmin ? (
              <Link to="/admin">
                <Button size="sm">Go to dashboard</Button>
              </Link>
            ) : (
              <>
                <Link to={loginPath('admin')}>
                  <Button size="sm" variant="outline">
                    Sign In
                  </Button>
                </Link>
                <Link to={registerPath('admin')}>
                  <Button size="sm">Create Account</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      }
    />
  );
}
