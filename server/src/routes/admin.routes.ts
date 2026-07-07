import { Router } from 'express';
import { UserRole, PERMISSIONS } from '@invogen/shared';
import { authenticate, authorize, resolveTenant, requirePermission } from '../middlewares/auth.middleware';
import { requireActiveSubscription } from '../middlewares/subscription.middleware';
import * as ctrl from '../controllers/admin.controller';

const router = Router();

router.use(authenticate, authorize(UserRole.ADMIN), resolveTenant);

router.get('/plans', ctrl.getPlans);
router.get('/subscription/quote', ctrl.getCheckoutQuote);
router.get('/subscription/payment-config', ctrl.getPaymentConfig);
router.get('/subscription', ctrl.getSubscription);
router.get('/subscription/status', ctrl.getSubscriptionStatus);
router.post('/subscription/validate-discount', ctrl.validateDiscount);
router.post('/subscription/checkout', ctrl.createCheckout);
router.post('/subscription/verify', ctrl.verifyPayment);
router.post('/subscription/select', ctrl.selectPlan);

router.use(requireActiveSubscription);

router.get('/subscription/history', ctrl.getSubscriptionHistory);
router.get('/subscription/payments', ctrl.getSubscriptionPayments);
router.get('/subscription/billing-summary', ctrl.getSubscriptionBillingSummary);

router.get('/dashboard', ctrl.getDashboard);
router.get('/company', ctrl.getCompany);
router.patch('/company', ctrl.updateCompany);
router.get('/employees', ctrl.getEmployees);
router.post('/employees', ctrl.createEmployee);
router.patch('/employees/:id', ctrl.updateEmployee);
router.delete('/employees/:id', ctrl.deleteEmployee);
router.get('/customers', requirePermission(PERMISSIONS.CUSTOMER_MANAGE), ctrl.getCustomers);
router.post('/customers', requirePermission(PERMISSIONS.CUSTOMER_MANAGE), ctrl.createCustomer);
router.patch('/customers/:id', requirePermission(PERMISSIONS.CUSTOMER_MANAGE), ctrl.updateCustomer);
router.delete('/customers/:id', requirePermission(PERMISSIONS.CUSTOMER_MANAGE), ctrl.deleteCustomer);
router.get('/products', requirePermission(PERMISSIONS.PRODUCT_MANAGE), ctrl.getProducts);
router.post('/products', requirePermission(PERMISSIONS.PRODUCT_MANAGE), ctrl.createProduct);
router.patch('/products/:id', requirePermission(PERMISSIONS.PRODUCT_MANAGE), ctrl.updateProduct);
router.delete('/products/:id', requirePermission(PERMISSIONS.PRODUCT_MANAGE), ctrl.deleteProduct);
router.get('/templates', ctrl.getTemplates);
router.get('/templates/:id', ctrl.getTemplate);
router.post('/templates', requirePermission(PERMISSIONS.TEMPLATE_EDIT), ctrl.createTemplate);
router.patch('/templates/:id', requirePermission(PERMISSIONS.TEMPLATE_EDIT), ctrl.updateTemplate);
router.delete('/templates/:id', requirePermission(PERMISSIONS.TEMPLATE_EDIT), ctrl.deleteTemplate);
router.get('/invoices', ctrl.getInvoices);
router.get('/invoices/shares', ctrl.getSharedInvoices);
router.get('/invoices/:id', ctrl.getInvoice);
router.post('/invoices', requirePermission(PERMISSIONS.INVOICE_CREATE), ctrl.createInvoice);
router.patch('/invoices/:id', requirePermission(PERMISSIONS.INVOICE_EDIT), ctrl.updateInvoice);
router.delete('/invoices/:id', requirePermission(PERMISSIONS.INVOICE_DELETE), ctrl.deleteInvoice);
router.post('/invoices/:id/share', requirePermission(PERMISSIONS.INVOICE_CREATE), ctrl.shareInvoice);
router.post('/invoices/:id/duplicate', requirePermission(PERMISSIONS.INVOICE_CREATE), ctrl.duplicateInvoice);
router.get('/reports/:type', requirePermission(PERMISSIONS.REPORTS_VIEW), ctrl.getReports);

export default router;
