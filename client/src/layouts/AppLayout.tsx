import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogOut, Menu, X, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { NavItem } from '@/config/navigation';
import { isSubscriptionNavChildActive } from '@/lib/subscription-routes';
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch';
import { logout } from '@/store/slices/authSlice';
import { rehydrateUserLocalPreferences } from '@/lib/user-preferences';
import api from '@/api/client';
import { Button } from '@/components/ui/Button';

interface AppLayoutProps {
  navItems: NavItem[];
  title: string;
  variant?: 'default' | 'builder';
}

function NavItemLink({
  item,
  onNavigate,
  compact,
}: {
  item: NavItem;
  onNavigate: () => void;
  compact?: boolean;
}) {
  const location = useLocation();
  const hasChildren = item.children && item.children.length > 0;
  const isChildActive =
    hasChildren &&
    item.children!.some((c) => isSubscriptionNavChildActive(c.path, location.pathname));
  const [open, setOpen] = useState(isChildActive);

  const linkClass = (isActive: boolean) =>
    cn(
      'flex items-center rounded-xl text-sm font-medium transition-all',
      compact ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
      isActive
        ? 'bg-primary text-white shadow-lg shadow-primary/25'
        : 'text-gray-600 hover:bg-primary-50 hover:text-primary'
    );

  if (!hasChildren) {
    return (
      <NavLink
        to={item.path}
        end={item.path.split('/').filter(Boolean).length <= 2}
        onClick={onNavigate}
        title={compact ? item.label : undefined}
        className={({ isActive }) => linkClass(isActive)}
      >
        <item.icon className="h-5 w-5 shrink-0" />
        {!compact && item.label}
      </NavLink>
    );
  }

  if (compact) {
    const activeChild = item.children!.find((c) =>
      isSubscriptionNavChildActive(c.path, location.pathname)
    );
    return (
      <NavLink
        to={activeChild?.path || item.children![0].path}
        onClick={onNavigate}
        title={item.label}
        className={({ isActive }) => linkClass(isActive || Boolean(isChildActive))}
      >
        <item.icon className="h-5 w-5 shrink-0" />
      </NavLink>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
          isChildActive
            ? 'bg-primary-50 text-primary'
            : 'text-gray-600 hover:bg-primary-50 hover:text-primary'
        )}
      >
        <item.icon className="h-5 w-5 shrink-0" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-primary-100 pl-3">
          {item.children!.map((child) => (
            <NavLink
              key={child.path}
              to={child.path}
              end
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'block rounded-lg px-3 py-2 text-sm transition-all',
                  isActive
                    ? 'bg-primary text-white font-medium'
                    : 'text-gray-600 hover:bg-primary-50 hover:text-primary'
                )
              }
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export function AppLayout({ navItems, title, variant = 'default' }: AppLayoutProps) {
  const isBuilder = variant === 'builder';
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className={cn('flex min-h-screen', isBuilder ? 'h-screen overflow-hidden bg-gray-100' : 'bg-gray-50')}>
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 transform bg-white border-r border-gray-200 flex flex-col transition-all lg:translate-x-0 lg:static shrink-0',
          isBuilder ? 'w-[72px]' : 'w-64 bg-white/80 backdrop-blur-xl border-gray-100 shadow-xl',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div
          className={cn(
            'flex h-14 items-center border-b border-gray-100 shrink-0',
            isBuilder ? 'justify-center px-2' : 'justify-between px-6 h-16'
          )}
        >
          {isBuilder ? (
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
              I
            </span>
          ) : (
            <span className="text-xl font-bold text-primary">Invogen</span>
          )}
          {!isBuilder && (
            <button className="lg:hidden" onClick={closeSidebar}>
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        <nav className={cn('flex-1 overflow-y-auto', isBuilder ? 'p-2 space-y-1' : 'p-4 space-y-1')}>
          {navItems.map((item) => (
            <NavItemLink
              key={item.path}
              item={item}
              onNavigate={closeSidebar}
              compact={isBuilder}
            />
          ))}
        </nav>
        <div className={cn('border-t border-gray-100 shrink-0', isBuilder ? 'p-2' : 'p-4')}>
          {isBuilder ? (
            <div className="flex flex-col items-center gap-2">
              <div
                className="h-9 w-9 rounded-full bg-primary-100 flex items-center justify-center text-primary font-semibold text-sm"
                title={`${user?.firstName} ${user?.lastName}`}
              >
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Logout"
                className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-3 px-2">
                <div className="h-9 w-9 rounded-full bg-primary-100 flex items-center justify-center text-primary font-semibold text-sm">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </>
          )}
        </div>
      </aside>

      {sidebarOpen && !isBuilder && (
        <div className="fixed inset-0 z-40 bg-black/20 lg:hidden" onClick={closeSidebar} />
      )}

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {!isBuilder && (
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-gray-100 bg-white/70 backdrop-blur-xl px-6 shrink-0">
            <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
          </header>
        )}
        <main
          className={cn(
            'flex-1 min-h-0',
            isBuilder ? 'overflow-hidden' : 'p-6 overflow-auto'
          )}
        >
          {isBuilder ? (
            <Outlet />
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Outlet />
            </motion.div>
          )}
        </main>
      </div>
    </div>
  );
}
