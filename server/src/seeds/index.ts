import bcrypt from 'bcryptjs';
import { UserRole, ComponentType, ADMIN_PERMISSIONS, PERMISSIONS } from '@invogen/shared';
import { parseDiscountEndDate, parseDiscountStartDate } from '@invogen/shared';
import { connectDB } from '../config/db';
import {
  User,
  Role,
  Permission,
  PlanType,
  PlanFeature,
  PlanDiscount,
  Component,
  InvoiceTemplate,
  Setting,
} from '../models';
import { syncPlansFromType } from '../services/plan-management.service';
import { env } from '../config/env';
import { templateCategories } from './data/template-categories';
import { componentCatalog } from './data/components';
import { createBlankTemplate } from './data/templates';

const seedPermissions = async () => {
  const permissions = Object.entries(PERMISSIONS).map(([key, value]) => ({
    key: value,
    name: key.replace(/_/g, ' ').toLowerCase(),
    module: value.split('.')[0],
  }));

  for (const perm of permissions) {
    await Permission.findOneAndUpdate({ key: perm.key }, perm, { upsert: true });
  }
};

const seedRoles = async () => {
  const allPerms = Object.values(PERMISSIONS);
  await Role.findOneAndUpdate(
    { slug: 'super_admin' },
    { name: 'Super Admin', slug: 'super_admin', permissions: allPerms },
    { upsert: true }
  );
  await Role.findOneAndUpdate(
    { slug: 'admin' },
    { name: 'Admin', slug: 'admin', permissions: allPerms },
    { upsert: true }
  );
  await Role.findOneAndUpdate(
    { slug: 'employee' },
    {
      name: 'Employee',
      slug: 'employee',
      permissions: ['invoice.create', 'invoice.view', 'template.view'],
    },
    { upsert: true }
  );
};

const seedSuperAdmin = async () => {
  const existing = await User.findOne({ role: UserRole.SUPER_ADMIN });
  if (existing) return existing;

  const passwordHash = await bcrypt.hash(env.SUPER_ADMIN_PASSWORD, 12);
  return User.create({
    email: env.SUPER_ADMIN_EMAIL,
    passwordHash,
    firstName: 'Super',
    lastName: 'Admin',
    role: UserRole.SUPER_ADMIN,
    permissions: ADMIN_PERMISSIONS,
    isEmailVerified: true,
    companyId: null,
  });
};

const seedPlanFeatures = async () => {
  const features = [
    { name: '5 Users', key: 'users_5', description: 'Up to 5 team members' },
    { name: 'Unlimited Invoices', key: 'unlimited_invoices', description: 'No invoice limit' },
    { name: 'All Templates', key: 'all_templates', description: 'Access all invoice templates' },
    { name: 'Priority Support', key: 'priority_support', description: '24/7 priority support' },
    { name: 'Advanced Reports', key: 'advanced_reports', description: 'Full analytics suite' },
    { name: 'API Access', key: 'api_access', description: 'REST API access' },
  ];
  const ids: string[] = [];
  for (const f of features) {
    const doc = await PlanFeature.findOneAndUpdate({ key: f.key }, f, { upsert: true, new: true });
    ids.push(doc._id.toString());
  }
  return ids;
};

const seedPlanTypes = async (featureIds: string[]) => {
  const businessFeatures = featureIds.slice(0, 4);
  const companyFeatures = featureIds;

  const types = [
    {
      name: 'Business Plan',
      description: 'For small businesses, freelancers, and startups',
      pricingModel: 'subscription' as const,
      monthlyPrice: 999,
      yearlyPrice: 9999,
      featureIds: businessFeatures,
    },
    {
      name: 'Company Plan',
      description: 'For medium and large organizations',
      pricingModel: 'both' as const,
      monthlyPrice: 2999,
      yearlyPrice: 29999,
      lifetimePrice: 99999,
      maintenanceCharge: 9999,
      featureIds: companyFeatures,
    },
  ];

  for (const t of types) {
    const slug = t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const planType = await PlanType.findOneAndUpdate({ slug }, { ...t, slug, currency: 'INR' }, { upsert: true, new: true });
    await syncPlansFromType(planType);
  }
};

