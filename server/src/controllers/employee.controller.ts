import { employeeService } from '../services/employee.service';
import { wrap, param } from '../utils/controller';

export const getPlanAdvertising = wrap((req) =>
  employeeService.getPlanAdvertising(req.companyId!)
);
export const getDashboard = wrap((req) =>
  employeeService.getDashboard(req.companyId!, req.user!.userId)
);
export const getInvoices = wrap((req) =>
  employeeService.getInvoices(req.companyId!, req.user!.userId, req.query)
);
export const getTemplates = wrap((req) => employeeService.getTemplates(req.companyId!, req.query));
export const getTemplate = wrap((req) => employeeService.getTemplate(req.companyId!, param(req.params.id)));
export const createInvoice = wrap((req) =>
  employeeService.createInvoice(req.companyId!, req.user!.userId, req.body)
);
export const getInvoice = wrap((req) =>
  employeeService.getInvoice(req.companyId!, req.user!.userId, param(req.params.id))
);
export const updateInvoice = wrap((req) =>
  employeeService.updateInvoice(req.companyId!, req.user!.userId, param(req.params.id), req.body)
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
  employeeService.getSharedInvoices(req.companyId!, req.user!.userId)
);
