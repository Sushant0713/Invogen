import mongoose from 'mongoose';
import { Payment, Company, Plan, PlanDiscount, Subscription } from '../models';
import { getPagination, buildMeta } from '../utils/response';
import {
  buildRevenueDateMatch,
  getRevenueGroupFormat,
  mapRevenueAggregation,
  resolveRevenueGroupBy,
} from '../utils/revenue-aggregation';

function buildDiscountPaymentMatch(query: Record<string, unknown>) {
  const match = buildRevenueDateMatch(query) as Record<string, unknown>;
  match['metadata.discountAmount'] = { $gt: 0 };

  if (query.companyId && typeof query.companyId === 'string') {
    match.companyId = new mongoose.Types.ObjectId(query.companyId);
  }

  if (query.discountCode && typeof query.discountCode === 'string') {
    match['metadata.discountCode'] = query.discountCode.trim().toUpperCase();
  }

  return match;
}

type PaymentRow = {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  createdAt: Date;
  metadata?: {
    discountCode?: string;
    discountId?: string;
    discountAmount?: number;
    originalAmount?: number;
  };
  subscriptionId?: mongoose.Types.ObjectId;
};

async function enrichPaymentRows(rows: PaymentRow[]) {
  if (!rows.length) return [];

  const companyIds = [...new Set(rows.map((r) => r.companyId.toString()))];
  const subscriptionIds = rows
    .map((r) => r.subscriptionId?.toString())
    .filter((id): id is string => Boolean(id));

  const [companies, subscriptions] = await Promise.all([
    Company.find({ _id: { $in: companyIds } }).select('name').lean(),
    subscriptionIds.length
      ? Subscription.find({ _id: { $in: subscriptionIds } }).select('planId').lean()
      : Promise.resolve([]),
  ]);

  const planIds = [
    ...new Set(
      subscriptions
        .map((s) => s.planId?.toString())
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const plans = planIds.length
    ? await Plan.find({ _id: { $in: planIds } }).select('name billingCycle').lean()
    : [];

  const companyMap = new Map(companies.map((c) => [c._id.toString(), c.name]));
  const subPlanMap = new Map(
    subscriptions.map((s) => [s._id.toString(), s.planId?.toString()])
  );
  const planMap = new Map(
    plans.map((p) => [p._id.toString(), { name: p.name, billingCycle: p.billingCycle }])
  );

  return rows.map((row) => {
    const planId = row.subscriptionId ? subPlanMap.get(row.subscriptionId.toString()) : undefined;
    const plan = planId ? planMap.get(planId) : undefined;
    return {
      _id: row._id.toString(),
      companyId: row.companyId.toString(),
      companyName: companyMap.get(row.companyId.toString()) || '—',
      planId: planId || null,
      planName: plan?.name || '—',
      billingCycle: plan?.billingCycle || null,
      discountCode: row.metadata?.discountCode || '—',
      discountAmount: row.metadata?.discountAmount ?? 0,
      originalAmount: row.metadata?.originalAmount ?? 0,
      amountPaid: row.amount,
      currency: row.currency,
      createdAt: row.createdAt,
    };
  });
}

export const superAdminDiscountReportService = {
  async getFilters() {
    const [companies, coupons, plans] = await Promise.all([
      Company.find().select('name').sort({ name: 1 }).lean(),
      PlanDiscount.find().select('code name').sort({ name: 1 }).lean(),
      Plan.find({ isActive: true }).select('name billingCycle').sort({ name: 1 }).lean(),
    ]);

    return {
      companies: companies.map((c) => ({ _id: c._id.toString(), name: c.name })),
      coupons: coupons.map((d) => ({ _id: d._id.toString(), code: d.code, name: d.name })),
      plans: plans.map((p) => ({
        _id: p._id.toString(),
        name: p.name,
        billingCycle: p.billingCycle,
      })),
    };
  },

  async getReport(query: Record<string, unknown>) {
    const match = buildDiscountPaymentMatch(query);
    const groupBy = resolveRevenueGroupBy(
      query.groupBy,
      query.from as string,
      query.to as string
    );
    const groupFormat = getRevenueGroupFormat(groupBy);
    const planIdFilter =
      typeof query.planId === 'string' && query.planId.trim() ? query.planId.trim() : null;

    const basePipeline: mongoose.PipelineStage[] = [
      { $match: match },
      {
        $lookup: {
          from: 'subscriptions',
          localField: 'subscriptionId',
          foreignField: '_id',
          as: 'subscription',
        },
      },
      { $unwind: { path: '$subscription', preserveNullAndEmptyArrays: true } },
    ];

    if (planIdFilter) {
      basePipeline.push({
        $match: {
          'subscription.planId': new mongoose.Types.ObjectId(planIdFilter),
        },
      });
    }

    const { page, limit, skip } = getPagination(query.page as number, query.limit as number);

    const [seriesRows, statsRows, ledgerRows, totalLedger] = await Promise.all([
      Payment.aggregate([
        ...basePipeline,
        {
          $group: {
            _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
            total: { $sum: '$metadata.discountAmount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Payment.aggregate([
        ...basePipeline,
        {
          $group: {
            _id: null,
            totalDiscount: { $sum: '$metadata.discountAmount' },
            redemptionCount: { $sum: 1 },
            totalOriginal: { $sum: '$metadata.originalAmount' },
            totalPaid: { $sum: '$amount' },
          },
        },
      ]),
      Payment.aggregate([
        ...basePipeline,
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            companyId: 1,
            amount: 1,
            currency: 1,
            createdAt: 1,
            metadata: 1,
            subscriptionId: 1,
          },
        },
      ]),
      Payment.aggregate([...basePipeline, { $count: 'total' }]),
    ]);

    const stats = statsRows[0] as
      | {
          totalDiscount: number;
          redemptionCount: number;
          totalOriginal: number;
          totalPaid: number;
        }
      | undefined;

    const totalDiscount = stats?.totalDiscount ?? 0;
    const redemptionCount = stats?.redemptionCount ?? 0;

    const ledger = await enrichPaymentRows(ledgerRows as PaymentRow[]);
    const total = (totalLedger[0] as { total?: number } | undefined)?.total ?? 0;

    return {
      series: mapRevenueAggregation(
        seriesRows as { _id: string; total: number; count: number }[]
      ),
      groupBy,
      totalDiscount,
      redemptionCount,
      averageDiscount: redemptionCount > 0 ? Math.round(totalDiscount / redemptionCount) : 0,
      totalOriginal: stats?.totalOriginal ?? 0,
      totalPaid: stats?.totalPaid ?? 0,
      from: (query.from as string) || null,
      to: (query.to as string) || null,
      ledger,
      ledgerMeta: buildMeta(page, limit, total),
    };
  },
};
