import { Router } from 'express';
import { UserRole, PERMISSIONS } from '@invogen/shared';
import { authenticate, authorize, resolveTenant, requirePermission } from '../middlewares/auth.middleware';
import * as ctrl from '../controllers/employee.controller';

const router = Router();

router.use(authenticate, authorize(UserRole.EMPLOYEE), resolveTenant);

const workspaceReadPermissions = requirePermission(
  PERMISSIONS.INVOICE_CREATE,
  PERMISSIONS.INVOICE_EDIT,
  PERMISSIONS.INVOICE_VIEW,
  PERMISSIONS.TEMPLATE_EDIT,
  PERMISSIONS.TEMPLATE_VIEW,
  PERMISSIONS.PRODUCT_MANAGE
);

router.get('/plan-advertising', ctrl.getPlanAdvertising);
router.get('/company', workspaceReadPermissions, ctrl.getCompany);
router.get('/products/catalog', workspaceReadPermissions, ctrl.getProducts);
router.get('/customers/catalog', workspaceReadPermissions, ctrl.getCustomers);
router.get('/dashboard', ctrl.getDashboard);
router.get(
  '/invoices',
  requirePermission(PERMISSIONS.INVOICE_VIEW, PERMISSIONS.INVOICE_EDIT),
  ctrl.getInvoices
);
router.get(
  '/invoices/shares',
  requirePermission(PERMISSIONS.INVOICE_VIEW, PERMISSIONS.INVOICE_EDIT),
  ctrl.getSharedInvoices
);
router.get(
  '/invoices/:id',
  requirePermission(PERMISSIONS.INVOICE_VIEW, PERMISSIONS.INVOICE_EDIT),
  ctrl.getInvoice
);
router.post(
  '/invoices',
  requirePermission(PERMISSIONS.INVOICE_CREATE, PERMISSIONS.INVOICE_EDIT),
  ctrl.createInvoice
);
router.patch('/invoices/:id', requirePermission(PERMISSIONS.INVOICE_EDIT), ctrl.updateInvoice);
router.patch('/invoices/:id/status', requirePermission(PERMISSIONS.INVOICE_EDIT), ctrl.updateInvoiceStatus);
router.delete('/invoices/:id', requirePermission(PERMISSIONS.INVOICE_DELETE), ctrl.deleteInvoice);
router.post('/invoices/:id/share', requirePermission(PERMISSIONS.INVOICE_CREATE), ctrl.shareInvoice);
router.post('/invoices/:id/duplicate', requirePermission(PERMISSIONS.INVOICE_CREATE), ctrl.duplicateInvoice);
router.get('/templates', workspaceReadPermissions, ctrl.getTemplates);
router.get('/templates/:id', workspaceReadPermissions, ctrl.getTemplate);
router.post(
  '/templates',
  requirePermission(PERMISSIONS.TEMPLATE_CREATE, PERMISSIONS.TEMPLATE_EDIT),
  ctrl.createTemplate
);
router.patch('/templates/:id', requirePermission(PERMISSIONS.TEMPLATE_EDIT), ctrl.updateTemplate);
router.delete('/templates/:id', requirePermission(PERMISSIONS.TEMPLATE_EDIT), ctrl.deleteTemplate);
router.get('/products', requirePermission(PERMISSIONS.PRODUCT_MANAGE), ctrl.getProducts);
router.post('/products', requirePermission(PERMISSIONS.PRODUCT_MANAGE), ctrl.createProduct);
router.patch('/products/:id', requirePermission(PERMISSIONS.PRODUCT_MANAGE), ctrl.updateProduct);
router.delete('/products/:id', requirePermission(PERMISSIONS.PRODUCT_MANAGE), ctrl.deleteProduct);
router.get('/customers', requirePermission(PERMISSIONS.CUSTOMER_MANAGE), ctrl.getCustomers);
router.post('/customers', requirePermission(PERMISSIONS.CUSTOMER_MANAGE), ctrl.createCustomer);
router.patch('/customers/:id', requirePermission(PERMISSIONS.CUSTOMER_MANAGE), ctrl.updateCustomer);
router.delete('/customers/:id', requirePermission(PERMISSIONS.CUSTOMER_MANAGE), ctrl.deleteCustomer);

export default router;
