import { Router } from 'express';
import { UserRole, PERMISSIONS } from '@invogen/shared';
import { authenticate, authorize, resolveTenant, requirePermission } from '../middlewares/auth.middleware';
import * as ctrl from '../controllers/employee.controller';

const router = Router();

router.use(authenticate, authorize(UserRole.EMPLOYEE), resolveTenant);

router.get('/dashboard', ctrl.getDashboard);
router.get('/invoices', requirePermission(PERMISSIONS.INVOICE_VIEW), ctrl.getInvoices);
router.post('/invoices', requirePermission(PERMISSIONS.INVOICE_CREATE), ctrl.createInvoice);
router.get('/templates', requirePermission(PERMISSIONS.TEMPLATE_VIEW), ctrl.getTemplates);
router.get('/templates/:id', requirePermission(PERMISSIONS.TEMPLATE_VIEW), ctrl.getTemplate);

export default router;
