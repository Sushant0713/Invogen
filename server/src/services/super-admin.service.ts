import { UserRole, UserStatus, ADMIN_PERMISSIONS, SubscriptionStatus, InvoiceStatus } from '@invogen/shared';
import { notificationService } from './notification.service';
import { notifySupportTicketUpdated } from '../utils/notification-events';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import {
  User,
  Company,
  Payment,
  Invoice,
  Subscription,
  Plan,
  ActivityLog,
  SupportTicket,
  Notification,
  Setting,
  Component,
  InvoiceTemplate,
  Employee,
  Customer,
  Product,
  Media,
  AuditLog,
} from '../models';
import { AppError } from '../utils/AppError';
import { getPagination, buildMeta } from '../utils/response';
import { buildTemplateListFilter, templateListProjection } from '../utils/template-query';
import { ACTIVITY_USER_POPULATE, buildActivityLogSearchFilter } from './activity.service';
import { subscriptionService } from './subscription.service';
import { createBlankTemplate } from '../seeds/data/templates';
import { ensureCompanyInvoiceCode } from '../utils/company-invoice-code';
import {
  buildDailyRevenueSeriesForCurrentWeek,
  getCurrentWeekStart,
} from '../utils/weekly-revenue';
import {
  buildRevenueDateMatch,
  getRevenueGroupFormat,
  mapRevenueAggregation,
  resolveRevenueGroupBy,
} from '../utils/revenue-aggregation';
import { enrichInvoiceWithTotals } from '../utils/invoice-gst';
import { superAdminSalesReportService } from './super-admin-sales-report.service';
import { superAdminGstReportService } from './super-admin-gst-report.service';
import { superAdminClientsReportService } from './super-admin-clients-report.service';
import { superAdminPlansReportService } from './super-admin-plans-report.service';
import { superAdminOutstandingReportService } from './super-admin-outstanding-report.service';
import { superAdminAdminReportService } from './super-admin-admin-report.service';

export const SUPER_ADMIN_TEMPLATE_CATEGORY = 'Super Admin';
const LEGACY_SUPER_ADMIN_TEMPLATE_CATEGORY = '__super_admin__';

function normalizeTemplateCategory(category: string): string {
  const trimmed = category.trim();
  if (trimmed === LEGACY_SUPER_ADMIN_TEMPLATE_CATEGORY) return SUPER_ADMIN_TEMPLATE_CATEGORY;
  return trimmed;
}

function isSuperAdminTemplateCategory(category: string) {
  const trimmed = category.trim();
  return (
    trimmed === SUPER_ADMIN_TEMPLATE_CATEGORY || trimmed === LEGACY_SUPER_ADMIN_TEMPLATE_CATEGORY
  );
}

function superAdminCategoryScope(included: boolean) {
  const categories = [SUPER_ADMIN_TEMPLATE_CATEGORY, LEGACY_SUPER_ADMIN_TEMPLATE_CATEGORY];
  return included ? { category: { $in: categories } } : { category: { $nin: categories } };
}

const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIAL,
  SubscriptionStatus.PAST_DUE,
]);

/** Invogen subscription billing invoices only — excludes tenant customer invoices. */
const PLATFORM_INVOICE_FILTER = { 'customerSnapshot.platformInvoice': true } as const;

type InvoiceSnapshot = { platformInvoice?: boolean } | null | undefined;

function isPlatformInvoice(invoice: { customerSnapshot?: InvoiceSnapshot }) {
  const snap = invoice.customerSnapshot as InvoiceSnapshot;
  return snap?.platformInvoice === true;
}

function assertPlatformInvoice(invoice: { customerSnapshot?: InvoiceSnapshot } | null) {
  if (!invoice || !isPlatformInvoice(invoice)) {
    throw new AppError('Invoice not found', 404);
  }
}

