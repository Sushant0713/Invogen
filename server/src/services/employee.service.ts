import { Invoice, InvoiceTemplate } from '../models';
import { AppError } from '../utils/AppError';
import { getPagination, buildMeta } from '../utils/response';
import { adminService } from './admin.service';
import {
  assertSystemTemplateAccess,
} from '../utils/plan-template-access';
import { getMadeWithAdvertisingImage } from '../utils/made-with-advertising';
import { PERMISSIONS, InvoiceStatus } from '@invogen/shared';
import { applyForwardInvoiceStatus } from '../utils/invoice-status';
import { enrichInvoiceWithTotals } from '../utils/invoice-gst';

function canAccessCompanyInvoices(permissions: string[]) {
  return permissions.includes(PERMISSIONS.INVOICE_EDIT);
}

export const employeeService = {
  async getPlanAdvertising(companyId: string) {
    const [status, madeWithImage] = await Promise.all([
      adminService.getSubscriptionStatus(companyId),
      getMadeWithAdvertisingImage(),
    ]);
    return {
      showMadeWithInvogen: status.showMadeWithInvogen === true,
      madeWithImage,
      canAddTemplate: status.canAddTemplate,
      templateAccessConfigured: status.templateAccessConfigured,
      allowedTemplateIds: status.allowedTemplateIds,
    };
  },

  async getCompany(companyId: string) {
    return adminService.getCompany(companyId);
  },

  async getDashboard(companyId: string, userId: string, permissions: string[]) {
    const companyWide = canAccessCompanyInvoices(permissions);
    const filter = companyWide ? { companyId } : { companyId, createdBy: userId };
    const [recentInvoices, totalInvoices] = await Promise.all([
      Invoice.find(filter).sort({ createdAt: -1 }).limit(5),
      Invoice.countDocuments(filter),
    ]);
    return { recentInvoices, totalInvoices, companyWide };
  },

  async getInvoices(companyId: string, userId: string, query: Record<string, unknown>, permissions: string[]) {
    const { page, limit, skip } = getPagination(query.page as number, query.limit as number);

    if (canAccessCompanyInvoices(permissions)) {
      const filter: Record<string, unknown> = { companyId };
      if (query.customerId) filter.customerId = query.customerId;
      if (query.status) filter.status = query.status;
      const [data, total] = await Promise.all([
        Invoice.find(filter)
          .skip(skip)
          .limit(limit)
          .populate('customerId', 'name email')
          .sort({ createdAt: -1 }),
        Invoice.countDocuments(filter),
      ]);
      return {
        data: data.map((invoice) => enrichInvoiceWithTotals(invoice.toObject())),
        meta: buildMeta(page, limit, total),
      };
    }

    const filter: Record<string, unknown> = { companyId, createdBy: userId };
    if (query.customerId) filter.customerId = query.customerId;
    const [data, total] = await Promise.all([
      Invoice.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Invoice.countDocuments(filter),
    ]);
    return {
      data: data.map((invoice) => enrichInvoiceWithTotals(invoice.toObject())),
      meta: buildMeta(page, limit, total),
    };
  },

  async getTemplates(companyId: string, query: Record<string, unknown>) {
    return adminService.getTemplates(companyId, query);
  },

  async createTemplate(companyId: string, userId: string, data: Record<string, unknown>) {
    return adminService.createTemplate(companyId, userId, data);
  },

  async updateTemplate(companyId: string, id: string, data: Record<string, unknown>) {
    return adminService.updateTemplate(companyId, id, data);
  },

  async deleteTemplate(companyId: string, id: string) {
    return adminService.deleteTemplate(companyId, id);
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

  async getInvoice(companyId: string, userId: string, id: string, permissions: string[]) {
    if (canAccessCompanyInvoices(permissions)) {
      return adminService.getInvoice(companyId, id);
    }
    const invoice = await Invoice.findOne({ _id: id, companyId, createdBy: userId });
    if (!invoice) throw new AppError('Invoice not found', 404);
    return invoice;
  },

  async updateInvoice(
    companyId: string,
    userId: string,
    id: string,
    data: Record<string, unknown>,
    permissions: string[]
  ) {
    const { status: _ignoredStatus, ...rest } = data;
    if (canAccessCompanyInvoices(permissions)) {
      return adminService.updateInvoice(companyId, id, rest);
    }
    const invoice = await Invoice.findOneAndUpdate(
      { _id: id, companyId, createdBy: userId },
      rest,
      { new: true }
    );
    if (!invoice) throw new AppError('Invoice not found', 404);
    return invoice;
  },

  async updateInvoiceStatus(
    companyId: string,
    userId: string,
    id: string,
    status: InvoiceStatus,
    permissions: string[]
  ) {
    if (canAccessCompanyInvoices(permissions)) {
      return adminService.updateInvoiceStatus(companyId, id, status);
    }
    const invoice = await Invoice.findOne({ _id: id, companyId, createdBy: userId });
    if (!invoice) throw new AppError('Invoice not found', 404);
    await applyForwardInvoiceStatus(invoice, status);
    return Invoice.findById(id).populate('customerId', 'name');
  },

  async duplicateInvoice(companyId: string, userId: string, id: string) {
    const original = await Invoice.findOne({ _id: id, companyId, createdBy: userId });
    if (!original) throw new AppError('Invoice not found', 404);
    return adminService.duplicateInvoice(companyId, userId, id);
  },

  async deleteInvoice(companyId: string, userId: string, id: string) {
    const invoice = await Invoice.findOne({ _id: id, companyId, createdBy: userId });
    if (!invoice) throw new AppError('Invoice not found', 404);
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new AppError('Only draft invoices can be deleted', 400);
    }
    await invoice.deleteOne();
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

  async getSharedInvoices(companyId: string, userId: string, permissions: string[]) {
    const filter: Record<string, unknown> = {
      companyId,
      'shares.0': { $exists: true },
    };
    if (!canAccessCompanyInvoices(permissions)) {
      filter.createdBy = userId;
    }

    const invoices = await Invoice.find(filter)
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

  async getProducts(companyId: string, query: Record<string, unknown>) {
    return adminService.getProducts(companyId, query);
  },

  async createProduct(companyId: string, data: Record<string, unknown>) {
    return adminService.createProduct(companyId, data);
  },

  async updateProduct(companyId: string, id: string, data: Record<string, unknown>) {
    return adminService.updateProduct(companyId, id, data);
  },

  async deleteProduct(companyId: string, id: string) {
    return adminService.deleteProduct(companyId, id);
  },

  async getCustomers(companyId: string, query: Record<string, unknown>) {
    return adminService.getCustomers(companyId, query);
  },

  async createCustomer(companyId: string, data: Record<string, unknown>) {
    return adminService.createCustomer(companyId, data);
  },

  async updateCustomer(companyId: string, id: string, data: Record<string, unknown>) {
    return adminService.updateCustomer(companyId, id, data);
  },

  async deleteCustomer(companyId: string, id: string) {
    return adminService.deleteCustomer(companyId, id);
  },
};
