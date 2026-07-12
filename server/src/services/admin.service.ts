import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { UserRole, EMPLOYEE_DEFAULT_PERMISSIONS, UserStatus } from '@invogen/shared';
import {
  Company,
  User,
  Employee,
  Customer,
  Product,
  Invoice,
  InvoiceTemplate,
  Subscription,
  Plan,
  Payment,
} from '../models';
import { discountService } from './discount.service';
import { subscriptionService } from './subscription.service';
import { AppError } from '../utils/AppError';
import { getPagination, buildMeta } from '../utils/response';
import { buildTemplateListFilter, templateListProjection } from '../utils/template-query';
import {
  assertCanAddTemplate,
  assertSystemTemplateAccess,
  buildCompanyTemplateListFilter,
  getAllowedSystemTemplateIds,
  getCompanyPlanAccess,
  resolvePlanTemplateIds,
  systemTemplateAccessCondition,
} from '../utils/plan-template-access';
import { getMadeWithAdvertisingImage } from '../utils/made-with-advertising';
import { resolveInitialTemplatePages } from '../utils/resolve-initial-template-pages';
import { InvoiceStatus, SubscriptionStatus } from '@invogen/shared';
import type { TemplatePage } from '@invogen/shared';
import { cashfreeService } from './cashfree.service';
import { ensureCompanyInvoiceCode } from '../utils/company-invoice-code';
import { assignNextCompanyInvoiceNumber } from '../utils/company-invoice-number';
import { applyForwardInvoiceStatus } from '../utils/invoice-status';
import type { IInvoiceShare } from '../models/Invoice.model';
import { enrichInvoiceWithTotals, getInvoiceAmount, resolveInvoiceTotals, syncResolvedInvoiceTotals } from '../utils/invoice-gst';
import { tenantInvoiceFilter } from '../utils/sales-report';
import { notificationService } from './notification.service';
import {
  notifyInvoiceCreated,
  notifyInvoiceStatusIfPaid,
  notifySubscriptionRenewed,
} from '../utils/notification-events';

function toCompanyObjectId(companyId: string): mongoose.Types.ObjectId {
  if (!mongoose.Types.ObjectId.isValid(companyId)) {
    throw new AppError('Invalid company', 400);
  }
  return new mongoose.Types.ObjectId(companyId);
}

async function generateUniqueJoinCode(companyId: string): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const joinCode = generateEmployeeJoinCode();
    const clash = await Company.findOne({
      _id: { $ne: companyId },
      'employeeSettings.joinCode': joinCode,
    }).select('_id');
    if (!clash) return joinCode;
  }
  throw new AppError('Could not generate a unique join code. Please try again.', 500);
}

async function resolveJoinCode(
  companyId: string,
  currentJoinCode: string,
  options: { regenerate?: boolean; requestedJoinCode?: unknown }
): Promise<string> {
  if (options.regenerate) {
    return generateUniqueJoinCode(companyId);
  }

  if (typeof options.requestedJoinCode !== 'string') {
    return currentJoinCode;
  }

  const normalized = normalizeJoinCode(options.requestedJoinCode);
  const formatError = validateJoinCodeFormat(normalized);
  if (formatError) throw new AppError(formatError, 400);

  if (normalized === currentJoinCode) return normalized;

  const clash = await Company.findOne({
    _id: { $ne: companyId },
    'employeeSettings.joinCode': normalized,
  }).select('_id');
  if (clash) throw new AppError('Join code already in use. Choose another.', 409);

  return normalized;
}
import { checkoutPricingService } from './checkout-pricing.service';
import { platformInvoiceService } from './platform-invoice.service';
import { adminSalesReportService } from './admin-sales-report.service';
import { adminGstReportService } from './admin-gst-report.service';
import { adminCustomersReportService } from './admin-customers-report.service';
import { adminProductsReportService } from './admin-products-report.service';
import {
  defaultEmployeeSettings,
  generateEmployeeJoinCode,
  normalizeJoinCode,
  parseEmployeeSettings,
  sanitizeEmployeePermissions,
  validateJoinCodeFormat,
} from '../utils/employee-settings';

