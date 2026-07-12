import { AppLayout } from './AppLayout';
import { employeeNav } from '@/config/navigation';
import { useLocation } from 'react-router-dom';
import { isFullHeightWorkspacePath } from '@/lib/builder-routes';
import { MadeWithInvogenProvider } from '@/features/builder/MadeWithInvogenProvider';
import { useAppSelector } from '@/hooks/useAppDispatch';
import { filterEmployeeNav } from '@/lib/employee-nav';
import { useMemo } from 'react';

export default function EmployeeLayout() {
  const location = useLocation();
  const permissions = useAppSelector((s) => s.auth.user?.permissions ?? []);
  const navItems = useMemo(() => filterEmployeeNav(employeeNav, permissions), [permissions]);
  const current = navItems.find((n) => location.pathname.startsWith(n.path));
  return (
    <MadeWithInvogenProvider source="employee">
      <AppLayout
        navItems={navItems}
        title={current?.label || 'Employee'}
        variant={isFullHeightWorkspacePath(location.pathname) ? 'builder' : 'default'}
      />
    </MadeWithInvogenProvider>
  );
}
