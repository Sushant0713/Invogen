import { useQuery } from '@tanstack/react-query';
import { Outlet, useLocation } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { adminNav } from '@/config/navigation';
import { isSubscriptionCheckoutPath, isSubscriptionNavChildActive } from '@/lib/subscription-routes';
import { isInvoiceNavChildActive } from '@/lib/invoice-routes';
import { isFullHeightWorkspacePath } from '@/lib/builder-routes';
import api from '@/api/client';
import { Loader } from '@/components/ui/Loader';
import { LogOut } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch';
import { logout } from '@/store/slices/authSlice';
import { rehydrateUserLocalPreferences } from '@/lib/user-preferences';
import { useNavigate } from 'react-router-dom';
import { MadeWithInvogenProvider } from '@/features/builder/MadeWithInvogenProvider';

function PlanSelectionShell({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      dispatch(logout());
      rehydrateUserLocalPreferences();
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-gray-100 bg-white/90 px-6 backdrop-blur-md">
        <span className="text-xl font-bold tracking-tight text-primary">Invogen</span>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-gray-500 sm:inline">{user?.email}</span>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>
      <main className="min-h-[calc(100vh-4rem)]">{children}</main>
    </div>
  );
}

export default function AdminLayout() {
  const location = useLocation();
  const current = adminNav.find((n) => {
    if (n.children?.some((c) => {
      if (c.path.includes('/invoices')) return isInvoiceNavChildActive(c.path, location.pathname);
      return isSubscriptionNavChildActive(c.path, location.pathname);
    })) return true;
    return location.pathname.startsWith(n.path);
  });
  const currentChild = current?.children?.find((c) => {
    if (c.path.includes('/invoices')) return isInvoiceNavChildActive(c.path, location.pathname);
    return isSubscriptionNavChildActive(c.path, location.pathname);
  });
  const pageTitle = currentChild?.label || current?.label || 'Admin';

  const { data: status, isLoading } = useQuery({
    queryKey: ['admin-subscription-status'],
    queryFn: async () => (await api.get('/admin/subscription/status')).data.data,
    staleTime: 0,
  });

  if (isLoading) return <Loader fullScreen />;

  const needsPlan = !status?.active;
  const onCheckoutFlow = isSubscriptionCheckoutPath(location.pathname);

  if (needsPlan && onCheckoutFlow) {
    return (
      <PlanSelectionShell>
        <Outlet />
      </PlanSelectionShell>
    );
  }

  return (
    <MadeWithInvogenProvider source="admin">
      <AppLayout
        navItems={adminNav}
        title={pageTitle}
        variant={isFullHeightWorkspacePath(location.pathname) ? 'builder' : 'default'}
      />
    </MadeWithInvogenProvider>
  );
}
