import { Invoice, InvoiceTemplate } from '../models';
import { AppError } from '../utils/AppError';
import { getPagination, buildMeta } from '../utils/response';
import { adminService } from './admin.service';
import { assertSystemTemplateAccess } from '../utils/plan-template-access';

export const employeeService = {
  async getDashboard(companyId: string, userId: string) {
    const [myInvoices, totalInvoices] = await Promise.all([
      Invoice.find({ companyId, createdBy: userId }).sort({ createdAt: -1 }).limit(5),
      Invoice.countDocuments({ companyId, createdBy: userId }),
    ]);
    return { recentInvoices: myInvoices, totalInvoices };
  },

  async getInvoices(companyId: string, userId: string, query: Record<string, unknown>) {
    const { page, limit, skip } = getPagination(query.page as number, query.limit as number);
    const filter = { companyId, createdBy: userId };
    const [data, total] = await Promise.all([
      Invoice.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Invoice.countDocuments(filter),
    ]);
    return { data, meta: buildMeta(page, limit, total) };
  },

  async getTemplates(companyId: string, query: Record<string, unknown>) {
    return adminService.getTemplates(companyId, query);
  },

  async getTemplate(companyId: string, id: string) {
    const template = await InvoiceTemplate.findOne({
      _id: id,
      $or: [{ isSystem: true }, { companyId }],
    });
    if (!template) throw new AppError('Template not found', 404);
    if (template.isSystem) {
      await assertSystemTemplateAccess(companyId, id);
    }
    return template;
  },

  async createInvoice(companyId: string, userId: string, data: Record<string, unknown>) {
    return adminService.createInvoice(companyId, userId, data);
  },
};
