export interface CompanyProfileForAgreement {
  name: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
}

export type AgreementDocumentType = 'terms' | 'privacy';

export const AGREEMENT_DOCUMENT_OPTIONS: { id: AgreementDocumentType; label: string }[] = [
  { id: 'terms', label: 'Terms & Conditions' },
  { id: 'privacy', label: 'Privacy Policy' },
];

export interface AgreementDocument {
  title: string;
  version: string;
  content: string;
}

export interface AgreementSettingsStore {
  activeDocument: AgreementDocumentType;
  documents: Record<AgreementDocumentType, AgreementDocument>;
}

const DEFAULT_TERMS_CONTENT = `Terms & Conditions — Version 1.0

This Agreement is entered into between the Provider and the subscribing client ("Client").

1. Services
The Provider agrees to deliver invoicing, billing, and business management software services through the Invogen platform.

2. Client obligations
The Client agrees to provide accurate information, maintain account security, and use the platform in compliance with applicable laws.

3. Payment
Subscription fees are billed as per the selected plan. Taxes may apply based on the Client's location.

4. Contact
For support or legal queries, contact the Provider using the details on the company profile.

5. Governing law
This Agreement is governed by applicable local laws.`;

const DEFAULT_PRIVACY_CONTENT = `Privacy Policy — Version 1.0

We operate the Invogen platform. This Privacy Policy explains how we collect, use, and protect your information.

1. Information we collect
We collect account details, billing information, and usage data necessary to provide our services.

2. How we use information
We use your information to deliver the platform, process payments, provide support, and improve our services.

3. Data sharing
We do not sell your personal data. We may share data with payment processors and infrastructure providers as required to operate the service.

4. Contact
For privacy questions, contact us using the details on the company profile.

5. Governing law
This policy is governed by applicable local laws.`;

function defaultTitleFor(type: AgreementDocumentType): string {
  return AGREEMENT_DOCUMENT_OPTIONS.find((o) => o.id === type)?.label ?? 'Terms & Conditions';
}

function defaultContentFor(type: AgreementDocumentType): string {
  return type === 'privacy' ? DEFAULT_PRIVACY_CONTENT : DEFAULT_TERMS_CONTENT;
}

export function defaultAgreementDocument(type: AgreementDocumentType): AgreementDocument {
  return {
    title: defaultTitleFor(type),
    version: '1.0',
    content: defaultContentFor(type),
  };
}

export function defaultAgreementSettingsStore(): AgreementSettingsStore {
  return {
    activeDocument: 'terms',
    documents: {
      terms: defaultAgreementDocument('terms'),
      privacy: defaultAgreementDocument('privacy'),
    },
  };
}

type LegacyFieldValues = {
  company_name?: string;
  company_email?: string;
  company_phone?: string;
  company_address?: string;
  effective_date?: string;
  jurisdiction?: string;
};

type LegacyAgreementDocument = Partial<AgreementDocument> & {
  inputMode?: 'manual' | 'template' | 'upload';
  templateContent?: string;
  fieldValues?: LegacyFieldValues;
  file?: string;
  filename?: string;
};

function resolveLegacyTemplate(
  template: string,
  fields: LegacyFieldValues,
  meta: { title: string; version: string }
): string {
  const replacements: Record<string, string> = {
    ...fields,
    title: meta.title,
    version: meta.version,
    company_address: (fields.company_address || '').replace(/\n/g, ', '),
  };
  return Object.entries(replacements).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value || `{{${key}}}`),
    template
  );
}

function isLegacyAgreementDocument(raw: Record<string, unknown>): boolean {
  return 'inputMode' in raw && !('documents' in raw);
}

export function hydrateAgreementDocument(
  raw: LegacyAgreementDocument | undefined,
  type: AgreementDocumentType,
  company: CompanyProfileForAgreement
): AgreementDocument {
  const defaults = defaultAgreementDocument(type);
  const title = raw?.title?.trim() || defaults.title;
  const version = raw?.version?.trim() || defaults.version;

  let content = raw?.content?.trim() || '';

  if (!content && raw?.inputMode === 'template' && raw.templateContent?.trim()) {
    const fieldValues: LegacyFieldValues = {
      ...raw.fieldValues,
      company_name: raw.fieldValues?.company_name || company.name,
      company_email: raw.fieldValues?.company_email || company.email,
      company_phone: raw.fieldValues?.company_phone || company.phone,
      company_address:
        raw.fieldValues?.company_address ||
        [company.street, company.city, company.state, company.country, company.zipCode]
          .filter(Boolean)
          .join(', '),
      jurisdiction: raw.fieldValues?.jurisdiction || company.state || company.country || 'India',
      effective_date:
        raw.fieldValues?.effective_date || new Date().toISOString().split('T')[0],
    };
    content = resolveLegacyTemplate(raw.templateContent, fieldValues, { title, version });
  }

  if (!content) {
    content = defaults.content;
  }

  return { title, version, content };
}

export function hydrateAgreementSettingsStore(
  raw: unknown,
  company: CompanyProfileForAgreement
): AgreementSettingsStore {
  const defaults = defaultAgreementSettingsStore();

  if (!raw || typeof raw !== 'object') {
    return defaults;
  }

  const record = raw as Record<string, unknown>;

  if (isLegacyAgreementDocument(record)) {
    return {
      activeDocument: 'terms',
      documents: {
        terms: hydrateAgreementDocument(record as LegacyAgreementDocument, 'terms', company),
        privacy: hydrateAgreementDocument(undefined, 'privacy', company),
      },
    };
  }

  const activeDocument =
    record.activeDocument === 'privacy' ? 'privacy' : defaults.activeDocument;
  const documents = record.documents as
    | Partial<Record<AgreementDocumentType, LegacyAgreementDocument>>
    | undefined;

  return {
    activeDocument,
    documents: {
      terms: hydrateAgreementDocument(documents?.terms, 'terms', company),
      privacy: hydrateAgreementDocument(documents?.privacy, 'privacy', company),
    },
  };
}

export function updateAgreementStoreDocument(
  store: AgreementSettingsStore,
  patch: Partial<AgreementDocument>
): AgreementSettingsStore {
  const active = store.activeDocument;
  return {
    ...store,
    documents: {
      ...store.documents,
      [active]: { ...store.documents[active], ...patch },
    },
  };
}
