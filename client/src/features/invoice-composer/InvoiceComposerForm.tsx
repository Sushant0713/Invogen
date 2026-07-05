import { Input } from '@/components/ui/Input';
import {
  extractPlaceholderKeys,
  isMultilinePlaceholder,
  placeholderFieldLabel,
  type PlaceholderContext,
} from '@/features/template-gallery/placeholder-utils';
import type { TemplatePage } from '@invogen/shared';
import type { CustomerRecord } from './apply-invoice-form';
import {
  scanComposerTables,
  scanComposerTextFields,
} from './invoice-document';
import { InvoicePagesSection } from './InvoicePagesSection';
import { InvoiceTableFormSection } from './InvoiceTableFormSection';
import { InvoiceElementsFormSection } from './InvoiceElementsFormSection';

const CUSTOMER_KEYS = new Set(['ClientName', 'Email', 'Phone', 'GST', 'Address', 'State']);
const INVOICE_DETAIL_KEYS = new Set(['InvoiceNumber', 'Date', 'DueDate']);
const COMPANY_KEYS = new Set(['CompanyName', 'PAN', 'PlaceOfSupply', 'StateCode']);

interface InvoiceComposerFormProps {
  pages: TemplatePage[];
  pageList: TemplatePage[];
  formContext: PlaceholderContext;
  onChange: (key: string, value: string) => void;
  onDeletePage: (pageId: string) => void;
  onTableCellChange: (
    pageId: string,
    elementId: string,
    rowId: string,
    columnId: string,
    value: string
  ) => void;
  onElementTextChange: (
    pageId: string,
    elementId: string,
    elementType: string,
    value: string
  ) => void;
  customers: CustomerRecord[];
  selectedCustomerId: string;
  onSelectCustomer: (customerId: string) => void;
  templates: { _id: string; name: string }[];
  selectedTemplateId: string;
  onSelectTemplate: (templateId: string) => void;
}

function FormSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p> : null}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  multiline,
  readOnly,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  readOnly?: boolean;
}) {
  if (multiline) {
    return (
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <textarea
          className="min-h-[88px] w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-50 disabled:text-gray-600"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={readOnly}
          disabled={readOnly}
        />
      </div>
    );
  }

  return (
    <Input
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
      disabled={readOnly}
    />
  );
}

export function InvoiceComposerForm({
  pages,
  pageList,
  formContext,
  onChange,
  onDeletePage,
  onTableCellChange,
  onElementTextChange,
  customers,
  selectedCustomerId,
  onSelectCustomer,
  templates,
  selectedTemplateId,
  onSelectTemplate,
}: InvoiceComposerFormProps) {
  const placeholderKeys = extractPlaceholderKeys(pages);
  const keysInTemplate = new Set(placeholderKeys);
  const scannedTables = scanComposerTables(pages);
  const scannedTextFields = scanComposerTextFields(pages);
  const totalKeys = new Set(['Subtotal', 'Tax', 'Total', 'Amount', 'CGST', 'SGST', 'GST']);
  const hasInvoiceTables = scannedTables.length > 0;

  const customerFieldList = ['ClientName', 'Address', 'GST', 'State', 'Email', 'Phone'];
  const invoiceFieldList = ['InvoiceNumber', 'Date', 'DueDate'];
  const companyFieldList = ['CompanyName', 'GST', 'PAN', 'PlaceOfSupply', 'StateCode'].filter(
    (key) => keysInTemplate.has(key)
  );
  const otherFieldList = placeholderKeys.filter(
    (key) =>
      !CUSTOMER_KEYS.has(key) &&
      !INVOICE_DETAIL_KEYS.has(key) &&
      !COMPANY_KEYS.has(key) &&
      !(hasInvoiceTables && totalKeys.has(key))
  );

  return (
    <div className="space-y-4">
      <InvoicePagesSection pages={pageList} onDeletePage={onDeletePage} />
      <FormSection title="Template" subtitle="Load a saved format">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Choose template</label>
          <select
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            value={selectedTemplateId}
            onChange={(e) => onSelectTemplate(e.target.value)}
          >
            {templates.map((template) => (
              <option key={template._id} value={template._id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>
      </FormSection>

      <FormSection title="1. Customer" subtitle="Who is this invoice for?">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Select from saved customers</label>
          <select
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            value={selectedCustomerId}
            onChange={(e) => onSelectCustomer(e.target.value)}
          >
            <option value="">Choose a customer…</option>
            {customers.map((customer) => (
              <option key={customer._id} value={customer._id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>
        {customerFieldList.map((key) => (
          <FieldInput
            key={key}
            label={placeholderFieldLabel(key)}
            value={formContext[key] ?? ''}
            onChange={(value) => onChange(key, value)}
            multiline={isMultilinePlaceholder(key)}
          />
        ))}
      </FormSection>

      {invoiceFieldList.length > 0 && (
        <FormSection title="2. Invoice details">
          {invoiceFieldList.map((key) => (
            <FieldInput
              key={key}
              label={placeholderFieldLabel(key)}
              value={formContext[key] ?? ''}
              onChange={(value) => onChange(key, value)}
            />
          ))}
        </FormSection>
      )}

      {companyFieldList.length > 0 && (
        <FormSection title="3. Company / supplier">
          {companyFieldList.map((key) => (
            <FieldInput
              key={key}
              label={placeholderFieldLabel(key)}
              value={formContext[key] ?? ''}
              onChange={(value) => onChange(key, value)}
              multiline={isMultilinePlaceholder(key)}
            />
          ))}
        </FormSection>
      )}

      {otherFieldList.length > 0 && (
        <FormSection title="4. Other placeholders">
          {otherFieldList.map((key) => (
            <FieldInput
              key={key}
              label={placeholderFieldLabel(key)}
              value={formContext[key] ?? ''}
              onChange={(value) => onChange(key, value)}
              multiline={isMultilinePlaceholder(key)}
            />
          ))}
        </FormSection>
      )}

      <InvoiceTableFormSection tables={scannedTables} onCellChange={onTableCellChange} />

      {hasInvoiceTables && (
        <FormSection title="Totals" subtitle="Calculated automatically from line items">
          {(['Subtotal', 'CGST', 'SGST', 'Total'] as const)
            .filter((key) => {
              const value = formContext[key];
              return value != null && value !== '';
            })
            .map((key) => (
              <FieldInput
                key={key}
                label={placeholderFieldLabel(key)}
                value={formContext[key] ?? ''}
                onChange={() => {}}
                readOnly
              />
            ))}
        </FormSection>
      )}

      <InvoiceElementsFormSection fields={scannedTextFields} onChange={onElementTextChange} />
    </div>
  );
}