const seedPlanDiscounts = async () => {
  const businessType = await PlanType.findOne({ slug: 'business-plan' });
  const scheduledStart = parseDiscountStartDate(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
  );
  const scheduledEnd = parseDiscountEndDate(
    new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString()
  );

  const discounts = [
    {
      name: 'Launch Offer',
      code: 'LAUNCH20',
      description: '20% off for new subscribers during launch period',
      discountType: 'percentage' as const,
      value: 20,
      billingCycle: 'all' as const,
      maxUses: 100,
      isActive: true,
    },
    {
      name: 'Yearly Saver',
      code: 'YEARLY500',
      description: 'Flat ₹500 off on yearly plans',
      discountType: 'fixed' as const,
      value: 500,
      billingCycle: 'yearly' as const,
      planTypeId: businessType?._id,
      isActive: true,
    },
    {
      name: 'Lifetime Deal',
      code: 'LIFETIME10',
      description: '10% off lifetime purchases',
      discountType: 'percentage' as const,
      value: 10,
      billingCycle: 'lifetime' as const,
      isActive: true,
    },
    {
      name: 'Summer Sale',
      code: 'SUMMER15',
      description: '15% off all plans — scheduled for upcoming season',
      discountType: 'percentage' as const,
      value: 15,
      billingCycle: 'all' as const,
      startDate: scheduledStart,
      endDate: scheduledEnd,
      isActive: true,
    },
  ];

  for (const discount of discounts) {
    await PlanDiscount.findOneAndUpdate({ code: discount.code }, discount, { upsert: true, new: true });
  }
};

const seedComponents = async () => {
  for (const comp of componentCatalog) {
    await Component.findOneAndUpdate({ type: comp.type, name: comp.name }, comp, { upsert: true });
  }
};

const seedTemplates = async (superAdminId: string) => {
  for (const category of templateCategories) {
    const existing = await InvoiceTemplate.findOne({ category, isSystem: true });
    if (!existing) {
      await InvoiceTemplate.create({
        name: `${category} Invoice`,
        category,
        pages: createBlankTemplate(category),
        isSystem: true,
        createdBy: superAdminId,
        version: 1,
      });
    }
  }
};

