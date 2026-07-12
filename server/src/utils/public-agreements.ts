import { Setting } from '../models';

export type PublicAgreementDocument = {
  title: string;
  version: string;
  content: string;
};

export type PublicAgreements = {
  terms: PublicAgreementDocument;
  privacy: PublicAgreementDocument;
};

const DEFAULT_TERMS: PublicAgreementDocument = {
  title: 'Terms & Conditions',
  version: '1.0',
  content: 'Terms & Conditions are being updated. Please contact support for details.',
};

const DEFAULT_PRIVACY: PublicAgreementDocument = {
  title: 'Privacy Policy',
  version: '1.0',
  content: 'Privacy Policy is being updated. Please contact support for details.',
};

type LegacyDoc = {
  title?: string;
  version?: string;
  content?: string;
  inputMode?: string;
  templateContent?: string;
  fieldValues?: Record<string, string>;
};

function pickDocument(raw: LegacyDoc | undefined, fallback: PublicAgreementDocument): PublicAgreementDocument {
  if (!raw) return fallback;
  const title = raw.title?.trim() || fallback.title;
  const version = raw.version?.trim() || fallback.version;
  let content = raw.content?.trim() || '';
  if (!content && raw.inputMode === 'template' && raw.templateContent?.trim()) {
    const fields = raw.fieldValues || {};
    content = Object.entries({ ...fields, title, version }).reduce(
      (text, [key, value]) => text.replaceAll(`{{${key}}}`, value || `{{${key}}}`),
      raw.templateContent
    );
  }
  if (!content) content = fallback.content;
  return { title, version, content };
}

export async function getPublicAgreements(): Promise<PublicAgreements> {
  const row = await Setting.findOne({ key: 'agreement_settings', scope: 'system' }).lean();
  const raw = row?.value;

  if (!raw || typeof raw !== 'object') {
    return { terms: DEFAULT_TERMS, privacy: DEFAULT_PRIVACY };
  }

  const record = raw as Record<string, unknown>;

  if ('documents' in record && record.documents && typeof record.documents === 'object') {
    const docs = record.documents as { terms?: LegacyDoc; privacy?: LegacyDoc };
    return {
      terms: pickDocument(docs.terms, DEFAULT_TERMS),
      privacy: pickDocument(docs.privacy, DEFAULT_PRIVACY),
    };
  }

  return {
    terms: pickDocument(record as LegacyDoc, DEFAULT_TERMS),
    privacy: DEFAULT_PRIVACY,
  };
}
