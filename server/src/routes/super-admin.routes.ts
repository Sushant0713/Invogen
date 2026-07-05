import { Router } from 'express';
import { UserRole } from '@invogen/shared';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import * as ctrl from '../controllers/super-admin.controller';

const router = Router();

router.use(authenticate, authorize(UserRole.SUPER_ADMIN));

router.get('/dashboard', ctrl.getDashboard);
router.get('/clients/stats', ctrl.getClientStats);
router.get('/clients', ctrl.getClients);
router.post('/clients', ctrl.createClient);
router.get('/clients/:id', ctrl.getClient);
router.get('/clients/:id/revenue', ctrl.getClientRevenue);
router.patch('/clients/:id', ctrl.updateClient);
router.patch('/clients/:id/status', ctrl.updateClientStatus);
router.post('/clients/:id/subscription/plan', ctrl.assignClientPlan);
router.patch('/clients/:id/subscription', ctrl.updateClientSubscription);
router.delete('/clients/:id', ctrl.deleteClient);
router.get('/plans', ctrl.getPlans);
router.post('/plans', ctrl.createPlan);
router.patch('/plans/:id', ctrl.updatePlan);
router.delete('/plans/:id', ctrl.deletePlan);
router.get('/plans/cashfree-status', ctrl.getCashfreeStatus);

router.get('/plan-types', ctrl.getPlanTypes);
router.post('/plan-types', ctrl.createPlanType);
router.patch('/plan-types/:id', ctrl.updatePlanType);
router.delete('/plan-types/:id', ctrl.deletePlanType);

router.get('/plan-features', ctrl.getPlanFeatures);
router.post('/plan-features', ctrl.createPlanFeature);
router.patch('/plan-features/:id', ctrl.updatePlanFeature);
router.delete('/plan-features/:id', ctrl.deletePlanFeature);

router.get('/plan-discounts', ctrl.getPlanDiscounts);
router.post('/plan-discounts', ctrl.createPlanDiscount);
router.patch('/plan-discounts/:id', ctrl.updatePlanDiscount);
router.delete('/plan-discounts/:id', ctrl.deletePlanDiscount);

router.get('/components', ctrl.getComponents);
router.post('/components', ctrl.createComponent);
router.patch('/components/:id', ctrl.updateComponent);
router.delete('/components/:id', ctrl.deleteComponent);
router.get('/templates', ctrl.getTemplates);
router.post('/templates', ctrl.createTemplate);
router.get('/templates/:id', ctrl.getTemplate);
router.patch('/templates/:id', ctrl.updateTemplate);
router.delete('/templates/:id', ctrl.deleteTemplate);
router.get('/revenue', ctrl.getRevenue);
router.get('/invoices', ctrl.getInvoices);
router.get('/activity-logs', ctrl.getActivityLogs);
router.get('/support-tickets', ctrl.getSupportTickets);
router.patch('/support-tickets/:id', ctrl.updateTicket);
router.get('/settings', ctrl.getSettings);
router.patch('/settings/:key', ctrl.updateSetting);
router.post('/notifications/broadcast', ctrl.broadcastNotification);

export default router;
