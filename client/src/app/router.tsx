import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Loader } from '@/components/ui/Loader';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AdminSubscriptionGate } from '@/components/auth/AdminSubscriptionGate';
import { MaintenanceGate } from '@/pages/MaintenancePage';
import { UserRole } from '@invogen/shared';

const LandingPage = lazy(() => import('@/pages/LandingPage'));
const PublicPlansPage = lazy(() => import('@/pages/PublicPlansPage'));
const PortalLoginPage = lazy(() => import('@/pages/auth/PortalLoginPage'));
const PortalRegisterPage = lazy(() => import('@/pages/auth/PortalRegisterPage'));
const SuperAdminLogin = lazy(() => import('@/pages/auth/SuperAdminLogin'));
const AdminLogin = lazy(() => import('@/pages/auth/AdminLogin'));
const EmployeeLogin = lazy(() => import('@/pages/auth/EmployeeLogin'));
const EmployeeRegisterRedirect = lazy(() => import('@/pages/auth/EmployeeRegisterRedirect'));
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'));
const VerifyEmail = lazy(() => import('@/pages/auth/VerifyEmail'));
const LegalDocumentPage = lazy(() => import('@/pages/auth/LegalDocumentPage'));

const SuperAdminLayout = lazy(() => import('@/layouts/SuperAdminLayout'));
const AdminLayout = lazy(() => import('@/layouts/AdminLayout'));
const EmployeeLayout = lazy(() => import('@/layouts/EmployeeLayout'));

const SuperAdminDashboard = lazy(() => import('@/pages/super-admin/Dashboard'));
const SuperAdminClients = lazy(() => import('@/pages/super-admin/Clients'));
const SuperAdminClientDetail = lazy(() => import('@/pages/super-admin/ClientDetail'));
const SuperAdminPlanTypes = lazy(() => import('@/pages/super-admin/plans/PlanTypes'));
const SuperAdminPlanFeatures = lazy(() => import('@/pages/super-admin/plans/PlanFeatures'));
const SuperAdminPlanDiscounts = lazy(() => import('@/pages/super-admin/plans/PlanDiscounts'));
const SuperAdminDiscounts = lazy(() => import('@/pages/super-admin/Discounts'));
const SuperAdminPlanList = lazy(() => import('@/pages/super-admin/plans/PlanList'));
const SuperAdminTemplates = lazy(() => import('@/pages/super-admin/Templates'));
const SuperAdminCategoryTemplates = lazy(() => import('@/pages/super-admin/SuperAdminCategoryTemplates'));
const SuperAdminTemplateEdit = lazy(() => import('@/pages/super-admin/TemplateEdit'));
const SuperAdminRevenue = lazy(() => import('@/pages/super-admin/Revenue'));
const SuperAdminReports = lazy(() => import('@/pages/super-admin/Reports'));
const SuperAdminInvoices = lazy(() => import('@/pages/super-admin/Invoices'));
const SuperAdminInvoiceViewPage = lazy(() => import('@/pages/super-admin/InvoiceViewPage'));
const SuperAdminSettings = lazy(() => import('@/pages/super-admin/Settings'));
const SuperAdminActivityLogs = lazy(() => import('@/pages/super-admin/ActivityLogs'));
const SuperAdminSupport = lazy(() => import('@/pages/super-admin/Support'));
const SuperAdminProfile = lazy(() => import('@/pages/Profile'));

const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'));
const AdminEmployees = lazy(() => import('@/pages/admin/Employees'));
const AdminCustomers = lazy(() => import('@/pages/admin/Customers'));
const AdminProducts = lazy(() => import('@/pages/admin/Products'));
const AdminDiscounts = lazy(() => import('@/pages/admin/Discounts'));
const AdminDiscountRules = lazy(() => import('@/pages/admin/DiscountRules'));
const AdminInvoices = lazy(() => import('@/pages/admin/Invoices'));
const AdminInvoiceNew = lazy(() => import('@/pages/admin/InvoiceNew'));
const AdminInvoiceComposerPage = lazy(() => import('@/pages/admin/InvoiceComposerPage'));
const AdminInvoiceEditPage = lazy(() => import('@/pages/admin/InvoiceEditPage'));
const AdminInvoiceViewPage = lazy(() => import('@/pages/admin/InvoiceViewPage'));
const AdminSharedInvoices = lazy(() => import('@/pages/admin/SharedInvoices'));
const AdminTemplates = lazy(() => import('@/pages/admin/Templates'));
const AdminTemplateLivePreview = lazy(() => import('@/pages/admin/TemplateLivePreview'));
const AdminTemplateEdit = lazy(() => import('@/pages/admin/TemplateEdit'));
const AdminSettings = lazy(() => import('@/pages/admin/Settings'));
const AdminReports = lazy(() => import('@/pages/admin/Reports'));
const AdminSubscription = lazy(() => import('@/pages/admin/Subscription'));
const AdminSubscriptionIndex = lazy(() => import('@/pages/admin/subscription/SubscriptionIndex'));
const AdminSubscriptionMyPlan = lazy(() => import('@/pages/admin/subscription/SubscriptionMyPlan'));
const AdminSubscriptionHistory = lazy(() => import('@/pages/admin/subscription/SubscriptionHistoryPage'));
const AdminSubscriptionPayments = lazy(() => import('@/pages/admin/subscription/SubscriptionPaymentsPage'));
const AdminSubscriptionBilling = lazy(() => import('@/pages/admin/subscription/SubscriptionBillingPage'));
const AdminSubscriptionCart = lazy(() => import('@/pages/admin/SubscriptionCart'));
const AdminSubscriptionPayment = lazy(() => import('@/pages/admin/SubscriptionPayment'));
const AdminProfile = lazy(() => import('@/pages/Profile'));

