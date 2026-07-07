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

  async getInvoice(companyId: string, userId: string, id: string) {
    const invoice = await Invoice.findOne({ _id: id, companyId, createdBy: userId });
    if (!invoice) throw new AppError('Invoice not found', 404);
    return invoice;
  },

  async updateInvoice(companyId: string, userId: string, id: string, data: Record<string, unknown>) {
    const invoice = await Invoice.findOneAndUpdate(
      { _id: id, companyId, createdBy: userId },
      data,
      { new: true }
    );
    if (!invoice) throw new AppError('Invoice not found', 404);
    return invoice;
  },

  async duplicateInvoice(companyId: string, userId: string, id: string) {
    const original = await Invoice.findOne({ _id: id, companyId, createdBy: userId });
    if (!original) throw new AppError('Invoice not found', 404);
    return adminService.duplicateInvoice(companyId, userId, id);
  },

  async deleteInvoice(companyId: string, userId: string, id: string) {
    const invoice = await Invoice.findOneAndDelete({ _id: id, companyId, createdBy: userId });
    if (!invoice) throw new AppError('Invoice not found', 404);
    return { deleted: true };
  },

  async shareInvoice(
    companyId: string,
    userId: string,
    id: string,
    data: { recipientName?: string; recipientEmail?: string; method?: string }
  ) {
    const invoice = await Invoice.findOne({ _id: id, companyId, createdBy: userId });
    if (!invoice) throw new AppError('Invoice not found', 404);
    return adminService.shareInvoice(companyId, userId, id, data);
  },

  async getSharedInvoices(companyId: string, userId: string) {
    const invoices = await Invoice.find({
      companyId,
      createdBy: userId,
      'shares.0': { $exists: true },
    })
      .populate('customerId', 'name email')
      .sort({ updatedAt: -1 })
      .select('invoiceNumber customerSnapshot shares status sentAt createdAt');

    type ShareRow = {
      invoiceId: string;
      invoiceNumber: string;
      customerName: string;
      recipientName: string;
      recipientEmail: string;
      method: string;
      sharedAt: string;
      token: string;
      status: string;
    };

    const rows: ShareRow[] = [];
    for (const invoice of invoices) {
      const customerName =
        (invoice.customerSnapshot as { name?: string } | undefined)?.name
        || (invoice.customerId as { name?: string } | undefined)?.name
        || '-';
      for (const share of invoice.shares ?? []) {
        rows.push({
          invoiceId: String(invoice._id),
          invoiceNumber: invoice.invoiceNumber,
          customerName,
          recipientName: share.recipientName ?? '-',
          recipientEmail: share.recipientEmail ?? '-',
          method: share.method,
          sharedAt: share.sharedAt.toISOString(),
          token: share.token,
          status: invoice.status,
        });
      }
    }

    rows.sort((a, b) => new Date(b.sharedAt).getTime() - new Date(a.sharedAt).getTime());
    return rows;
  },
};
