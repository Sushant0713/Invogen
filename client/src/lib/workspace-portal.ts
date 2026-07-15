import type { LucideIcon } from 'lucide-react';
import { Building2, Users } from 'lucide-react';

export type WorkspacePortal = 'admin' | 'employee';

export const WORKSPACE_PORTAL_OPTIONS: Array<{
  id: WorkspacePortal;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    id: 'admin',
    label: 'Business Admin',
    shortLabel: 'Admin',
    description: 'Manage your company workspace, invoices, and team.',
    icon: Building2,
  },
  {
    id: 'employee',
    label: 'Employee',
    shortLabel: 'Employee',
    description: 'Sign in with your company join code and assigned access.',
    icon: Users,
  },
];

export function parseWorkspacePortal(value: string | null | undefined): WorkspacePortal {
  return value === 'employee' ? 'employee' : 'admin';
}

export function loginPath(portal: WorkspacePortal, query?: Record<string, string>): string {
  const params = new URLSearchParams(query);
  params.set('portal', portal);
  return `/login?${params.toString()}`;
}

export function registerPath(portal: WorkspacePortal, query?: Record<string, string>): string {
  const params = new URLSearchParams(query);
  params.set('portal', portal);
  return `/register?${params.toString()}`;
}
