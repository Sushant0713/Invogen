import { UserStatus, SubscriptionStatus, InvoiceStatus } from '@invogen/shared';
import { superAdminService } from '../services/super-admin.service';
import { planManagementService } from '../services/plan-management.service';
import { superAdminDiscountReportService } from '../services/super-admin-discount-report.service';
import { razorpayService } from '../services/razorpay.service';
import { wrap, param } from '../utils/controller';

export const getDashboard = wrap(() => superAdminService.getDashboard());
export const getClientStats = wrap(() => superAdminService.getClientStats());
export const getClients = wrap((req) => superAdminService.getClients(req.query));
export const getClient = wrap((req) => superAdminService.getClient(param(req.params.id)));
export const getClientRevenue = wrap((req) => superAdminService.getClientRevenue(param(req.params.id)));
export const createClient = wrap((req) => superAdminService.createClient(req.body));
export const updateClient = wrap((req) => superAdminService.updateClient(param(req.params.id), req.body));
export const updateClientStatus = wrap((req) =>
  superAdminService.updateClientStatus(param(req.params.id), req.body.status as UserStatus)
);
export const assignClientPlan = wrap((req) =>
  superAdminService.assignClientPlan(param(req.params.id), req.body.planId as string)
);
export const updateClientSubscription = wrap((req) =>
  superAdminService.updateClientSubscription(param(req.params.id), req.body.status as SubscriptionStatus)
);
export const deleteClient = wrap(async (req) => {
  await superAdminService.deleteClient(param(req.params.id));
});
export const getPlans = wrap(() => planManagementService.getPlanList());
export const createPlan = wrap((req) => planManagementService.createPlan(req.body));
export const updatePlan = wrap((req) => planManagementService.updatePlan(param(req.params.id), req.body));
export const deletePlan = wrap(async (req) => {
  await planManagementService.deletePlan(param(req.params.id));
});
export const getRazorpayStatus = wrap(() => razorpayService.getConnectionStatus());

export const getPlanTypes = wrap(() => planManagementService.getPlanTypes());
export const createPlanType = wrap((req) => planManagementService.createPlanType(req.body));
export const updatePlanType = wrap((req) => planManagementService.updatePlanType(param(req.params.id), req.body));
export const deletePlanType = wrap(async (req) => {
  await planManagementService.deletePlanType(param(req.params.id));
});

export const getPlanFeatures = wrap(() => planManagementService.getFeatures());
export const createPlanFeature = wrap((req) => planManagementService.createFeature(req.body));
export const updatePlanFeature = wrap((req) => planManagementService.updateFeature(param(req.params.id), req.body));
export const deletePlanFeature = wrap(async (req) => {
  await planManagementService.deleteFeature(param(req.params.id));
});

export const getPlanDiscounts = wrap(() => planManagementService.getDiscounts());
export const createPlanDiscount = wrap((req) => planManagementService.createDiscount(req.body));
export const updatePlanDiscount = wrap((req) => planManagementService.updateDiscount(param(req.params.id), req.body));
export const deletePlanDiscount = wrap(async (req) => {
  await planManagementService.deleteDiscount(param(req.params.id));
});

export const getDiscountReport = wrap((req) => superAdminDiscountReportService.getReport(req.query));
export const getDiscountReportFilters = wrap(() => superAdminDiscountReportService.getFilters());

export const getComponents = wrap(() => superAdminService.getComponents());
export const createComponent = wrap((req) => superAdminService.createComponent(req.body));
export const updateComponent = wrap((req) => superAdminService.updateComponent(param(req.params.id), req.body));
export const deleteComponent = wrap(async (req) => {
  await superAdminService.deleteComponent(param(req.params.id));
});
export const getTemplates = wrap((req) => superAdminService.getTemplates(req.query));
export const getTemplate = wrap((req) => superAdminService.getTemplate(param(req.params.id)));
export const createTemplate = wrap((req) =>
  superAdminService.createTemplate(req.user!.userId, req.body)
);
export const duplicateTemplate = wrap((req) =>
  superAdminService.duplicateTemplate(req.user!.userId, param(req.params.id), req.body)
);
export const updateTemplate = wrap((req) =>
  superAdminService.updateTemplate(param(req.params.id), req.body)
);
export const deleteTemplate = wrap(async (req) => {
  await superAdminService.deleteTemplate(param(req.params.id));
});
export const getRevenue = wrap((req) => superAdminService.getRevenue(req.query));
export const getReports = wrap((req) =>
  superAdminService.getReports(param(req.params.type), req.query)
);
export const getInvoices = wrap((req) => superAdminService.getInvoices(req.query));
export const getInvoice = wrap((req) => superAdminService.getInvoice(param(req.params.id)));
export const updateInvoiceStatus = wrap((req) =>
  superAdminService.updateInvoiceStatus(param(req.params.id), req.body.status as InvoiceStatus)
);
export const deleteInvoice = wrap(async (req) => {
  await superAdminService.deleteInvoice(param(req.params.id));
});
export const getActivityLogs = wrap((req) => superAdminService.getActivityLogs(req.query));
export const deleteActivityLogs = wrap((req) => superAdminService.deleteActivityLogs(req.body));
export const getSupportTickets = wrap((req) => superAdminService.getSupportTickets(req.query));
export const updateTicket = wrap((req) => superAdminService.updateTicket(param(req.params.id), req.body));
export const getSettings = wrap((req) => superAdminService.getSettings(req.query.scope as string));
export const updateSetting = wrap((req) =>
  superAdminService.updateSetting(param(req.params.key), req.body.value, req.body.scope)
);
export const broadcastNotification = wrap((req) => superAdminService.broadcastNotification(req.body));
export const getNotifications = wrap((req) => superAdminService.getNotifications(req.user!.userId));
export const getUnreadNotificationCount = wrap((req) =>
  superAdminService.getUnreadNotificationCount(req.user!.userId)
);
export const markNotificationRead = wrap((req) =>
  superAdminService.markNotificationRead(req.user!.userId, param(req.params.id))
);
export const markAllNotificationsRead = wrap(async (req) => {
  await superAdminService.markAllNotificationsRead(req.user!.userId);
});