const EmployeeDashboard = lazy(() => import('@/pages/employee/Dashboard'));
const EmployeeInvoices = lazy(() => import('@/pages/employee/Invoices'));
const EmployeeInvoiceNew = lazy(() => import('@/pages/employee/InvoiceNew'));
const EmployeeInvoiceComposerPage = lazy(() => import('@/pages/employee/InvoiceComposerPage'));
const EmployeeInvoiceEditPage = lazy(() => import('@/pages/employee/InvoiceEditPage'));
const EmployeeInvoiceViewPage = lazy(() => import('@/pages/employee/InvoiceViewPage'));
const EmployeeSharedInvoices = lazy(() => import('@/pages/employee/SharedInvoices'));
const EmployeeTemplates = lazy(() => import('@/pages/employee/Templates'));
const EmployeeTemplateEdit = lazy(() => import('@/pages/employee/TemplateEdit'));
const EmployeeTemplateLivePreview = lazy(() => import('@/pages/employee/TemplateLivePreview'));
const EmployeeProducts = lazy(() => import('@/pages/employee/Products'));
const EmployeeCustomers = lazy(() => import('@/pages/employee/Customers'));
const EmployeeProfile = lazy(() => import('@/pages/Profile'));

const NotFound = lazy(() => import('@/pages/NotFound'));
const Forbidden = lazy(() => import('@/pages/Forbidden'));
const MaintenancePage = lazy(() => import('@/pages/MaintenancePage'));
const PublicInvoiceViewPage = lazy(() => import('@/pages/PublicInvoiceViewPage'));
const PlatformInvoicePrintPage = lazy(() => import('@/pages/PlatformInvoicePrintPage'));

const withSuspense = (element: React.ReactNode) => (
  <Suspense fallback={<Loader fullScreen />}>{element}</Suspense>
);

