import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { UserRole, EMPLOYEE_DEFAULT_PERMISSIONS } from '@invogen/shared';
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
  getCompanyPlanAccess,
} from '../utils/plan-template-access';
import { createBlankTemplate } from '../seeds/data/templates';
import { InvoiceStatus, SubscriptionStatus } from '@invogen/shared';
import type { TemplatePage } from '@invogen/shared';
import { cashfreeService } from './cashfree.service';
import { checkoutPricingService } from './checkout-pricing.service';
import { platformInvoiceService } from './platform-invoice.service';

export const adminService = {
  async getDashboard(companyId: string) {
    const [customers, products, invoices, revenue] = await Promise.all([
      Customer.countDocuments({ companyId }),
      Product.countDocuments({ companyId }),
      Invoice.countDocuments({ companyId }),
      Invoice.aggregate([
        { $match: { companyId: companyId as unknown as import('mongoose').Types.ObjectId, status: InvoiceStatus.PAID } },
        { $group: { _id: null, total: { $sum: '$totals.total' } } },
      ]),
    ]);

    const recentInvoices = await Invoice.find({ companyId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('customerId', 'name');

    const subscription = await Subscription.findOne({ companyId })
      .populate('planId')
      .sort({ createdAt: -1 });

    return {
      stats: { customers, products, invoices, revenue: revenue[0]?.total || 0 },
      recentInvoices,
      subscription,
    };
  },

  async getCompany(companyId: string) {
    const company = await Company.findById(companyId);
    if (!company) throw new AppError('Company not found', 404);
    return company;
  },

  async updateCompany(companyId: string, data: Record<string, unknown>) {
    const company = await Company.findByIdAndUpdate(companyId, data, { new: true });
    if (!company) throw new AppError('Company not found', 404);
    return company;
  },

  async getEmployees(companyId: string, query: Record<string, unknown>) {
    const { page, limit, skip } = getPagination(query.page as number, query.limit as number);
    const [data, total] = await Promise.all([
      Employee.find({ companyId }).skip(skip).limit(limit).populate('userId', 'firstName lastName email status'),
      Employee.countDocuments({ companyId }),
    ]);
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
    const user = await User.create({
      email: data.email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      role: UserRole.EMPLOYEE,
      companyId,
      permissions: data.permissions || EMPLOYEE_DEFAULT_PERMISSIONS,
      isEmailVerified: true,
    });

    const employee = await Employee.create({
      userId: user._id,
      companyId,
      permissions: data.permissions || EMPLOYEE_DEFAULT_PERMISSIONS,
      createdBy: adminId,
      department: data.department,
      designation: data.designation,
    });

    return { user, employee };
  },

  async updateEmployee(companyId: string, id: string, data: Record<string, unknown>) {
    const employee = await Employee.findOneAndUpdate({ _id: id, companyId }, data, { new: true });
    if (!employee) throw new AppError('Employee not found', 404);
    if (data.permissions) {
      await User.findByIdAndUpdate(employee.userId, { permissions: data.permissions });
    }
    return employee;
  },

  async deleteEmployee(companyId: string, id: string) {
    const employee = await Employee.findOne({ _id: id, companyId });
    if (!employee) throw new AppError('Employee not found', 404);
    await User.findByIdAndDelete(employee.userId);
    await employee.deleteOne();
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
    const filter = await buildCompanyTemplateListFilter(
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

  async updateTemplate(companyId: string, id: string, data: Record<string, unknown>) {
    const existing = await InvoiceTemplate.findOne({
      _id: id,
      $or: [{ companyId }, { isSystem: true }],
    });
    if (!existing) throw new AppError('Template not found', 404);
    if (existing.isSystem) {
      await assertSystemTemplateAccess(companyId, id);
    }

    const template = await InvoiceTemplate.findOneAndUpdate(
      { _id: id, $or: [{ companyId }, { isSystem: true }] },
      { ...data, companyId, isSystem: false },
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

    const pages = Array.isArray(data.pages) && data.pages.length > 0
      ? data.pages
      : createBlankTemplate(category);

    return InvoiceTemplate.create({
      name,
      category,
      description: typeof data.description === 'string' ? data.description.trim() : '',
      pages,
      companyId,
      isSystem: false,
      createdBy: userId,
      version: 1,
      isActive: true,
    });
  },

  async deleteTemplate(companyId: string, id: string) {
    const template = await InvoiceTemplate.findOneAndDelete({
      _id: id,
      companyId,
      isSystem: false,
    });
    if (!template) throw new AppError('Template not found or cannot be deleted', 404);
  },

  async getInvoices(companyId: string, query: Record<string, unknown>) {
    const { page, limit, skip } = getPagination(query.page as number, query.limit as number);
    const filter: Record<string, unknown> = { companyId };
    if (query.status) filter.status = query.status;
    const [data, total] = await Promise.all([
      Invoice.find(filter).skip(skip).limit(limit).populate('customerId', 'name').sort({ createdAt: -1 }),
      Invoice.countDocuments(filter),
    ]);
    return { data, meta: buildMeta(page, limit, total) };
  },

  async getInvoice(companyId: string, id: string) {
    const invoice = await Invoice.findOne({ _id: id, companyId }).populate('customerId');
    if (!invoice) throw new AppError('Invoice not found', 404);
    return invoice;
  },

  async createInvoice(companyId: string, userId: string, data: Record<string, unknown>) {
    const company = await Company.findById(companyId);
    if (!company) throw new AppError('Company not found', 404);

    const invoiceNumber = `${company.invoiceSettings.prefix}-${String(company.invoiceSettings.nextNumber).padStart(4, '0')}`;
    company.invoiceSettings.nextNumber += 1;
    await company.save();

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

    return Invoice.create({
      ...data,
      companyId,
      invoiceNumber,
      createdBy: userId,
      templateSnapshot,
    });
  },

  async updateInvoice(companyId: string, id: string, data: Record<string, unknown>) {
    const invoice = await Invoice.findOneAndUpdate({ _id: id, companyId }, data, { new: true });
    if (!invoice) throw new AppError('Invoice not found', 404);
    return invoice;
  },

  async duplicateInvoice(companyId: string, userId: string, id: string) {
    const original = await Invoice.findOne({ _id: id, companyId });
    if (!original) throw new AppError('Invoice not found', 404);
    const company = await Company.findById(companyId);
    const invoiceNumber = `${company!.invoiceSettings.prefix}-${String(company!.invoiceSettings.nextNumber).padStart(4, '0')}`;
    company!.invoiceSettings.nextNumber += 1;
    await company!.save();

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
    const invoice = await Invoice.findOneAndDelete({ _id: id, companyId });
    if (!invoice) throw new AppError('Invoice not found', 404);
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

    const method =
      data.method === 'email' || data.method === 'whatsapp' ? data.method : 'link';
    const token = crypto.randomBytes(24).toString('hex');
    const share = {
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
    return {
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      templateSnapshot: invoice.templateSnapshot,
      customerSnapshot: invoice.customerSnapshot,
      totals: invoice.totals,
      issueDate: invoice.issueDate,
      companyName: company?.name ?? 'Company',
      showMadeWithInvogen: access?.showMadeWithInvogen === true,
    };
  },

  async getReports(companyId: string, type: string, query: Record<string, unknown>) {
    const match: Record<string, unknown> = { companyId };
    if (query.from) match.createdAt = { $gte: new Date(query.from as string) };
    if (query.to) match.createdAt = { ...((match.createdAt as object) || {}), $lte: new Date(query.to as string) };

    switch (type) {
      case 'sales':
        return Invoice.aggregate([
          { $match: match },
          { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$totals.total' } } },
        ]);
      case 'gst':
        return Invoice.aggregate([
          { $match: match },
          { $group: { _id: null, totalTax: { $sum: '$totals.tax' }, totalSales: { $sum: '$totals.total' } } },
        ]);
      case 'customers':
        return Customer.find({ companyId }).select('name email createdAt');
      case 'products':
        return Product.find({ companyId }).select('name price stock category');
      case 'outstanding':
        return Invoice.find({ companyId, status: { $in: ['sent', 'overdue', 'partial'] } });
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
    const status = await subscriptionService.getStatus(companyId);
    const access = await getCompanyPlanAccess(companyId);
    return {
      ...status,
      canAddTemplate: access ? access.canAddTemplate : true,
      templateAccessConfigured: access?.templateAccessConfigured === true,
      allowedTemplateIds: access?.templateAccessConfigured ? access.templateIds : null,
      showMadeWithInvogen: access?.showMadeWithInvogen === true,
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

    await platformInvoiceService.issueAndEmailSubscriptionInvoice({
      companyId,
      userId,
      paymentId: payment._id.toString(),
      subscriptionId: subscription._id.toString(),
      planId: plan._id.toString(),
      orderId: data.orderId,
      pricing: discountMeta,
    });

    return { subscription, payment };
  },
};
