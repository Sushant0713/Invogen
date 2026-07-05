import { AppLayout } from './AppLayout';
import { employeeNav } from '@/config/navigation';
import { useLocation } from 'react-router-dom';
import { isFullHeightWorkspacePath } from '@/lib/builder-routes';

export default function EmployeeLayout() {
  const location = useLocation();
  const current = employeeNav.find((n) => location.pathname.startsWith(n.path));
  return (
    <AppLayout
      navItems={employeeNav}
      title={current?.label || 'Employee'}
      variant={isFullHeightWorkspacePath(location.pathname) ? 'builder' : 'default'}
    />
  );
}
