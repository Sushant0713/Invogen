import { employeeService } from '../services/employee.service';
import { InvoiceStatus } from '@invogen/shared';
import { wrap, param } from '../utils/controller';

export const getPlanAdvertising = wrap((req) =>
  employeeService.getPlanAdvertising(req.companyId!)
);
export const getCompany = wrap((req) => employeeService.getCompany(req.companyId!));
export const getDashboard = wrap((req) =>
  employeeService.getDashboard(req.companyId!, req.user!.userId, req.user!.permissions)
);
export const getInvoices = wrap((req) =>
  employeeService.getInvoices(req.companyId!, req.user!.userId, req.query, req.user!.permissions)
);
export const getTemplates = wrap((req) => employeeService.getTemplates(req.companyId!, req.query));
export const createTemplate = wrap((req) =>
  employeeService.createTemplate(req.companyId!, req.user!.userId, req.body)
);
export const duplicateTemplate = wrap((req) =>
  employeeService.duplicateTemplate(req.companyId!, req.user!.userId, param(req.params.id), req.body)
);
export const updateTemplate = wrap((req) =>
  employeeService.updateTemplate(req.companyId!, param(req.params.id), req.body)
);
export const deleteTemplate = wrap(async (req) => {
  await employeeService.deleteTemplate(req.companyId!, param(req.params.id));
});
export const getTemplate = wrap((req) => employeeService.getTemplate(req.companyId!, param(req.params.id)));
export const createInvoice = wrap((req) =>
  employeeService.createInvoice(req.companyId!, req.user!.userId, req.body)
);
export const getInvoice = wrap((req) =>
  employeeService.getInvoice(
    req.companyId!,
    req.user!.userId,
    param(req.params.id),
    req.user!.permissions
  )
);
export const updateInvoice = wrap((req) =>
  employeeService.updateInvoice(
    req.companyId!,
    req.user!.userId,
    param(req.params.id),
    req.body,
    req.user!.permissions
  )
);
export const updateInvoiceStatus = wrap((req) =>
  employeeService.updateInvoiceStatus(
    req.companyId!,
    req.user!.userId,
    param(req.params.id),
    req.body.status as InvoiceStatus,
    req.user!.permissions
  )
);
export const duplicateInvoice = wrap((req) =>
  employeeService.duplicateInvoice(req.companyId!, req.user!.userId, param(req.params.id))
);
export const deleteInvoice = wrap(async (req) => {
  await employeeService.deleteInvoice(req.companyId!, req.user!.userId, param(req.params.id));
});
export const shareInvoice = wrap((req) =>
  employeeService.shareInvoice(req.companyId!, req.user!.userId, param(req.params.id), req.body)
);
export const getSharedInvoices = wrap((req) =>
  employeeService.getSharedInvoices(req.companyId!, req.user!.userId, req.user!.permissions)
);
export const getProducts = wrap((req) => employeeService.getProducts(req.companyId!, req.query));
export const createProduct = wrap((req) =>
  employeeService.createProduct(req.companyId!, req.body)
);
export const updateProduct = wrap((req) =>
  employeeService.updateProduct(req.companyId!, param(req.params.id), req.body)
);
export const deleteProduct = wrap(async (req) => {
  await employeeService.deleteProduct(req.companyId!, param(req.params.id));
});
export const getCustomers = wrap((req) => employeeService.getCustomers(req.companyId!, req.query));
export const createCustomer = wrap((req) =>
  employeeService.createCustomer(req.companyId!, req.body)
);
export const updateCustomer = wrap((req) =>
  employeeService.updateCustomer(req.companyId!, param(req.params.id), req.body)
);
export const deleteCustomer = wrap(async (req) => {
  await employeeService.deleteCustomer(req.companyId!, param(req.params.id));
});