export const adminService = {
  async getDashboard(companyId: string) {
    const filter = tenantInvoiceFilter(companyId);
    const invoiceAmountFields = 'totals customerSnapshot status templateSnapshot';

    const [customers, products, invoices, paidInvoices, sentInvoices] = await Promise.all([
      Customer.countDocuments({ companyId }),
      Product.countDocuments({ companyId }),
      Invoice.countDocuments(filter),
      Invoice.find({ ...filter, status: InvoiceStatus.PAID })
        .select(invoiceAmountFields)
        .lean(),
      Invoice.find({ ...filter, status: InvoiceStatus.SENT })
        .select(invoiceAmountFields)
        .lean(),
    ]);

    const actualRevenue = paidInvoices.reduce((sum, invoice) => sum + getInvoiceAmount(invoice), 0);
    const expectedRevenue = sentInvoices.reduce((sum, invoice) => sum + getInvoiceAmount(invoice), 0);

    const recentInvoices = await Invoice.find(filter)
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('customerId', 'name');

    const subscription = await Subscription.findOne({ companyId })
      .populate('planId')
      .sort({ createdAt: -1 });

    return {
      stats: {
        customers,
        products,
        invoices,
        actualRevenue,
        expectedRevenue,
        revenue: actualRevenue,
      },
      recentInvoices: recentInvoices.map((invoice) =>
        enrichInvoiceWithTotals(invoice.toObject())
      ),
      subscription,
    };
  },

  async getCompany(companyId: string) {
    const company = await Company.findById(companyId);
    if (!company) throw new AppError('Company not found', 404);
    if (!company.employeeSettings?.joinCode) {
      company.employeeSettings = defaultEmployeeSettings();
      await company.save();
    }
    return company;
  },

  async updateCompany(companyId: string, data: Record<string, unknown>) {
    const shouldRegenerate = data.regenerateJoinCode === true;
    const incomingSettings = data.employeeSettings as Record<string, unknown> | undefined;
    const { regenerateJoinCode: _regenerateJoinCode, employeeSettings: _employeeSettings, ...rest } =
      data;

    if (!shouldRegenerate && !incomingSettings) {
      const company = await Company.findByIdAndUpdate(companyId, rest, { new: true });
      if (!company) throw new AppError('Company not found', 404);
      return company;
    }

    const company = await this.getCompany(companyId);
    const current = parseEmployeeSettings(company.employeeSettings);
    const joinCode = await resolveJoinCode(companyId, current.joinCode, {
      regenerate: shouldRegenerate,
      requestedJoinCode: incomingSettings?.joinCode,
    });

    const employeeSettings = {
      ...current,
      ...(incomingSettings
        ? {
            allowSelfRegistration: incomingSettings.allowSelfRegistration !== false,
            requireApproval: incomingSettings.requireApproval !== false,
            defaultPermissions: sanitizeEmployeePermissions(incomingSettings.defaultPermissions),
          }
        : {}),
      joinCode,
    };

    const updated = await Company.findByIdAndUpdate(
      companyId,
      { ...rest, employeeSettings },
      { new: true }
    );
    if (!updated) throw new AppError('Company not found', 404);
    return updated;
  },

  async getEmployees(companyId: string, query: Record<string, unknown>) {
    const { page, limit, skip } = getPagination(query.page as number, query.limit as number);
    const [employees, total] = await Promise.all([
      Employee.find({ companyId })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'firstName lastName email status lastLogin')
        .sort({ createdAt: -1 }),
      Employee.countDocuments({ companyId }),
    ]);

    const userIds = employees
      .map((employee) => {
        const user = employee.userId as { _id?: { toString(): string } } | null;
        return user?._id?.toString();
      })
      .filter((id): id is string => Boolean(id));

    const usersWithSession = userIds.length
      ? await User.find({ _id: { $in: userIds } }).select('+refreshTokenHash')
      : [];

    const loggedInByUserId = new Map(
      usersWithSession.map((user) => [user._id.toString(), Boolean(user.refreshTokenHash)])
    );

    const data = employees.map((employee) => {
      const record = employee.toObject() as unknown as Record<string, unknown>;
      const user = record.userId as {
        _id?: { toString(): string };
        firstName?: string;
        lastName?: string;
        email?: string;
        status?: string;
        lastLogin?: Date;
      } | null;

      if (user?._id) {
        const userId = user._id.toString();
        record.userId = {
          ...user,
          isLoggedIn: loggedInByUserId.get(userId) ?? false,
          hasAccess: user.status === UserStatus.ACTIVE,
        };
      }

      return record;
    });

    return { data, meta: buildMeta(page, limit, total) };
  },

  async createEmployee(
    companyId: string,
    adminId: string,
    data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      permissions?: string[];
      department?: string;
      designation?: string;
    }
  ) {
    const existing = await User.findOne({ email: data.email });
    if (existing) throw new AppError('Email already exists', 409);

    const passwordHash = await bcrypt.hash(data.password, 12);
    const permissions = sanitizeEmployeePermissions(data.permissions);
    const user = await User.create({
      email: data.email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      role: UserRole.EMPLOYEE,
      companyId,
      permissions,
      isEmailVerified: true,
    });

    const employee = await Employee.create({
      userId: user._id,
      companyId,
      permissions,
      createdBy: adminId,
      department: data.department,
      designation: data.designation,
    });

    return { user, employee };
  },

  async updateEmployee(companyId: string, id: string, data: Record<string, unknown>) {
    const employee = await Employee.findOne({ _id: id, companyId });
    if (!employee) throw new AppError('Employee not found', 404);

    const { accessEnabled, ...employeeFields } = data;

    if (typeof accessEnabled === 'boolean') {
      const user = await User.findById(employee.userId).select('+refreshTokenHash');
      if (!user) throw new AppError('User not found', 404);
      if (user.status === UserStatus.PENDING) {
        throw new AppError('Approve the employee before changing access', 400);
      }

      if (accessEnabled) {
        user.status = UserStatus.ACTIVE;
      } else {
        user.status = UserStatus.SUSPENDED;
        user.refreshTokenHash = undefined;
      }
      await user.save();
    }

    let updated = employee;
    if (Object.keys(employeeFields).length > 0) {
      if (employeeFields.permissions) {
        employeeFields.permissions = sanitizeEmployeePermissions(employeeFields.permissions);
      }
      const next = await Employee.findOneAndUpdate({ _id: id, companyId }, employeeFields, {
        new: true,
      });
      if (!next) throw new AppError('Employee not found', 404);
      updated = next;
      if (employeeFields.permissions) {
        await User.findByIdAndUpdate(updated.userId, { permissions: employeeFields.permissions });
      }
    }

    return updated.populate('userId', 'firstName lastName email status lastLogin');
  },

  async deleteEmployee(companyId: string, id: string) {
    const employee = await Employee.findOne({ _id: id, companyId });
    if (!employee) throw new AppError('Employee not found', 404);
    await User.findByIdAndDelete(employee.userId);
    await employee.deleteOne();
  },

  async getPendingEmployees(companyId: string) {
    const employees = await Employee.find({ companyId })
      .populate('userId', 'firstName lastName email status createdAt')
      .sort({ createdAt: -1 });
    return employees.filter((employee) => {
      const user = employee.userId as { status?: string } | null;
      return user?.status === UserStatus.PENDING;
    });
  },

  async approveEmployee(
    companyId: string,
    id: string,
    permissions: string[] | undefined
  ) {
    const employee = await Employee.findOne({ _id: id, companyId });
    if (!employee) throw new AppError('Employee not found', 404);
    const user = await User.findById(employee.userId);
    if (!user) throw new AppError('User not found', 404);
    if (user.status !== UserStatus.PENDING) {
      throw new AppError('Employee is not awaiting approval', 400);
    }

    const company = await this.getCompany(companyId);
    const settings = parseEmployeeSettings(company.employeeSettings);
    const resolvedPermissions = sanitizeEmployeePermissions(
      permissions ?? settings.defaultPermissions
    );

    user.status = UserStatus.ACTIVE;
    user.permissions = resolvedPermissions;
    employee.permissions = resolvedPermissions;
    await Promise.all([user.save(), employee.save()]);

    return employee.populate('userId', 'firstName lastName email status');
  },

  async rejectEmployee(companyId: string, id: string) {
    const employee = await Employee.findOne({ _id: id, companyId });
    if (!employee) throw new AppError('Employee not found', 404);
    const user = await User.findById(employee.userId);
    if (!user) throw new AppError('User not found', 404);
    if (user.status !== UserStatus.PENDING) {
      throw new AppError('Employee is not awaiting approval', 400);
    }
    await User.findByIdAndDelete(user._id);
    await employee.deleteOne();
  },

  async getNotifications(userId: string, companyId: string) {
    return notificationService.getForUser(userId, companyId);
  },

  async getUnreadNotificationCount(userId: string, companyId: string) {
    return notificationService.getUnreadCount(userId, companyId);
  },

  async markNotificationRead(userId: string, companyId: string, id: string) {
    return notificationService.markRead(userId, id, companyId);
  },

  async markAllNotificationsRead(userId: string, companyId: string) {
    await notificationService.markAllRead(userId, companyId);
  },

  async notifyCompanyAdmins(
    companyId: string,
    data: {
      title: string;
      message: string;
      type?: 'info' | 'success' | 'warning' | 'error';
      link?: string;
      metadata?: Record<string, unknown>;
    }
  ) {
    return notificationService.notifyCompanyAdmins(companyId, data);
  },

  async getCustomers(companyId: string, query: Record<string, unknown>) {
    const { page, limit, skip } = getPagination(query.page as number, query.limit as number);
    const filter: Record<string, unknown> = { companyId };
    if (query.search) filter.name = { $regex: query.search, $options: 'i' };
    const [data, total] = await Promise.all([
      Customer.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Customer.countDocuments(filter),
    ]);
    return { data, meta: buildMeta(page, limit, total) };
  },

  async createCustomer(companyId: string, data: Record<string, unknown>) {
    return Customer.create({ ...data, companyId });
  },

  async updateCustomer(companyId: string, id: string, data: Record<string, unknown>) {
    const customer = await Customer.findOneAndUpdate({ _id: id, companyId }, data, { new: true });
    if (!customer) throw new AppError('Customer not found', 404);
    return customer;
  },

  async deleteCustomer(companyId: string, id: string) {
    const customer = await Customer.findOneAndDelete({ _id: id, companyId });
    if (!customer) throw new AppError('Customer not found', 404);
  },

  async getProducts(companyId: string, query: Record<string, unknown>) {
    if (!companyId) throw new AppError('Company not found', 400);
    const { page, limit, skip } = getPagination(query.page as number, query.limit as number);
    const companyObjectId = new mongoose.Types.ObjectId(companyId);
    const filter: Record<string, unknown> = { companyId: companyObjectId };
    const search = typeof query.search === 'string' ? query.search.trim() : '';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
      ];
    }
    const [data, total] = await Promise.all([
      Product.find(filter).skip(skip).limit(limit).sort({ name: 1 }),
      Product.countDocuments(filter),
    ]);
    return { data, meta: buildMeta(page, limit, total) };
  },

  async createProduct(companyId: string, data: Record<string, unknown>) {
    return Product.create({ ...data, companyId });
  },

  async updateProduct(companyId: string, id: string, data: Record<string, unknown>) {
    const product = await Product.findOneAndUpdate({ _id: id, companyId }, data, { new: true });
    if (!product) throw new AppError('Product not found', 404);
    return product;
  },

  async deleteProduct(companyId: string, id: string) {
    const product = await Product.findOneAndDelete({ _id: id, companyId });
    if (!product) throw new AppError('Product not found', 404);
  },

  async getTemplates(companyId: string, query: Record<string, unknown>) {
    const { page, limit, skip } = getPagination(query.page as number, query.limit as number);
    const systemOnly = query.systemOnly === 'true' || query.systemOnly === true;
    const filter = systemOnly
      ? buildTemplateListFilter(
          [
            { isActive: true },
            systemTemplateAccessCondition(await getAllowedSystemTemplateIds(companyId)),
          ],
          query
        )
      : await buildCompanyTemplateListFilter(
          companyId,
          query,
          buildTemplateListFilter
        );
    const [data, total] = await Promise.all([
      InvoiceTemplate.find(filter).select(templateListProjection).skip(skip).limit(limit).sort({ updatedAt: -1 }),
      InvoiceTemplate.countDocuments(filter),
    ]);
    return { data, meta: buildMeta(page, limit, total) };
  },

  async getTemplate(companyId: string, id: string) {
    const companyObjectId = toCompanyObjectId(companyId);
    const template = await InvoiceTemplate.findOne({
      _id: id,
      $or: [{ isSystem: true }, { companyId: companyObjectId, isSystem: false }],
    });
    if (!template) throw new AppError('Template not found', 404);
    if (template.isSystem) {
      await assertSystemTemplateAccess(companyId, id);
    }
    return template;
  },

  async updateTemplate(companyId: string, id: string, data: Record<string, unknown>) {
    const companyObjectId = toCompanyObjectId(companyId);
    const existing = await InvoiceTemplate.findOne({
      _id: id,
      companyId: companyObjectId,
      isSystem: false,
    });
    if (!existing) {
      const systemTemplate = await InvoiceTemplate.findOne({ _id: id, isSystem: true });
      if (systemTemplate) {
        throw new AppError(
          'System templates cannot be edited directly. Use Add Template to create your own copy.',
          403
        );
      }
      throw new AppError('Template not found', 404);
    }

    const template = await InvoiceTemplate.findOneAndUpdate(
      { _id: id, companyId: companyObjectId, isSystem: false },
      data,
      { new: true, upsert: false }
    );
    if (!template) throw new AppError('Template not found', 404);
    return template;
  },

  async createTemplate(companyId: string, userId: string, data: Record<string, unknown>) {
    await assertCanAddTemplate(companyId);

    const name = typeof data.name === 'string' ? data.name.trim() : '';
    const category = typeof data.category === 'string' ? data.category.trim() : '';
    if (!name) throw new AppError('Template name is required', 400);
    if (!category) throw new AppError('Category is required', 400);

    const sourceTemplateId =
      typeof data.sourceTemplateId === 'string' ? data.sourceTemplateId.trim() : '';
    if (!sourceTemplateId) {
      throw new AppError('System template selection is required', 400);
    }

    const pages = await resolveInitialTemplatePages(
      companyId,
      category,
      data.pages,
      sourceTemplateId
    );

    const companyObjectId = toCompanyObjectId(companyId);
    const nameTaken = await InvoiceTemplate.exists({
      companyId: companyObjectId,
      isSystem: false,
      name,
    });
    if (nameTaken) {
      throw new AppError(
        'A template with this name already exists. Choose a different name to keep both.',
        409
      );
    }

    const sourceObjectId = mongoose.Types.ObjectId.isValid(sourceTemplateId)
      ? new mongoose.Types.ObjectId(sourceTemplateId)
      : undefined;

    return InvoiceTemplate.create({
      name,
      category,
      description: typeof data.description === 'string' ? data.description.trim() : '',
      pages,
      companyId: companyObjectId,
      sourceSystemTemplateId: sourceObjectId,
      isSystem: false,
      createdBy: userId,
      version: 1,
      isActive: true,
    });
  },

  async deleteTemplate(companyId: string, id: string) {
    const companyObjectId = toCompanyObjectId(companyId);
    const template = await InvoiceTemplate.findOneAndDelete({
      _id: id,
      companyId: companyObjectId,
      isSystem: false,
    });
    if (!template) throw new AppError('Template not found or cannot be deleted', 404);
  },

  async getInvoices(companyId: string, query: Record<string, unknown>) {
    const { page, limit, skip } = getPagination(query.page as number, query.limit as number);
    const filter: Record<string, unknown> = { companyId };
    if (query.status) filter.status = query.status;
    if (query.customerId) filter.customerId = query.customerId;
    const [data, total] = await Promise.all([
      Invoice.find(filter).skip(skip).limit(limit).populate('customerId', 'name').sort({ createdAt: -1 }),
      Invoice.countDocuments(filter),
    ]);
    return {
      data: data.map((invoice) => enrichInvoiceWithTotals(invoice.toObject())),
      meta: buildMeta(page, limit, total),
    };
  },

  async getInvoice(companyId: string, id: string) {
    const invoice = await Invoice.findOne({ _id: id, companyId }).populate('customerId');
    if (!invoice) throw new AppError('Invoice not found', 404);
    return enrichInvoiceWithTotals(invoice.toObject());
  },

  async createInvoice(companyId: string, userId: string, data: Record<string, unknown>) {
    const company = await Company.findById(companyId);
    if (!company) throw new AppError('Company not found', 404);

    const invoiceNumber = await assignNextCompanyInvoiceNumber(company);

    let templateSnapshot = Array.isArray(data.templateSnapshot)
      ? (data.templateSnapshot as TemplatePage[])
      : undefined;
    if (!templateSnapshot && data.templateId) {
      const template = await InvoiceTemplate.findById(data.templateId);
      if (template) {
        if (template.isSystem) {
          await assertSystemTemplateAccess(companyId, String(data.templateId));
        } else if (String(template.companyId) !== String(companyId)) {
          throw new AppError('Template not found', 404);
        }
        templateSnapshot = template.pages;
      }
    }

    const invoice = await Invoice.create({
      ...data,
      companyId,
      invoiceNumber,
      createdBy: userId,
      templateSnapshot,
      totals: resolveInvoiceTotals({
        totals: data.totals as Record<string, number> | undefined,
        customerSnapshot: data.customerSnapshot as { placeholders?: Record<string, unknown> },
      }),
    });

    notificationService.fire(notifyInvoiceCreated(companyId, invoice));

    return invoice;
  },

  async updateInvoice(companyId: string, id: string, data: Record<string, unknown>) {
    const { status: _ignoredStatus, ...rest } = data;
    if (rest.customerSnapshot || rest.totals) {
      rest.totals = resolveInvoiceTotals({
        totals: rest.totals as Record<string, number> | undefined,
        customerSnapshot: rest.customerSnapshot as { placeholders?: Record<string, unknown> },
      });
    }
    const invoice = await Invoice.findOneAndUpdate({ _id: id, companyId }, rest, { new: true });
    if (!invoice) throw new AppError('Invoice not found', 404);
    return invoice;
  },

  async updateInvoiceStatus(companyId: string, id: string, status: InvoiceStatus) {
    const invoice = await Invoice.findOne({ _id: id, companyId });
    if (!invoice) throw new AppError('Invoice not found', 404);

    const snap = invoice.customerSnapshot as { platformInvoice?: boolean } | undefined;
    if (snap?.platformInvoice === true) {
      throw new AppError('Platform subscription invoices cannot be changed here', 400);
    }

    const previousStatus = invoice.status as InvoiceStatus;
    await applyForwardInvoiceStatus(invoice, status);
    if (syncResolvedInvoiceTotals(invoice)) {
      await invoice.save();
    }
    notificationService.fire(
      notifyInvoiceStatusIfPaid(companyId, invoice, previousStatus, status)
    );
    return Invoice.findById(id).populate('customerId', 'name');
  },

  async duplicateInvoice(companyId: string, userId: string, id: string) {
    const original = await Invoice.findOne({ _id: id, companyId });
    if (!original) throw new AppError('Invoice not found', 404);
    const company = await Company.findById(companyId);
    if (!company) throw new AppError('Company not found', 404);

    const invoiceNumber = await assignNextCompanyInvoiceNumber(company);
    const obj = original.toObject();

    return Invoice.create({
      companyId: obj.companyId,
      invoiceNumber,
      type: obj.type,
      status: InvoiceStatus.DRAFT,
      templateId: obj.templateId,
      templateSnapshot: obj.templateSnapshot,
      customerId: obj.customerId,
      customerSnapshot: obj.customerSnapshot,
      lineItems: obj.lineItems,
      totals: obj.totals,
      issueDate: new Date(),
      dueDate: obj.dueDate,
      notes: obj.notes,
      terms: obj.terms,
      createdBy: userId,
    });
  },

  async deleteInvoice(companyId: string, id: string) {
    const invoice = await Invoice.findOne({ _id: id, companyId });
    if (!invoice) throw new AppError('Invoice not found', 404);

    const snap = invoice.customerSnapshot as { platformInvoice?: boolean } | undefined;
    if (snap?.platformInvoice === true) {
      throw new AppError('Platform subscription invoices cannot be deleted here', 400);
    }
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
    const invoice = await Invoice.findOne({ _id: id, companyId });
    if (!invoice) throw new AppError('Invoice not found', 404);

    const method: IInvoiceShare['method'] =
      data.method === 'email' || data.method === 'whatsapp' ? data.method : 'link';
    const token = crypto.randomBytes(24).toString('hex');
    const share: IInvoiceShare = {
      token,
      recipientName: data.recipientName?.trim() || undefined,
      recipientEmail: data.recipientEmail?.trim() || undefined,
      method,
      sharedAt: new Date(),
      sharedBy: new mongoose.Types.ObjectId(userId),
    };

    invoice.shares = [...(invoice.shares ?? []), share];
    if (!invoice.sentAt) invoice.sentAt = new Date();
    if (invoice.status === InvoiceStatus.DRAFT) invoice.status = InvoiceStatus.SENT;
    await invoice.save();

    return { token, share, invoiceNumber: invoice.invoiceNumber };
  },

  async getSharedInvoices(companyId: string) {
    const invoices = await Invoice.find({
      companyId,
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
      sharedAt: Date;
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
          sharedAt: share.sharedAt,
          token: share.token,
          status: invoice.status,
        });
      }
    }

    rows.sort((a, b) => new Date(b.sharedAt).getTime() - new Date(a.sharedAt).getTime());
    return rows;
  },

  async getPublicInvoiceByToken(token: string) {
    const invoice = await Invoice.findOne({ 'shares.token': token }).populate('companyId', 'name');
    if (!invoice) throw new AppError('Invoice not found or link expired', 404);

    const company = invoice.companyId as { _id?: { toString(): string }; name?: string } | null;
    const companyId =
      company && typeof company === 'object' && company._id
        ? company._id.toString()
        : invoice.get('companyId')?.toString?.() || '';
    const access = companyId ? await getCompanyPlanAccess(companyId) : null;
    const madeWithImage = await getMadeWithAdvertisingImage();
    const totals = resolveInvoiceTotals({
      totals: invoice.totals,
      customerSnapshot: invoice.customerSnapshot,
    });
    return {
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      templateSnapshot: invoice.templateSnapshot,
      customerSnapshot: invoice.customerSnapshot,
      totals,
      issueDate: invoice.issueDate,
      companyName: company?.name ?? 'Company',
      showMadeWithInvogen: access?.showMadeWithInvogen === true,
      madeWithImage,
    };
  },

  async getReports(companyId: string, type: string, query: Record<string, unknown>) {
    const match: Record<string, unknown> = { companyId };
    if (query.from) match.createdAt = { $gte: new Date(query.from as string) };
    if (query.to) match.createdAt = { ...((match.createdAt as object) || {}), $lte: new Date(query.to as string) };

    switch (type) {
      case 'sales':
        return adminSalesReportService.getSalesReport(companyId, query);
      case 'gst':
        return adminGstReportService.getGstReport(companyId, query);
      case 'customers':
        return adminCustomersReportService.getCustomersReport(companyId, query);
      case 'products':
        return adminProductsReportService.getProductsReport(companyId, query);
      case 'outstanding':
        return Invoice.find({ companyId, status: InvoiceStatus.SENT });
      default:
        return Invoice.find(match).limit(100);
    }
  },

  async getSubscription(companyId: string) {
    return subscriptionService.getLatestSubscription(companyId);
  },

  async getSubscriptionHistory(companyId: string) {
    return subscriptionService.getSubscriptionHistory(companyId);
  },

  async getSubscriptionPayments(companyId: string) {
    return subscriptionService.getPaymentHistory(companyId);
  },

  async getSubscriptionBillingSummary(companyId: string) {
    return subscriptionService.getBillingSummary(companyId);
  },

  async getSubscriptionStatus(companyId: string) {
    const [status, access, madeWithImage] = await Promise.all([
      subscriptionService.getStatus(companyId),
      getCompanyPlanAccess(companyId),
      getMadeWithAdvertisingImage(),
    ]);
    return {
      ...status,
      canAddTemplate: access ? access.canAddTemplate : true,
      templateAccessConfigured: access?.templateAccessConfigured === true,
      allowedTemplateIds:
        access && (access.templateAccessConfigured || access.templateIds.length > 0)
          ? access.templateIds.length > 0
            ? (
                await resolvePlanTemplateIds(access.templateIds)
              ).map((id) => String(id))
            : []
          : null,
      showMadeWithInvogen: access?.showMadeWithInvogen === true,
      madeWithImage,
    };
  },

  async getPlans() {
    return subscriptionService.getAvailablePlans();
  },

  async selectPlan(companyId: string, planId: string) {
    return subscriptionService.selectPlan(companyId, planId);
  },

  async validateDiscount(planId: string, code: string) {
    const plan = await Plan.findById(planId).populate('planTypeId');
    if (!plan || !plan.isActive) throw new AppError('Plan not found', 404);

    const applied = await discountService.validateAndApply(code, {
      planId: plan._id.toString(),
      planTypeId: plan.planTypeId?._id?.toString() || plan.planTypeId?.toString(),
      billingCycle: plan.billingCycle,
      amount: plan.price,
    });

    return {
      code: applied.discount.code,
      name: applied.discount.name,
      discountType: applied.discount.discountType,
      value: applied.discount.value,
      originalAmount: applied.originalAmount,
      discountAmount: applied.discountAmount,
      finalAmount: applied.finalAmount,
      statusSnapshot: discountService.resolveDiscountStatus({
        isActive: applied.discount.isActive,
        startDate: applied.discount.startDate,
        endDate: applied.discount.endDate,
        maxUses: applied.discount.maxUses,
        usedCount: applied.discount.usedCount,
      }),
    };
  },

  async getPaymentConfig() {
    return cashfreeService.getPublicConfig();
  },

  async getCheckoutQuote(planId: string, discountCode?: string) {
    return checkoutPricingService.buildQuote(planId, discountCode);
  },

  async createCheckout(companyId: string, userId: string, planId: string, discountCode?: string) {
    const plan = await Plan.findById(planId).populate('planTypeId');
    if (!plan || !plan.isActive) throw new AppError('Plan not found', 404);
    if (!cashfreeService.isConfigured()) throw new AppError('Payment gateway not configured', 503);

    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404);

    const { total, pricing } = await checkoutPricingService.resolvePayableTotal(planId, discountCode);

    if (total < 1) {
      throw new AppError('Plan amount must be at least ₹1 for checkout', 400);
    }

    return cashfreeService.createOrder({
      companyId,
      planId: plan._id.toString(),
      billingCycle: plan.billingCycle,
      amount: total,
      currency: plan.currency || 'INR',
      customer: {
        id: user._id.toString(),
        email: user.email,
        name: `${user.firstName} ${user.lastName}`.trim(),
      },
      discountCode: pricing.discount?.code,
    });
  },

  async verifyPayment(
    companyId: string,
    userId: string,
    data: {
      planId: string;
      orderId: string;
      discountCode?: string;
    }
  ) {
    const plan = await Plan.findById(data.planId).populate('planTypeId');
    if (!plan) throw new AppError('Plan not found', 404);

    const { total, pricing } = await checkoutPricingService.resolvePayableTotal(
      data.planId,
      data.discountCode
    );

    let discountMeta: Record<string, unknown> | undefined;
    if (data.discountCode && pricing.discount) {
      const applied = await discountService.validateAndApply(data.discountCode, {
        planId: plan._id.toString(),
        planTypeId: plan.planTypeId?._id?.toString() || plan.planTypeId?.toString(),
        billingCycle: plan.billingCycle,
        amount: plan.price,
      });
      discountMeta = {
        discountCode: applied.discount.code,
        discountId: applied.discount._id.toString(),
        originalAmount: applied.originalAmount,
        discountAmount: applied.discountAmount,
        subtotal: pricing.subtotal,
        taxableAmount: pricing.taxableAmount,
        cgstAmount: pricing.gst.cgstAmount,
        sgstAmount: pricing.gst.sgstAmount,
        totalGst: pricing.gst.totalGst,
      };
      await discountService.incrementUsage(applied.discount._id.toString());
    } else {
      discountMeta = {
        subtotal: pricing.subtotal,
        taxableAmount: pricing.taxableAmount,
        cgstAmount: pricing.gst.cgstAmount,
        sgstAmount: pricing.gst.sgstAmount,
        totalGst: pricing.gst.totalGst,
      };
    }

    if (!data.orderId) {
      throw new AppError('Order ID is required', 400);
    }

    await cashfreeService.confirmOrderPayment(data.orderId, total);

    await Subscription.updateMany(
      {
        companyId,
        status: {
          $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL, SubscriptionStatus.PAST_DUE],
        },
      },
      { status: SubscriptionStatus.CANCELLED, cancelledAt: new Date() }
    );

    const payment = await Payment.create({
      companyId,
      amount: total,
      currency: plan.currency,
      razorpayPaymentId: data.orderId,
      razorpayOrderId: data.orderId,
      status: 'captured',
      metadata: discountMeta,
    });

    const periodEnd = new Date();
    if (plan.billingCycle === 'monthly') periodEnd.setMonth(periodEnd.getMonth() + 1);
    else if (plan.billingCycle === 'yearly') periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else periodEnd.setFullYear(periodEnd.getFullYear() + 100);

    const subscription = await Subscription.create({
      companyId,
      planId: plan._id,
      status: 'active',
      razorpayOrderId: data.orderId,
      currentPeriodStart: new Date(),
      currentPeriodEnd: periodEnd,
      maintenanceDueDate: plan.billingCycle === 'lifetime'
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        : undefined,
    });

    payment.subscriptionId = subscription._id;
    await payment.save();

    // PDF + email can take 1–3 min (Puppeteer); don't block payment confirmation.
    notificationService.fire(
      platformInvoiceService.issueAndEmailSubscriptionInvoice({
        companyId,
        userId,
        paymentId: payment._id.toString(),
        subscriptionId: subscription._id.toString(),
        planId: plan._id.toString(),
        orderId: data.orderId,
        pricing: discountMeta,
      })
    );

    notificationService.fire(notifySubscriptionRenewed(companyId, plan.name, total));

    return { subscription, payment };
  },
};
