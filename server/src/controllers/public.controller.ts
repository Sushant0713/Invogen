import { adminService } from '../services/admin.service';
import { wrap, param } from '../utils/controller';

export const getPublicInvoiceView = wrap((req) =>
  adminService.getPublicInvoiceByToken(param(req.params.token))
);
