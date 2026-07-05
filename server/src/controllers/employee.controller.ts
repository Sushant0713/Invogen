import { employeeService } from '../services/employee.service';
import { wrap, param } from '../utils/controller';

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
