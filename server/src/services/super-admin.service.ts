import { UserRole, UserStatus, ADMIN_PERMISSIONS, SubscriptionStatus } from '@invogen/shared';
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
import { ACTIVITY_USER_POPULATE } from './activity.service';
import { subscriptionService } from './subscription.service';
import { createBlankTemplate } from '../seeds/data/templates';

const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIAL,
  SubscriptionStatus.PAST_DUE,
]);

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
    const [clients, subscriptions, revenue, invoices, plans] = await Promise.all([
      User.countDocuments({ role: UserRole.ADMIN }),
      Subscription.countDocuments({ status: 'active' }),
      Payment.aggregate([{ $match: { status: 'captured' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Invoice.countDocuments(),
      Plan.find({ isActive: true }).limit(5),
    ]);

    const recentPayments = await Payment.find({ status: 'captured' })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('companyId', 'name');

    const recentInvoices = await Invoice.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('companyId', 'name');

    const activities = await ActivityLog.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', ACTIVITY_USER_POPULATE);

    return {
      stats: {
        clients,
        activeSubscriptions: subscriptions,
        totalRevenue: revenue[0]?.total || 0,
        totalInvoices: invoices,
      },
      recentPayments,
      recentInvoices,
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
  }) {
    const existing = await User.findOne({ email: data.email });
    if (existing) throw new AppError('Email already registered', 409);

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

    user.companyId = company._id;
    await user.save();

    if (data.planId) {
      await subscriptionService.assignPlanByAdmin(company._id.toString(), data.planId);
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
    const filter = buildTemplateListFilter([{ isSystem: true }], query);
    const [data, total] = await Promise.all([
      InvoiceTemplate.find(filter).select(templateListProjection).skip(skip).limit(limit).sort({ updatedAt: -1 }),
      InvoiceTemplate.countDocuments(filter),
    ]);
    return { data, meta: buildMeta(page, limit, total) };
  },

  async getTemplate(id: string) {
    const template = await InvoiceTemplate.findOne({ _id: id, isSystem: true });
    if (!template) throw new AppError('Template not found', 404);
    return template;
  },

  async createTemplate(userId: string, data: Record<string, unknown>) {
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    const category = typeof data.category === 'string' ? data.category.trim() : '';
    if (!name) throw new AppError('Template name is required', 400);
    if (!category) throw new AppError('Category is required', 400);

    const existing = await InvoiceTemplate.findOne({ category, isSystem: true });
    if (existing) throw new AppError('A template with this category already exists', 409);

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
    if (data.category !== undefined) update.category = data.category;
    if (data.description !== undefined) update.description = data.description;
    if (data.thumbnail !== undefined) update.thumbnail = data.thumbnail;

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
    const match: Record<string, unknown> = { status: 'captured' };
    if (query.from) match.createdAt = { $gte: new Date(query.from as string) };
    const revenue = await Payment.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const total = await Payment.aggregate([
      { $match: { status: 'captured' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    return { monthly: revenue, total: total[0]?.total || 0 };
  },

  async getInvoices(query: Record<string, unknown>) {
    const { page, limit, skip } = getPagination(query.page as number, query.limit as number);
    const [data, total] = await Promise.all([
      Invoice.find().skip(skip).limit(limit).populate('companyId', 'name').sort({ createdAt: -1 }),
      Invoice.countDocuments(),
    ]);
    return { data, meta: buildMeta(page, limit, total) };
  },

  async getActivityLogs(query: Record<string, unknown>) {
    const { page, limit, skip } = getPagination(query.page as number, query.limit as number);
    const [data, total] = await Promise.all([
      ActivityLog.find()
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .populate('userId', ACTIVITY_USER_POPULATE),
      ActivityLog.countDocuments(),
    ]);
    return { data, meta: buildMeta(page, limit, total) };
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
    const ticket = await SupportTicket.findByIdAndUpdate(id, data, { new: true });
    if (!ticket) throw new AppError('Ticket not found', 404);
    return ticket;
  },

  async getSettings(scope = 'system') {
    return Setting.find({ scope });
  },

  async updateSetting(key: string, value: unknown, scope = 'system') {
    const result = await Setting.findOneAndUpdate({ key, scope }, { value }, { upsert: true, new: true });

    if (key === 'company_profile' && value && typeof value === 'object') {
      const maintenanceMode = (value as { maintenanceMode?: boolean }).maintenanceMode === true;
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
    const admins = await User.find({ role: UserRole.ADMIN });
    const notifications = admins.map((admin) => ({
      userId: admin._id,
      companyId: admin.companyId,
      title: data.title,
      message: data.message,
      type: data.type || 'info',
    }));
    return Notification.insertMany(notifications);
  },
};