function resolveCompanyId(
  companyRef: { _id?: { toString(): string }; toString?: () => string } | null | undefined
) {
  if (!companyRef) return null;
  if (typeof companyRef === 'object' && '_id' in companyRef && companyRef._id) {
    return companyRef._id.toString();
  }
  return companyRef.toString?.() || null;
}

function pickSubscriptionForCompany<T extends { status: string; createdAt?: Date }>(subs: T[]) {
  if (!subs.length) return null;
  const sorted = [...subs].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
  return (
    sorted.find((sub) => ACTIVE_SUBSCRIPTION_STATUSES.has(sub.status as SubscriptionStatus)) ||
    sorted[0]
  );
}

export const superAdminService = {
  async getDashboard() {
    const [clients, subscriptions, platformInvoices, plans, capturedRevenue] =
      await Promise.all([
      User.countDocuments({ role: UserRole.ADMIN }),
      Subscription.countDocuments({ status: 'active' }),
      Invoice.countDocuments(PLATFORM_INVOICE_FILTER),
      Plan.find({ isActive: true }).limit(5),
      Payment.aggregate([
        { $match: { status: 'captured' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    const currentWeekStart = getCurrentWeekStart();

    const [recentPayments, paymentsThisWeek] = await Promise.all([
      Payment.find({ status: 'captured' })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('companyId', 'name'),
      Payment.find({
        status: 'captured',
        createdAt: { $gte: currentWeekStart },
      })
        .select('amount createdAt')
        .lean(),
    ]);

    const weeklyRevenue = buildDailyRevenueSeriesForCurrentWeek(paymentsThisWeek);

    const activities = await ActivityLog.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', ACTIVITY_USER_POPULATE);

    return {
      stats: {
        clients,
        activeSubscriptions: subscriptions,
        actualRevenue: capturedRevenue[0]?.total || 0,
        totalInvoices: platformInvoices,
      },
      recentPayments,
      weeklyRevenue,
      topPlans: plans,
      recentActivities: activities,
    };
  },

  async getClientStats() {
    const [total, active, suspended, activeSubscriptions, trialSubscriptions] = await Promise.all([
      User.countDocuments({ role: UserRole.ADMIN }),
      User.countDocuments({ role: UserRole.ADMIN, status: UserStatus.ACTIVE }),
      User.countDocuments({ role: UserRole.ADMIN, status: UserStatus.SUSPENDED }),
      Subscription.countDocuments({ status: SubscriptionStatus.ACTIVE }),
      Subscription.countDocuments({ status: SubscriptionStatus.TRIAL }),
    ]);
    return { total, active, suspended, activeSubscriptions, trialSubscriptions };
  },

  async getClients(query: Record<string, unknown>) {
    const { page, limit, skip } = getPagination(query.page as number, query.limit as number);
    const filter: Record<string, unknown> = { role: UserRole.ADMIN };

    if (query.search) {
      const search = query.search as string;
      const companies = await Company.find({ name: { $regex: search, $options: 'i' } }).select('_id');
      const companyIds = companies.map((c) => c._id);
      filter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        ...(companyIds.length ? [{ companyId: { $in: companyIds } }] : []),
      ];
    }
    if (query.status) filter.status = query.status;

    const [users, total] = await Promise.all([
      User.find(filter).skip(skip).limit(limit).populate('companyId', 'name email phone').sort({ createdAt: -1 }),
      User.countDocuments(filter),
    ]);

    const companyIds = users
      .map((u) => {
        const ref = u.companyId as { _id?: { toString(): string } } | null;
        return ref?._id?.toString() || (u.companyId ? String(u.companyId) : null);
      })
      .filter(Boolean) as string[];

    const subscriptions = companyIds.length
      ? await Subscription.find({ companyId: { $in: companyIds } })
          .populate('planId', 'name billingCycle price currency')
          .sort({ createdAt: -1 })
      : [];

    const subsByCompany = new Map<string, (typeof subscriptions)[number][]>();
    for (const sub of subscriptions) {
      const cid = sub.companyId.toString();
      const list = subsByCompany.get(cid) || [];
      list.push(sub);
      subsByCompany.set(cid, list);
    }

    const companyObjectIds = companyIds.map((id) => new mongoose.Types.ObjectId(id));
    const revenueRows = companyObjectIds.length
      ? await Payment.aggregate([
          { $match: { companyId: { $in: companyObjectIds }, status: 'captured' } },
          { $group: { _id: '$companyId', total: { $sum: '$amount' } } },
        ])
      : [];
    const revenueByCompany = new Map(
      revenueRows.map((row: { _id: mongoose.Types.ObjectId; total: number }) => [
        row._id.toString(),
        row.total,
      ])
    );

    const data = users.map((u) => {
      const companyRef = u.companyId as {
        _id?: { toString(): string };
        name?: string;
        email?: string;
        phone?: string;
        toString?: () => string;
      } | null;
      const companyId = resolveCompanyId(companyRef);
      const companySubs = companyId ? subsByCompany.get(companyId) || [] : [];
      const subscription = pickSubscriptionForCompany(companySubs);
      const planDoc = subscription?.planId as {
        _id?: { toString(): string };
        name?: string;
        billingCycle?: string;
        price?: number;
        currency?: string;
      } | null;

      return {
        _id: u._id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        status: u.status,
        isEmailVerified: u.isEmailVerified,
        authProvider: u.authProvider || 'local',
        createdAt: u.createdAt,
        company: companyRef
          ? {
              _id: companyId,
              name: companyRef.name,
              email: companyRef.email,
              phone: companyRef.phone,
            }
          : null,
        subscription: subscription
          ? {
              _id: subscription._id,
              status: subscription.status,
              currentPeriodStart: subscription.currentPeriodStart,
              currentPeriodEnd: subscription.currentPeriodEnd,
              plan: planDoc
                ? {
                    _id: planDoc._id?.toString?.() || planDoc,
                    name: planDoc.name,
                    billingCycle: planDoc.billingCycle,
                    price: planDoc.price,
                    currency: planDoc.currency,
                  }
                : null,
            }
          : null,
        revenueCollected: companyId ? revenueByCompany.get(companyId) || 0 : 0,
      };
    });

    return { data, meta: buildMeta(page, limit, total) };
  },

  async getClient(id: string) {
    const user = await User.findOne({ _id: id, role: UserRole.ADMIN });
    if (!user) throw new AppError('Client not found', 404);

    const company = user.companyId ? await Company.findById(user.companyId) : null;
    if (!company) {
      return {
        user,
        company: null,
        subscription: null,
        stats: { employeeCount: 0, customerCount: 0, invoiceCount: 0, totalRevenue: 0 },
        payments: [],
        activities: [],
        employees: [],
      };
    }

    const companyId = company._id;
    const [
      subscription,
      employeeCount,
      customerCount,
      invoiceCount,
      revenueAgg,
      payments,
      activities,
      employees,
    ] = await Promise.all([
      subscriptionService.getLatestSubscription(companyId.toString()),
      Employee.countDocuments({ companyId }),
      Customer.countDocuments({ companyId }),
      Invoice.countDocuments({ companyId }),
      Payment.aggregate([
        { $match: { companyId, status: 'captured' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Payment.find({ companyId }).sort({ createdAt: -1 }).limit(15),
      ActivityLog.find({ companyId })
        .sort({ createdAt: -1 })
        .limit(25)
        .populate('userId', ACTIVITY_USER_POPULATE),
      Employee.find({ companyId }).populate('userId', 'firstName lastName email status'),
    ]);

    return {
      user,
      company,
      subscription,
      stats: {
        employeeCount,
        customerCount,
        invoiceCount,
        totalRevenue: revenueAgg[0]?.total || 0,
      },
      payments,
      activities,
      employees,
    };
  },

  async getClientRevenue(clientId: string) {
    const user = await User.findOne({ _id: clientId, role: UserRole.ADMIN });
    if (!user) throw new AppError('Client not found', 404);

    if (!user.companyId) {
      return {
        totalCollected: 0,
        capturedCount: 0,
        pendingCount: 0,
        failedCount: 0,
        averagePayment: 0,
        lastPaymentAt: null as Date | null,
        monthly: [] as { month: string; total: number; count: number }[],
        payments: [] as unknown[],
      };
    }

    const companyId = user.companyId;

    const [capturedAgg, statusBreakdown, monthly, payments] = await Promise.all([
      Payment.aggregate([
        { $match: { companyId, status: 'captured' } },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
            count: { $sum: 1 },
            lastAt: { $max: '$createdAt' },
          },
        },
      ]),
      Payment.aggregate([
        { $match: { companyId } },
        { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } },
      ]),
      Payment.aggregate([
        { $match: { companyId, status: 'captured' } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Payment.find({ companyId }).sort({ createdAt: -1 }).lean(),
    ]);

    const totalCollected = capturedAgg[0]?.total ?? 0;
    const capturedCount = capturedAgg[0]?.count ?? 0;
    const statusMap = Object.fromEntries(
      statusBreakdown.map((row: { _id: string; count: number }) => [row._id, row.count])
    );

    return {
      totalCollected,
      capturedCount,
      pendingCount: statusMap.pending ?? 0,
      failedCount: (statusMap.failed ?? 0) + (statusMap.refunded ?? 0),
      averagePayment: capturedCount > 0 ? Math.round(totalCollected / capturedCount) : 0,
      lastPaymentAt: capturedAgg[0]?.lastAt ?? null,
      monthly: monthly.map((row: { _id: string; total: number; count: number }) => ({
        month: row._id,
        total: row.total,
        count: row.count,
      })),
      payments,
    };
  },

  async createClient(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    companyName: string;
    planId?: string;
    paymentPaid?: boolean;
  }) {
    const existing = await User.findOne({ email: data.email });
    if (existing) throw new AppError('Email already registered', 409);

    if (data.paymentPaid && !data.planId) {
      throw new AppError('Select a subscription plan when marking payment as paid', 400);
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await User.create({
      email: data.email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      role: UserRole.ADMIN,
      permissions: ADMIN_PERMISSIONS,
      isEmailVerified: true,
    });

    const company = await Company.create({
      ownerId: user._id,
      name: data.companyName,
      email: data.email,
    });
    await ensureCompanyInvoiceCode(company);

    user.companyId = company._id;
    await user.save();

    if (data.planId) {
      const subscription = await subscriptionService.assignPlanByAdmin(company._id.toString(), data.planId);

      if (data.paymentPaid) {
        const plan = await Plan.findById(data.planId);
        if (!plan) throw new AppError('Plan not found', 404);

        await Payment.create({
          companyId: company._id,
          subscriptionId: subscription._id,
          amount: plan.price,
          currency: plan.currency || 'INR',
          status: 'captured',
          metadata: {
            source: 'super_admin_manual',
            planId: plan._id.toString(),
            planName: plan.name,
            billingCycle: plan.billingCycle,
          },
        });
      }
    }

    return this.getClient(user._id.toString());
  },

  async updateClient(
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      email?: string;
      status?: UserStatus;
      company?: { name?: string; email?: string; phone?: string; gst?: string; pan?: string };
    }
  ) {
    const user = await User.findOne({ _id: id, role: UserRole.ADMIN });
    if (!user) throw new AppError('Client not found', 404);

    if (data.email && data.email !== user.email) {
      const existing = await User.findOne({ email: data.email });
      if (existing) throw new AppError('Email already in use', 409);
      user.email = data.email;
    }
    if (data.firstName) user.firstName = data.firstName;
    if (data.lastName) user.lastName = data.lastName;
    if (data.status) user.status = data.status;
    await user.save();

    if (data.company && user.companyId) {
      await Company.findByIdAndUpdate(user.companyId, data.company);
    }

    return this.getClient(id);
  },

  async assignClientPlan(id: string, planId: string) {
    const user = await User.findOne({ _id: id, role: UserRole.ADMIN });
    if (!user?.companyId) throw new AppError('Client not found', 404);
    return subscriptionService.assignPlanByAdmin(user.companyId.toString(), planId);
  },

  async updateClientSubscription(id: string, status: SubscriptionStatus) {
    const user = await User.findOne({ _id: id, role: UserRole.ADMIN });
    if (!user?.companyId) throw new AppError('Client not found', 404);
    return subscriptionService.updateSubscriptionStatus(user.companyId.toString(), status);
  },

  async updateClientStatus(id: string, status: UserStatus) {
    const user = await User.findOneAndUpdate(
      { _id: id, role: UserRole.ADMIN },
      { status },
      { new: true }
    );
    if (!user) throw new AppError('Client not found', 404);
    return user;
  },

  async deleteClient(id: string) {
    const user = await User.findOne({ _id: id, role: UserRole.ADMIN });
    if (!user) throw new AppError('Client not found', 404);

    const companyId = user.companyId;
    if (!companyId) {
      await user.deleteOne();
      return;
    }

    const employees = await Employee.find({ companyId }).select('userId');
    const userIds = [user._id, ...employees.map((e) => e.userId)];

    await Promise.all([
      Employee.deleteMany({ companyId }),
      Customer.deleteMany({ companyId }),
      Product.deleteMany({ companyId }),
      Invoice.deleteMany({ companyId }),
      InvoiceTemplate.deleteMany({ companyId, isSystem: false }),
      Payment.deleteMany({ companyId }),
      Subscription.deleteMany({ companyId }),
      Notification.deleteMany({ companyId }),
      ActivityLog.deleteMany({ $or: [{ companyId }, { userId: { $in: userIds } }] }),
      AuditLog.deleteMany({ $or: [{ companyId }, { userId: { $in: userIds } }] }),
      SupportTicket.deleteMany({ $or: [{ companyId }, { userId: { $in: userIds } }] }),
      Setting.deleteMany({ companyId }),
      Media.deleteMany({ companyId }),
      User.deleteMany({ $or: [{ _id: user._id }, { companyId }] }),
    ]);

    await Company.findByIdAndDelete(companyId);
  },

  async getPlans() {
    return Plan.find().sort({ tier: 1, billingCycle: 1 });
  },

  async createPlan(data: Record<string, unknown>) {
    return Plan.create(data);
  },

  async updatePlan(id: string, data: Record<string, unknown>) {
    const plan = await Plan.findByIdAndUpdate(id, data, { new: true });
    if (!plan) throw new AppError('Plan not found', 404);
    return plan;
  },

  async deletePlan(id: string) {
    const plan = await Plan.findByIdAndDelete(id);
    if (!plan) throw new AppError('Plan not found', 404);
  },

  async getComponents() {
    return Component.find().sort({ category: 1, name: 1 });
  },

  async createComponent(data: Record<string, unknown>) {
    return Component.create(data);
  },

  async updateComponent(id: string, data: Record<string, unknown>) {
    const comp = await Component.findByIdAndUpdate(id, data, { new: true });
    if (!comp) throw new AppError('Component not found', 404);
    return comp;
  },

  async deleteComponent(id: string) {
    await Component.findByIdAndDelete(id);
  },

  async getTemplates(query: Record<string, unknown>) {
    const { page, limit, skip } = getPagination(query.page as number, query.limit as number);
    const baseConditions: Record<string, unknown>[] = [{ isSystem: true }];

    if (query.scope === 'super_admin') {
      baseConditions.push(superAdminCategoryScope(true));
    } else if (query.scope === 'standard') {
      baseConditions.push(superAdminCategoryScope(false));
    }

    const filter = buildTemplateListFilter(baseConditions, query);
    const [rows, total] = await Promise.all([
      InvoiceTemplate.find(filter).select(templateListProjection).skip(skip).limit(limit).sort({ updatedAt: -1 }),
      InvoiceTemplate.countDocuments(filter),
    ]);
    const data = rows.map((template) => {
      const plain = template.toObject();
      return { ...plain, category: normalizeTemplateCategory(plain.category) };
    });
    return { data, meta: buildMeta(page, limit, total) };
  },

  async getTemplate(id: string) {
    const template = await InvoiceTemplate.findOne({ _id: id, isSystem: true });
    if (!template) throw new AppError('Template not found', 404);
    const plain = template.toObject();
    return { ...plain, category: normalizeTemplateCategory(plain.category) };
  },

  async createTemplate(userId: string, data: Record<string, unknown>) {
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    const category = normalizeTemplateCategory(typeof data.category === 'string' ? data.category : '');
    if (!name) throw new AppError('Template name is required', 400);
    if (!category) throw new AppError('Category is required', 400);

    if (!isSuperAdminTemplateCategory(category)) {
      const existing = await InvoiceTemplate.findOne({ category, isSystem: true });
      if (existing) throw new AppError('A template with this category already exists', 409);
    }

    const pages = Array.isArray(data.pages) && data.pages.length > 0
      ? data.pages
      : createBlankTemplate(category);

    return InvoiceTemplate.create({
      name,
      category,
      description: typeof data.description === 'string' ? data.description.trim() : '',
      pages,
      isSystem: true,
      createdBy: userId,
      version: 1,
      isActive: true,
    });
  },

  async updateTemplate(id: string, data: Record<string, unknown>) {
    const update: Record<string, unknown> = {};
    if (data.pages !== undefined) update.pages = data.pages;
    if (data.name !== undefined) update.name = data.name;
    if (data.category !== undefined) {
      update.category = normalizeTemplateCategory(String(data.category));
    }
    if (data.description !== undefined) update.description = data.description;
    if (data.thumbnail !== undefined) update.thumbnail = data.thumbnail;

    if (typeof update.category === 'string' && !isSuperAdminTemplateCategory(update.category)) {
      const duplicate = await InvoiceTemplate.findOne({
        category: update.category,
        isSystem: true,
        _id: { $ne: id },
      });
      if (duplicate) throw new AppError('A template with this category already exists', 409);
    }

    const template = await InvoiceTemplate.findOneAndUpdate(
      { _id: id, isSystem: true },
      update,
      { new: true }
    );
    if (!template) throw new AppError('Template not found', 404);
    return template;
  },

  async deleteTemplate(id: string) {
    const template = await InvoiceTemplate.findOneAndDelete({ _id: id, isSystem: true });
    if (!template) throw new AppError('Template not found', 404);
  },

  async getRevenue(query: Record<string, unknown>) {
    const match = buildRevenueDateMatch(query);
    const groupBy = resolveRevenueGroupBy(query.groupBy, query.from as string, query.to as string);
    const groupFormat = getRevenueGroupFormat(groupBy);

    const [seriesRows, stats] = await Promise.all([
      Payment.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Payment.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    return {
      series: mapRevenueAggregation(seriesRows),
      groupBy,
      total: stats[0]?.total || 0,
      paymentCount: stats[0]?.count || 0,
      from: (query.from as string) || null,
      to: (query.to as string) || null,
    };
  },

  async getInvoice(id: string) {
    const invoice = await Invoice.findOne({ _id: id, ...PLATFORM_INVOICE_FILTER })
      .populate('companyId', 'name invoiceCode')
      .populate('customerId', 'name email');
    if (!invoice) throw new AppError('Invoice not found', 404);
    return enrichInvoiceWithTotals(invoice.toObject());
  },

  async getInvoices(query: Record<string, unknown>) {
    const { page, limit, skip } = getPagination(query.page as number, query.limit as number);
    const filter: Record<string, unknown> = { ...PLATFORM_INVOICE_FILTER };
    const createdAt: Record<string, Date> = {};

    if (query.from) {
      const from = new Date(query.from as string);
      from.setHours(0, 0, 0, 0);
      createdAt.$gte = from;
    }

    if (query.to) {
      const to = new Date(query.to as string);
      to.setHours(23, 59, 59, 999);
      createdAt.$lte = to;
    }

    if (Object.keys(createdAt).length > 0) {
      filter.createdAt = createdAt;
    }

    const sortOrder = query.sort === 'oldest' ? 1 : -1;

    const [data, total] = await Promise.all([
      Invoice.find(filter)
        .skip(skip)
        .limit(limit)
        .populate('companyId', 'name invoiceCode')
        .sort({ createdAt: sortOrder }),
      Invoice.countDocuments(filter),
    ]);

    return {
      data: data.map((invoice) => enrichInvoiceWithTotals(invoice.toObject())),
      meta: buildMeta(page, limit, total),
    };
  },

  async updateInvoiceStatus(id: string, status: InvoiceStatus) {
    const allowed = [InvoiceStatus.DRAFT, InvoiceStatus.SENT, InvoiceStatus.PAID];
    if (!allowed.includes(status)) {
      throw new AppError('Status must be draft, sent, or paid', 400);
    }

    const invoice = await Invoice.findById(id);
    if (!invoice) throw new AppError('Invoice not found', 404);
    assertPlatformInvoice(invoice);

    const statusRank: Partial<Record<InvoiceStatus, number>> = {
      [InvoiceStatus.DRAFT]: 0,
      [InvoiceStatus.SENT]: 1,
      [InvoiceStatus.PAID]: 2,
    };

    const currentRank = statusRank[invoice.status as InvoiceStatus];
    const nextRank = statusRank[status];

    if (invoice.status === InvoiceStatus.PAID && status !== InvoiceStatus.PAID) {
      throw new AppError('Paid invoices cannot be changed', 400);
    }

    if (
      currentRank !== undefined &&
      nextRank !== undefined &&
      nextRank < currentRank
    ) {
      throw new AppError('Invoice status cannot be moved backward', 400);
    }

    if (invoice.status === status) {
      return Invoice.findById(id)
        .populate('companyId', 'name')
        .select('invoiceNumber companyId status totals createdAt');
    }

    invoice.status = status;
    if (status === InvoiceStatus.SENT && !invoice.sentAt) {
      invoice.sentAt = new Date();
    }
    if (status === InvoiceStatus.PAID) {
      invoice.paidAt = new Date();
    }

    await invoice.save();
    return Invoice.findById(id).populate('companyId', 'name').select('invoiceNumber companyId status totals createdAt');
  },

  async deleteInvoice(id: string) {
    const invoice = await Invoice.findById(id);
    if (!invoice) throw new AppError('Invoice not found', 404);
    assertPlatformInvoice(invoice);
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new AppError('Only draft invoices can be deleted', 400);
    }

    await invoice.deleteOne();
    return { deleted: true };
  },

  async getActivityLogs(query: Record<string, unknown>) {
    const { page, limit, skip } = getPagination(query.page as number, query.limit as number);
    const filter = await buildActivityLogSearchFilter(query.search);
    const [data, total] = await Promise.all([
      ActivityLog.find(filter)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .populate('userId', ACTIVITY_USER_POPULATE),
      ActivityLog.countDocuments(filter),
    ]);
    return { data, meta: buildMeta(page, limit, total) };
  },

  async deleteActivityLogs(body: { ids?: string[]; all?: boolean; search?: string }) {
    if (body.all) {
      const filter = await buildActivityLogSearchFilter(body.search);
      const result = await ActivityLog.deleteMany(filter);
      return { deleted: result.deletedCount ?? 0 };
    }

    const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
    if (!ids.length) {
      throw new AppError('No activity logs selected', 400);
    }

    const objectIds = ids
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    if (!objectIds.length) {
      throw new AppError('No valid activity logs selected', 400);
    }

    const result = await ActivityLog.deleteMany({ _id: { $in: objectIds } });
    return { deleted: result.deletedCount ?? 0 };
  },

  async getSupportTickets(query: Record<string, unknown>) {
    const { page, limit, skip } = getPagination(query.page as number, query.limit as number);
    const [data, total] = await Promise.all([
      SupportTicket.find().skip(skip).limit(limit).sort({ createdAt: -1 }),
      SupportTicket.countDocuments(),
    ]);
    return { data, meta: buildMeta(page, limit, total) };
  },

  async updateTicket(id: string, data: Record<string, unknown>) {
    const existing = await SupportTicket.findById(id);
    if (!existing) throw new AppError('Ticket not found', 404);

    const ticket = await SupportTicket.findByIdAndUpdate(id, data, { new: true });
    if (!ticket) throw new AppError('Ticket not found', 404);

    const nextStatus = String(data.status ?? ticket.status);
    if (data.status && nextStatus !== existing.status) {
      notificationService.fire(
        notifySupportTicketUpdated({
          userId: String(ticket.userId),
          companyId: ticket.companyId ? String(ticket.companyId) : null,
          ticketId: ticket._id.toString(),
          subject: ticket.subject,
          status: nextStatus,
        })
      );
    }

    return ticket;
  },

  async getSettings(scope = 'system') {
    return Setting.find({ scope });
  },

  async updateSetting(key: string, value: unknown, scope = 'system') {
    const result = await Setting.findOneAndUpdate({ key, scope }, { value }, { upsert: true, new: true });

    if (key === 'company_profile' && value && typeof value === 'object') {
      const maintenanceMode =
        (value as { maintenanceMode?: unknown }).maintenanceMode === true ||
        (value as { maintenanceMode?: unknown }).maintenanceMode === 'true' ||
        (value as { maintenanceMode?: unknown }).maintenanceMode === 1 ||
        (value as { maintenanceMode?: unknown }).maintenanceMode === '1';
      await Setting.findOneAndUpdate(
        { key: 'maintenance_mode', scope },
        {
          key: 'maintenance_mode',
          value: maintenanceMode,
          scope,
          description: 'Enable maintenance mode',
        },
        { upsert: true }
      );
    }

    if (
      key === 'company_profile' ||
      key === 'security_settings' ||
      key === 'maintenance_mode'
    ) {
      const { maintenanceService } = await import('./maintenance.service');
      maintenanceService.clearCache();
    }

    return result;
  },

  async broadcastNotification(data: { title: string; message: string; type?: string }) {
    const payload = {
      title: data.title,
      message: data.message,
      type: (data.type as 'info' | 'success' | 'warning' | 'error') || 'info',
    };
    return notificationService.broadcastToCompanyAdmins(payload);
  },

  async getNotifications(userId: string) {
    return notificationService.getForUser(userId);
  },

  async getUnreadNotificationCount(userId: string) {
    return notificationService.getUnreadCount(userId);
  },

  async markNotificationRead(userId: string, id: string) {
    return notificationService.markRead(userId, id);
  },

  async markAllNotificationsRead(userId: string) {
    await notificationService.markAllRead(userId);
  },

  async getReports(type: string, query: Record<string, unknown>) {
    switch (type) {
      case 'sales':
        return superAdminSalesReportService.getSalesReport(query);
      case 'gst':
        return superAdminGstReportService.getGstReport(query);
      case 'clients':
        return superAdminClientsReportService.getClientsReport(query);
      case 'plans':
        return superAdminPlansReportService.getPlansReport(query);
      case 'outstanding':
        return superAdminOutstandingReportService.getOutstandingReport(query);
      case 'admin':
        return superAdminAdminReportService.getAdminInvoicesReport(query);
      default:
        throw new AppError('Report type not found', 404);
    }
  },
};
