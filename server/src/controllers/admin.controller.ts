import { adminService } from '../services/admin.service';
import { wrap, param } from '../utils/controller';

export const getDashboard = wrap((req) => adminService.getDashboard(req.companyId!));
export const getCompany = wrap((req) => adminService.getCompany(req.companyId!));
export const updateCompany = wrap((req) => adminService.updateCompany(req.companyId!, req.body));
export const getEmployees = wrap((req) => adminService.getEmployees(req.companyId!, req.query));
export const createEmployee = wrap((req) =>
  adminService.createEmployee(req.companyId!, req.user!.userId, req.body)
);
export const updateEmployee = wrap((req) =>
  adminService.updateEmployee(req.companyId!, param(req.params.id), req.body)
);
export const deleteEmployee = wrap(async (req) => {
  await adminService.deleteEmployee(req.companyId!, param(req.params.id));
});
export const getCustomers = wrap((req) => adminService.getCustomers(req.companyId!, req.query));
export const createCustomer = wrap((req) => adminService.createCustomer(req.companyId!, req.body));
export const updateCustomer = wrap((req) =>
  adminService.updateCustomer(req.companyId!, param(req.params.id), req.body)
);
export const deleteCustomer = wrap(async (req) => {
  await adminService.deleteCustomer(req.companyId!, param(req.params.id));
});
export const getProducts = wrap((req) => adminService.getProducts(req.companyId!, req.query));
export const createProduct = wrap((req) => adminService.createProduct(req.companyId!, req.body));
export const updateProduct = wrap((req) =>
  adminService.updateProduct(req.companyId!, param(req.params.id), req.body)
);
export const deleteProduct = wrap(async (req) => {
  await adminService.deleteProduct(req.companyId!, param(req.params.id));
});
export const getTemplates = wrap((req) => adminService.getTemplates(req.companyId!, req.query));
export const getTemplate = wrap((req) => adminService.getTemplate(req.companyId!, param(req.params.id)));
export const createTemplate = wrap((req) =>
  adminService.createTemplate(req.companyId!, req.user!.userId, req.body)
);
export const updateTemplate = wrap((req) =>
  adminService.updateTemplate(req.companyId!, param(req.params.id), req.body)
);
export const deleteTemplate = wrap(async (req) => {
  await adminService.deleteTemplate(req.companyId!, param(req.params.id));
});
export const getInvoices = wrap((req) => adminService.getInvoices(req.companyId!, req.query));
export const getInvoice = wrap((req) => adminService.getInvoice(req.companyId!, param(req.params.id)));
export const createInvoice = wrap((req) =>
  adminService.createInvoice(req.companyId!, req.user!.userId, req.body)
);
export const updateInvoice = wrap((req) =>
  adminService.updateInvoice(req.companyId!, param(req.params.id), req.body)
);
export const duplicateInvoice = wrap((req) =>
  adminService.duplicateInvoice(req.companyId!, req.user!.userId, param(req.params.id))
);
export const deleteInvoice = wrap(async (req) => {
  await adminService.deleteInvoice(req.companyId!, param(req.params.id));
});
export const shareInvoice = wrap((req) =>
  adminService.shareInvoice(req.companyId!, req.user!.userId, param(req.params.id), req.body)
);
export const getSharedInvoices = wrap((req) => adminService.getSharedInvoices(req.companyId!));
export const getReports = wrap((req) =>
  adminService.getReports(req.companyId!, param(req.params.type), req.query)
);
export const getPaymentConfig = wrap(() => adminService.getPaymentConfig());
export const getSubscription = wrap((req) => adminService.getSubscription(req.companyId!));
export const getSubscriptionHistory = wrap((req) =>
  adminService.getSubscriptionHistory(req.companyId!)
);
export const getSubscriptionPayments = wrap((req) =>
  adminService.getSubscriptionPayments(req.companyId!)
);
export const getSubscriptionBillingSummary = wrap((req) =>
  adminService.getSubscriptionBillingSummary(req.companyId!)
);
export const getSubscriptionStatus = wrap((req) => adminService.getSubscriptionStatus(req.companyId!));
export const getPlans = wrap(() => adminService.getPlans());
export const selectPlan = wrap((req) => adminService.selectPlan(req.companyId!, req.body.planId));
export const validateDiscount = wrap((req) =>
  adminService.validateDiscount(req.body.planId, req.body.code)
);
export const getCheckoutQuote = wrap((req) =>
  adminService.getCheckoutQuote(req.query.planId as string, req.query.discountCode as string | undefined)
);
export const createCheckout = wrap((req) =>
  adminService.createCheckout(req.companyId!, req.user!.userId, req.body.planId, req.body.discountCode)
);
export const verifyPayment = wrap((req) =>
  adminService.verifyPayment(req.companyId!, req.user!.userId, req.body)
);
