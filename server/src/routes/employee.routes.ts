import { Router } from 'express';
import { UserRole, PERMISSIONS } from '@invogen/shared';
import { authenticate, authorize, resolveTenant, requirePermission } from '../middlewares/auth.middleware';
import * as ctrl from '../controllers/employee.controller';

const router = Router();

router.use(authenticate, authorize(UserRole.EMPLOYEE), resolveTenant);

router.get('/plan-advertising', ctrl.getPlanAdvertising);
router.get('/dashboard', ctrl.getDashboard);
router.get('/invoices', requirePermission(PERMISSIONS.INVOICE_VIEW), ctrl.getInvoices);
router.get('/invoices/shares', requirePermission(PERMISSIONS.INVOICE_VIEW), ctrl.getSharedInvoices);
router.get('/invoices/:id', requirePermission(PERMISSIONS.INVOICE_VIEW), ctrl.getInvoice);
router.post('/invoices', requirePermission(PERMISSIONS.INVOICE_CREATE), ctrl.createInvoice);
router.patch('/invoices/:id', requirePermission(PERMISSIONS.INVOICE_EDIT), ctrl.updateInvoice);
router.delete('/invoices/:id', requirePermission(PERMISSIONS.INVOICE_DELETE), ctrl.deleteInvoice);
router.post('/invoices/:id/share', requirePermission(PERMISSIONS.INVOICE_CREATE), ctrl.shareInvoice);
router.post('/invoices/:id/duplicate', requirePermission(PERMISSIONS.INVOICE_CREATE), ctrl.duplicateInvoice);
router.get('/templates', requirePermission(PERMISSIONS.TEMPLATE_VIEW), ctrl.getTemplates);
router.get('/templates/:id', requirePermission(PERMISSIONS.TEMPLATE_VIEW), ctrl.getTemplate);

export default router;
