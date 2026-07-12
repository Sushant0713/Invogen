import { AppLayout } from './AppLayout';
import { superAdminNav } from '@/config/navigation';
import { useLocation } from 'react-router-dom';
import { isTemplateBuilderPath, isSettingsWorkspacePath } from '@/lib/builder-routes';
import { SuperAdminNotificationBell } from '@/components/notifications/AdminNotificationBell';

const planTitles: Record<string, string> = {
  '/super-admin/plans/types': 'Plan Type',
  '/super-admin/plans/features': 'Feature List',
  '/super-admin/plans/discounts': 'Discount',
  '/super-admin/plans/list': 'Plan List',
  '/super-admin/settings': 'Setting',
};

export default function SuperAdminLayout() {
  const location = useLocation();
  const planTitle = Object.entries(planTitles).find(([path]) => location.pathname.startsWith(path))?.[1];
  const current = superAdminNav.find((n) =>
    location.pathname.startsWith(n.path) && (n.path !== '/super-admin/plans' || location.pathname === '/super-admin/plans')
  );
  const title = planTitle || current?.label || 'Super Admin';
  const isBuilder = isTemplateBuilderPath(location.pathname);
  const isSettings = isSettingsWorkspacePath(location.pathname);
  const variant = isBuilder ? 'builder' : isSettings ? 'compact' : 'default';
  return (
    <AppLayout
      navItems={superAdminNav}
      title={isSettings ? '' : title}
      variant={variant}
      headerActions={<SuperAdminNotificationBell />}
    />
  );
}
