import type { UserRole } from '@invogen/shared';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Palette,
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
  Percent,
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
  { label: 'Discount', path: '/super-admin/discounts', icon: Percent },
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
  {
    label: 'Template Settings',
    path: '/super-admin/templates',
    icon: Palette,
    children: [
      { label: 'Add Template', path: '/super-admin/templates' },
      { label: 'Super Admin Templates', path: '/super-admin/templates/super-admin' },
    ],
  },
  { label: 'Reports', path: '/super-admin/reports', icon: BarChart3 },
  { label: 'Revenue', path: '/super-admin/revenue', icon: DollarSign },
  { label: 'Platform Invoices', path: '/super-admin/invoices', icon: FileText },
  { label: 'System Settings', path: '/super-admin/settings', icon: Settings },
  { label: 'Activity Logs', path: '/super-admin/activity-logs', icon: Activity },
  { label: 'Support Tickets', path: '/super-admin/support', icon: Headphones },
  { label: 'Profile', path: '/super-admin/profile', icon: UserCircle },
];

export const adminNav: NavItem[] = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
  {
    label: 'Employees',
    path: '/admin/employees',
    icon: Users,
    children: [
      { label: 'All employees', path: '/admin/employees' },
      { label: 'Pending approvals', path: '/admin/employees/pending' },
    ],
  },
  { label: 'Customers', path: '/admin/customers', icon: Building2 },
  { label: 'Products', path: '/admin/products', icon: Package },
  {
    label: 'Discount',
    path: '/admin/discounts',
    icon: Percent,
    children: [
      { label: 'Analytics', path: '/admin/discounts' },
      { label: 'Discount rules', path: '/admin/discounts/rules' },
    ],
  },
  {
    label: 'Invoices',
    path: '/admin/invoices',
    icon: Receipt,
    children: [
      { label: 'All Invoices', path: '/admin/invoices' },
      { label: 'Shared Invoices', path: '/admin/invoices/shared' },
      { label: 'New Invoice', path: '/admin/invoices/new' },
    ],
  },
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
  {
    label: 'Invoices',
    path: '/employee/invoices',
    icon: Receipt,
    children: [
      { label: 'All Invoices', path: '/employee/invoices' },
      { label: 'Shared Invoices', path: '/employee/invoices/shared' },
      { label: 'New Invoice', path: '/employee/invoices/new' },
    ],
  },
  { label: 'Template List', path: '/employee/templates', icon: Layers },
  { label: 'Products', path: '/employee/products', icon: Package },
  { label: 'Customers', path: '/employee/customers', icon: Building2 },
  { label: 'Profile', path: '/employee/profile', icon: UserCircle },
];

export const getLoginPath = (role: UserRole): string => {
  switch (role) {
    case 'super_admin':
      return '/super-admin/login';
    case 'admin':
      return '/login?portal=admin';
    case 'employee':
      return '/login?portal=employee';
    default:
      return '/';
  }
};

export const getLoginPathForPathname = (pathname: string): string => {
  if (pathname.startsWith('/super-admin')) return '/super-admin/login';
  if (pathname.startsWith('/employee')) return '/login?portal=employee';
  if (pathname.startsWith('/admin')) return '/login?portal=admin';
  return '/login?portal=admin';
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
