import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { AuthPortalSwitcher } from '@/components/auth/AuthPortalSwitcher';
import type { WorkspacePortal } from '@/lib/workspace-portal';
import { cn } from '@/lib/utils';

interface AuthShellProps {
  portal: WorkspacePortal;
  onPortalChange: (portal: WorkspacePortal) => void;
  children: ReactNode;
  sidebarNotice?: ReactNode;
  contentMaxWidth?: 'md' | 'xl';
  wrapInGlass?: boolean;
}

const SIDEBAR_POINTS: Record<WorkspacePortal, string[]> = {
  admin: [
    'Create and brand professional invoices',
    'Manage customers, products, and templates',
    'Invite employees with role-based access',
  ],
  employee: [
    'Join your company with a secure join code',
    'Create invoices from approved templates',
    'Work with the permissions your admin assigns',
  ],
};

export function AuthShell({
  portal,
  onPortalChange,
  children,
  sidebarNotice,
  contentMaxWidth = 'md',
  wrapInGlass = true,
}: AuthShellProps) {
  const points = SIDEBAR_POINTS[portal];
  const widthClass = contentMaxWidth === 'xl' ? 'max-w-xl' : 'max-w-md';

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary to-primary-700 items-center justify-center p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md space-y-6 text-white"
        >
          <div>
            <h1 className="text-4xl font-bold mb-4">Invogen</h1>
            <p className="text-primary-100 text-lg leading-relaxed">
              {portal === 'admin'
                ? 'Premium invoice builder for modern businesses. Create, customize, and send professional invoices.'
                : 'Your company workspace for creating and managing invoices with the access your admin provides.'}
            </p>
          </div>
          <ul className="space-y-3 text-primary-50 text-sm">
            {points.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <Check className="h-5 w-5 shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          {sidebarNotice}
        </motion.div>
      </div>

      <div className="flex w-full lg:w-1/2 items-center justify-center bg-gradient-to-br from-primary/5 via-white to-orange-50 p-6 sm:p-8">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className={cn('w-full space-y-5', widthClass)}
        >
          <div className="text-center lg:hidden">
            <h1 className="text-2xl font-bold text-primary">Invogen</h1>
          </div>

          <AuthPortalSwitcher value={portal} onChange={onPortalChange} />

          {wrapInGlass ? <div className="glass p-6 sm:p-8">{children}</div> : children}

          <p className="text-center text-sm text-gray-400">
            <Link to="/" className="hover:text-primary">
              Back to home
            </Link>
            <span className="mx-2">·</span>
            <Link to="/super-admin/login" className="hover:text-primary">
              Super Admin
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