function RootLayout() {
  return (
    <MaintenanceGate>
      <Outlet />
    </MaintenanceGate>
  );
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
  { path: '/', element: withSuspense(<LandingPage />) },
  { path: '/plans', element: withSuspense(<PublicPlansPage />) },
  { path: '/login', element: withSuspense(<PortalLoginPage />) },
  { path: '/register', element: withSuspense(<PortalRegisterPage />) },
  { path: '/super-admin/login', element: withSuspense(<SuperAdminLogin />) },
  { path: '/admin/login', element: withSuspense(<AdminLogin />) },
  { path: '/employee/login', element: withSuspense(<EmployeeLogin />) },
  { path: '/employee/register', element: withSuspense(<EmployeeRegisterRedirect />) },
  { path: '/legal/:type', element: withSuspense(<LegalDocumentPage />) },
  { path: '/forgot-password', element: withSuspense(<ForgotPassword />) },
  { path: '/reset-password', element: withSuspense(<ResetPassword />) },
  { path: '/verify-email', element: withSuspense(<VerifyEmail />) },
  { path: '/maintenance', element: withSuspense(<MaintenancePage />) },
  { path: '/view/invoice/:token', element: withSuspense(<PublicInvoiceViewPage />) },
  { path: '/platform-invoice/print/:token', element: withSuspense(<PlatformInvoicePrintPage />) },
  {
    path: '/super-admin',
    element: (
      <ProtectedRoute roles={[UserRole.SUPER_ADMIN]}>
        {withSuspense(<SuperAdminLayout />)}
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard', element: withSuspense(<SuperAdminDashboard />) },
      { path: 'clients', element: withSuspense(<SuperAdminClients />) },
      { path: 'clients/:id', element: withSuspense(<SuperAdminClientDetail />) },
      { path: 'discounts', element: withSuspense(<SuperAdminDiscounts />) },
      { path: 'plans', element: <Navigate to="/super-admin/plans/types" replace /> },
      { path: 'plans/types', element: withSuspense(<SuperAdminPlanTypes />) },
      { path: 'plans/features', element: withSuspense(<SuperAdminPlanFeatures />) },
      { path: 'plans/discounts', element: withSuspense(<SuperAdminPlanDiscounts />) },
      { path: 'plans/list', element: withSuspense(<SuperAdminPlanList />) },
      { path: 'templates', element: withSuspense(<SuperAdminTemplates />) },
      { path: 'templates/super-admin', element: withSuspense(<SuperAdminCategoryTemplates />) },
      { path: 'templates/:id/edit', element: withSuspense(<SuperAdminTemplateEdit />) },
      { path: 'revenue', element: withSuspense(<SuperAdminRevenue />) },
      { path: 'reports', element: withSuspense(<SuperAdminReports />) },
      { path: 'invoices', element: withSuspense(<SuperAdminInvoices />) },
      { path: 'invoices/:invoiceId/view', element: withSuspense(<SuperAdminInvoiceViewPage />) },
      { path: 'settings', element: withSuspense(<SuperAdminSettings />) },
      { path: 'activity-logs', element: withSuspense(<SuperAdminActivityLogs />) },
      { path: 'support', element: withSuspense(<SuperAdminSupport />) },
      { path: 'profile', element: withSuspense(<SuperAdminProfile />) },
    ],
  },
  {
    path: '/admin',
    element: (
      <ProtectedRoute roles={[UserRole.ADMIN]}>
        <AdminSubscriptionGate />
      </ProtectedRoute>
    ),
    children: [
      {
        element: withSuspense(<AdminLayout />),
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: 'dashboard', element: withSuspense(<AdminDashboard />) },
          { path: 'employees', element: withSuspense(<AdminEmployees />) },
          { path: 'employees/pending', element: withSuspense(<AdminEmployees />) },
          { path: 'customers', element: withSuspense(<AdminCustomers />) },
          { path: 'products', element: withSuspense(<AdminProducts />) },
          { path: 'discounts', element: withSuspense(<AdminDiscounts />) },
          { path: 'discounts/rules', element: withSuspense(<AdminDiscountRules />) },
          { path: 'invoices', element: withSuspense(<AdminInvoices />) },
          { path: 'invoices/shared', element: withSuspense(<AdminSharedInvoices />) },
          { path: 'invoices/new', element: withSuspense(<AdminInvoiceNew />) },
          { path: 'invoices/new/:templateId', element: withSuspense(<AdminInvoiceComposerPage />) },
          { path: 'invoices/:invoiceId/view', element: withSuspense(<AdminInvoiceViewPage />) },
          { path: 'invoices/:invoiceId/edit', element: withSuspense(<AdminInvoiceEditPage />) },
          { path: 'invoices/create', element: <Navigate to="/admin/invoices/new" replace /> },
          { path: 'templates', element: withSuspense(<AdminTemplates />) },
          { path: 'templates/:templateId/preview', element: withSuspense(<AdminTemplateLivePreview />) },
          { path: 'templates/:id/edit', element: withSuspense(<AdminTemplateEdit />) },
          { path: 'settings', element: withSuspense(<AdminSettings />) },
          { path: 'reports', element: withSuspense(<AdminReports />) },
          { path: 'subscription', element: withSuspense(<AdminSubscriptionIndex />) },
          { path: 'subscription/plans', element: withSuspense(<AdminSubscription />) },
          { path: 'subscription/my-plan', element: withSuspense(<AdminSubscriptionMyPlan />) },
          { path: 'subscription/history', element: withSuspense(<AdminSubscriptionHistory />) },
          { path: 'subscription/payments', element: withSuspense(<AdminSubscriptionPayments />) },
          { path: 'subscription/billing', element: withSuspense(<AdminSubscriptionBilling />) },
          { path: 'subscription/cart', element: withSuspense(<AdminSubscriptionCart />) },
          { path: 'subscription/payment', element: withSuspense(<AdminSubscriptionPayment />) },
          { path: 'profile', element: withSuspense(<AdminProfile />) },
        ],
      },
    ],
  },
  {
    path: '/employee',
    element: (
      <ProtectedRoute roles={[UserRole.EMPLOYEE]}>
        {withSuspense(<EmployeeLayout />)}
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard', element: withSuspense(<EmployeeDashboard />) },
      { path: 'invoices', element: withSuspense(<EmployeeInvoices />) },
      { path: 'invoices/shared', element: withSuspense(<EmployeeSharedInvoices />) },
      { path: 'invoices/new', element: withSuspense(<EmployeeInvoiceNew />) },
      { path: 'invoices/new/:templateId', element: withSuspense(<EmployeeInvoiceComposerPage />) },
      { path: 'invoices/:invoiceId/view', element: withSuspense(<EmployeeInvoiceViewPage />) },
      { path: 'invoices/:invoiceId/edit', element: withSuspense(<EmployeeInvoiceEditPage />) },
      { path: 'invoices/create', element: <Navigate to="/employee/invoices/new" replace /> },
      { path: 'templates', element: withSuspense(<EmployeeTemplates />) },
      { path: 'templates/:templateId/preview', element: withSuspense(<EmployeeTemplateLivePreview />) },
      { path: 'templates/:id/edit', element: withSuspense(<EmployeeTemplateEdit />) },
      { path: 'products', element: withSuspense(<EmployeeProducts />) },
      { path: 'customers', element: withSuspense(<EmployeeCustomers />) },
      { path: 'profile', element: withSuspense(<EmployeeProfile />) },
    ],
  },
  { path: '/403', element: withSuspense(<Forbidden />) },
  { path: '*', element: withSuspense(<NotFound />) },
    ],
  },
]);