const seedSettings = async () => {
  await Setting.findOneAndUpdate(
    { key: 'maintenance_mode', scope: 'system' },
    { key: 'maintenance_mode', value: false, scope: 'system', description: 'Enable maintenance mode' },
    { upsert: true }
  );
  await Setting.findOneAndUpdate(
    { key: 'jwt_access_expires', scope: 'auth' },
    { key: 'jwt_access_expires', value: '15m', scope: 'auth' },
    { upsert: true }
  );
  await Setting.findOneAndUpdate(
    { key: 'company_profile', scope: 'system' },
    {
      key: 'company_profile',
      scope: 'system',
      description: 'Platform company profile',
      value: {
        name: 'Invogen Technologies Pvt. Ltd.',
        email: 'hello@invogen.app',
        phone: '+91 98765 43210',
        gst: '29AABCU9603R1ZM',
        pan: 'AABCU9603R',
        street: '123 Business Park',
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        zipCode: '560001',
        maintenanceMode: false,
        logo: '',
        signature: '',
      },
    },
    { upsert: true }
  );
  await Setting.findOneAndUpdate(
    { key: 'made_with_advertising', scope: 'system' },
    {
      key: 'made_with_advertising',
      scope: 'system',
      description: 'Image shown on "Made with" plan advertising badges',
      value: {
        image: '',
        imageFilename: '',
      },
    },
    { upsert: true }
  );
  await Setting.findOneAndUpdate(
    { key: 'agreement_settings', scope: 'system' },
    {
      key: 'agreement_settings',
      scope: 'system',
      description: 'Platform agreement documents (terms and privacy)',
      value: {
        activeDocument: 'terms',
        documents: {
          terms: {
            title: 'Terms & Conditions',
            version: '1.0',
            content: `Terms & Conditions — Version 1.0

This Agreement is entered into between Invogen Technologies Pvt. Ltd. ("Provider") and the subscribing client ("Client").

1. Services
The Provider agrees to deliver invoicing, billing, and business management software services through the Invogen platform.

2. Client obligations
The Client agrees to provide accurate information, maintain account security, and use the platform in compliance with applicable laws.

3. Payment
Subscription fees are billed as per the selected plan. Taxes may apply based on the Client's location.

4. Contact
For support or legal queries, contact hello@invogen.app or call +91 98765 43210.

5. Registered address
123 Business Park, Bengaluru, Karnataka, India, 560001

6. Governing law
This Agreement is governed by the laws of Karnataka.`,
          },
          privacy: {
            title: 'Privacy Policy',
            version: '1.0',
            content: `Privacy Policy — Version 1.0

Invogen Technologies Pvt. Ltd. ("we", "us", or "our") operates the Invogen platform. This Privacy Policy explains how we collect, use, and protect your information.

1. Information we collect
We collect account details, billing information, and usage data necessary to provide our services.

2. How we use information
We use your information to deliver the platform, process payments, provide support, and improve our services.

3. Data sharing
We do not sell your personal data. We may share data with payment processors and infrastructure providers as required to operate the service.

4. Contact
For privacy questions, contact hello@invogen.app or call +91 98765 43210.

5. Registered address
123 Business Park, Bengaluru, Karnataka, India, 560001

6. Governing law
This policy is governed by the laws of Karnataka.`,
          },
        },
      },
    },
    { upsert: true }
  );
  await Setting.findOneAndUpdate(
    { key: 'tax_settings', scope: 'system' },
    {
      key: 'tax_settings',
      scope: 'system',
      description: 'Platform default tax configuration',
      value: {
        isEnabled: true,
        taxLabel: 'GST',
        defaultRate: 18,
        cgstRate: 9,
        sgstRate: 9,
        igstRate: 18,
        includeInPrice: false,
      },
    },
    { upsert: true }
  );
  await Setting.findOneAndUpdate(
    { key: 'invoice_settings', scope: 'system' },
    {
      key: 'invoice_settings',
      scope: 'system',
      description: 'Platform invoice defaults',
      value: {
        invoiceTitle: 'INVOICE',
        prefix: 'INV',
        numberFormat: '{PREFIX}-{YYYY}-{NNNNN}',
        nextNumber: 187,
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        dateFormat: 'DD MMMM YYYY',
        defaultDueDays: 7,
        seller: {
          name: 'Invogen Technologies Pvt. Ltd.',
          addressLine1: '501, Business Hub Tower',
          addressLine2: 'Andheri East',
          city: 'Mumbai',
          state: 'Maharashtra',
          zipCode: '400069',
          country: 'India',
          gstin: '27AABCI5678K1Z2',
          pan: 'AABCI5678K',
          email: 'billing@invogen.com',
          phone: '+91 98765 43210',
          website: 'https://www.invogen.com',
        },
        bank: {
          bankName: 'HDFC Bank',
          accountName: 'Invogen Technologies Pvt. Ltd.',
          accountNumber: '50200012345678',
          ifscCode: 'HDFC0001234',
          upiId: 'invogen@hdfcbank',
        },
        paymentDueText: 'Within 7 Days',
        latePaymentNote: 'Late payment charges may apply after the due date.',
        subscriptionNote: 'Subscription services will continue as per the selected billing cycle.',
        termsAndConditions:
          'Payment is due within the specified due date. Late payments may incur additional charges. All subscription services continue per the selected billing cycle unless cancelled in writing.',
        thankYouNote: 'THANK YOU FOR YOUR BUSINESS',
        billingSupportEmail: 'billing@invogen.com',
        signatoryLabel: 'Authorized Signatory',
        signatoryFor: 'For Invogen Technologies Pvt. Ltd.',
        signatoryName: 'Authorized Signatory',
        signatoryTitle: 'Invogen Technologies Pvt. Ltd.',
        digitalSignatureNote: '(Digital Signature)',
        showGstSummary: true,
        showAmountInWords: true,
        enableRounding: true,
        showDiscount: true,
        defaultDiscount: 0,
        cgstRate: 9,
        sgstRate: 9,
      },
    },
    { upsert: true }
  );
  await Setting.findOneAndUpdate(
    { key: 'payment_settings', scope: 'system' },
    {
      key: 'payment_settings',
      scope: 'system',
      description: 'Platform payment configuration',
      value: {
        provider: 'razorpay',
        keyId: '',
        testMode: true,
        autoCapture: true,
        defaultCurrency: 'INR',
      },
    },
    { upsert: true }
  );
  await Setting.findOneAndUpdate(
    { key: 'email_settings', scope: 'system' },
    {
      key: 'email_settings',
      scope: 'system',
      description: 'Platform email SMTP configuration',
      value: {
        enabled: false,
        fromName: 'Invogen',
        fromEmail: 'noreply@invogen.app',
        smtpHost: 'localhost',
        smtpPort: 1025,
        smtpUser: '',
        smtpSecure: false,
      },
    },
    { upsert: true }
  );
  await Setting.findOneAndUpdate(
    { key: 'security_settings', scope: 'system' },
    {
      key: 'security_settings',
      scope: 'system',
      description: 'Platform security and auth settings',
      value: {
        jwtAccessExpires: '15m',
        jwtRefreshExpires: '7d',
        requireEmailVerification: true,
        maxLoginAttempts: 5,
        sessionTimeoutMinutes: 30,
        maintenanceMessage:
          'We are currently performing scheduled maintenance. Please check back soon.',
      },
    },
    { upsert: true }
  );
  await Setting.findOneAndUpdate(
    { key: 'notification_settings', scope: 'system' },
    {
      key: 'notification_settings',
      scope: 'system',
      description: 'Platform notification toggles',
      value: {
        welcomeEmail: true,
        invoiceCreated: true,
        paymentReceived: true,
        subscriptionRenewal: true,
        subscriptionExpired: true,
        subscriptionExpiringSoon: true,
        supportTicketUpdates: true,
      },
    },
    { upsert: true }
  );
};

const run = async () => {
  await connectDB();
  console.log('Seeding database...');

  await seedPermissions();
  await seedRoles();
  const superAdmin = await seedSuperAdmin();
  const featureIds = await seedPlanFeatures();
  await seedPlanTypes(featureIds);
  await seedPlanDiscounts();
  await seedComponents();
  await seedTemplates(superAdmin._id.toString());
  await seedSettings();

  console.log('Seed completed!');
  console.log(`Super Admin: ${env.SUPER_ADMIN_EMAIL}`);
  process.exit(0);
};

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
