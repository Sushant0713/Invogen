import type { UserRole } from '@invogen/shared';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Palette,
  Puzzle,
  DollarSign,
  FileText,
  Settings,
  Activity,
  Headphones,
  UserCircle,
  Package,
  BarChart3,
  Receipt,
  Layers,
  Building2,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  children?: { label: string; path: string }[];
}

export const superAdminNav: NavItem[] = [
  { label: 'Dashboard', path: '/super-admin/dashboard', icon: LayoutDashboard },
  { label: 'Clients', path: '/super-admin/clients', icon: Users },
  {
    label: 'Plans',
    path: '/super-admin/plans',
    icon: CreditCard,
    children: [
      { label: 'Plan Type', path: '/super-admin/plans/types' },
      { label: 'Feature List', path: '/super-admin/plans/features' },
      { label: 'Discount', path: '/super-admin/plans/discounts' },
      { label: 'Plan List', path: '/super-admin/plans/list' },
    ],
  },
  { label: 'Template Settings', path: '/super-admin/templates', icon: Palette },
  { label: 'Components', path: '/super-admin/components', icon: Puzzle },
  { label: 'Revenue', path: '/super-admin/revenue', icon: DollarSign },
  { label: 'Invoices', path: '/super-admin/invoices', icon: FileText },
  { label: 'System Settings', path: '/super-admin/settings', icon: Settings },
  { label: 'Activity Logs', path: '/super-admin/activity-logs', icon: Activity },
  { label: 'Support Tickets', path: '/super-admin/support', icon: Headphones },
  { label: 'Profile', path: '/super-admin/profile', icon: UserCircle },
];

export const adminNav: NavItem[] = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Employees', path: '/admin/employees', icon: Users },
  { label: 'Customers', path: '/admin/customers', icon: Building2 },
  { label: 'Products', path: '/admin/products', icon: Package },
  { label: 'Invoices', path: '/admin/invoices', icon: Receipt },
  {
    label: 'Templates',
    path: '/admin/templates',
    icon: Layers,
    children: [
      { label: 'Template List', path: '/admin/templates' },
    ],
  },
  { label: 'Reports', path: '/admin/reports', icon: BarChart3 },
  {
    label: 'Subscription',
    path: '/admin/subscription',
    icon: CreditCard,
    children: [
      { label: 'My Plan', path: '/admin/subscription/my-plan' },
      { label: 'Browse Plans', path: '/admin/subscription/plans' },
      { label: 'Payment History', path: '/admin/subscription/payments' },
      { label: 'Subscription History', path: '/admin/subscription/history' },
      { label: 'Billing Summary', path: '/admin/subscription/billing' },
    ],
  },
  { label: 'Settings', path: '/admin/settings', icon: Settings },
  { label: 'Profile', path: '/admin/profile', icon: UserCircle },
];

export const employeeNav: NavItem[] = [
  { label: 'Dashboard', path: '/employee/dashboard', icon: LayoutDashboard },
  { label: 'Invoices', path: '/employee/invoices', icon: Receipt },
  { label: 'Create Invoice', path: '/employee/invoices/create', icon: FileText },
  { label: 'Template List', path: '/employee/templates', icon: Layers },
  { label: 'Profile', path: '/employee/profile', icon: UserCircle },
];

export const getLoginPath = (role: UserRole): string => {
  switch (role) {
    case 'super_admin':
      return '/super-admin/login';
    case 'admin':
      return '/admin/login';
    case 'employee':
      return '/employee/login';
    default:
      return '/';
  }
};

export const getLoginPathForPathname = (pathname: string): string => {
  if (pathname.startsWith('/super-admin')) return '/super-admin/login';
  if (pathname.startsWith('/employee')) return '/employee/login';
  if (pathname.startsWith('/admin')) return '/admin/login';
  return '/admin/login';
};

export const getDashboardPath = (role: UserRole): string => {
  switch (role) {
    case 'super_admin':
      return '/super-admin/dashboard';
    case 'admin':
      return '/admin/dashboard';
    case 'employee':
      return '/employee/dashboard';
    default:
      return '/';
  }
};
