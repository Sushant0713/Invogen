import { Children, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { resolveFieldKind, type FieldKind } from '@/lib/form-fields';
import { toIsoDateValue } from '@/lib/date-format';
import {
  isMultilinePlaceholder,
  placeholderFieldLabel,
  type PlaceholderContext,
} from '@/features/template-gallery/placeholder-utils';
import { ComponentType, type TemplatePage } from '@invogen/shared';
import type { CustomerRecord } from './apply-invoice-form';
import { buildComposerFormModel } from './invoice-document';
import { InvoicePagesSection } from './InvoicePagesSection';
import { InvoiceTableFormSection } from './InvoiceTableFormSection';
import { InvoiceElementsFormSection } from './InvoiceElementsFormSection';
import { InvoiceCardFormSection } from './InvoiceCardFormSection';

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
  onTableProductPick?: (
    pageId: string,
    elementId: string,
    rowId: string,
    columnId: string,
    product: {
      name: string;
      sku?: string;
      price?: number;
      discount?: number;
      discountType?: 'percentage' | 'fixed';
      gst?: number;
      tax?: number;
    }
  ) => void;
  onAddTableRow?: (pageId: string, elementId: string) => void;
  onDeleteTableRow?: (pageId: string, elementId: string, rowId: string) => void;
  onTableDiscountModeChange?: (
    pageId: string,
    elementId: string,
    mode: 'amount' | 'percent'
  ) => void;
  onTableAmountInWordsChange?: (
    pageId: string,
    elementId: string,
    enabled: boolean
  ) => void;
  onElementTextChange: (
    pageId: string,
    elementId: string,
    elementType: string,
    value: string
  ) => void;
  onAddFooter?: (pageId?: string) => void;
  onDeleteFooter?: (pageId: string, elementId: string) => void;
  onTermsTitleChange?: (pageId: string, elementId: string, title: string) => void;
  onTermsItemChange?: (pageId: string, elementId: string, itemIndex: number, value: string) => void;
  onAddTermsItem?: (pageId: string, elementId: string) => void;
  onDeleteTermsItem?: (pageId: string, elementId: string, itemIndex: number) => void;
  onAddTerms?: (pageId?: string) => void;
  onDeleteTerms?: (pageId: string, elementId: string) => void;
  onCardPropChange: (pageId: string, elementId: string, key: string, value: string) => void;
  onDeleteCardStandardField: (
    pageId: string,
    elementId: string,
    fieldKey: string,
    formContextKey?: string
  ) => void;
  onToggleCardStandardField: (
    pageId: string,
    elementId: string,
    fieldKey: string,
    hidden: boolean
  ) => void;
  onUpdateCardCustomField: (
    pageId: string,
    elementId: string,
    fieldId: string,
    patch: { label?: string; value?: string }
  ) => void;
  onDeleteCardCustomField: (pageId: string, elementId: string, fieldId: string) => void;
  onToggleCardCustomField: (
    pageId: string,
    elementId: string,
    fieldId: string,
    hidden: boolean
  ) => void;
  customers: CustomerRecord[];
  selectedCustomerId: string;
  onSelectCustomer: (customerId: string) => void;
  /** When false, hides page delete controls (settings preview). */
  showPageManagement?: boolean;
}

function FormSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
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

function FormGroup({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const items = Children.toArray(children);
  if (items.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? <div className="space-y-4 border-t border-gray-100 px-4 pb-4 pt-3">{items}</div> : null}
    </div>
  );
}

function isDefaultFormCard(elementType: string): boolean {
  return (
    elementType === ComponentType.COMPANY_CARD
    || elementType === ComponentType.PAYMENT_DETAILS
  );
}

function isPaymentPlaceholderKey(key: string): boolean {
  return key.startsWith('Bank') || key === 'PaymentTitle';
}

function FieldInput({
  label,
  value,
  onChange,
  multiline,
  fieldKind,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  fieldKind?: FieldKind;
}) {
  const placeholder = `Enter ${label.toLowerCase()}`;
  if (multiline) {
    return (
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <textarea
          className="min-h-[88px] w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  return (
    <Input
      label={label}
      fieldKind={fieldKind}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function InvoiceComposerForm({
  pages: _pages,
  pageList,
  formContext,
  onChange,
  onDeletePage,
  onTableCellChange,
  onTableProductPick,
  onAddTableRow,
  onDeleteTableRow,
  onTableDiscountModeChange,
  onTableAmountInWordsChange,
  onElementTextChange,
  onAddFooter,
  onDeleteFooter,
  onTermsTitleChange,
  onTermsItemChange,
  onAddTermsItem,
  onDeleteTermsItem,
  onAddTerms,
  onDeleteTerms,
  onCardPropChange,
  onDeleteCardStandardField,
  onToggleCardStandardField,
  onUpdateCardCustomField,
  onDeleteCardCustomField,
  onToggleCardCustomField,
  customers,
  selectedCustomerId,
  onSelectCustomer,
  showPageManagement = true,
}: InvoiceComposerFormProps) {
  // Scan tables from working pages (pageList) — same document edits/pick write to.
  // `pages` is recalculated display output and can remint row ids after add-row,
  // which makes rate/discount picks miss the target row (name still looks filled locally).
  const formModel = buildComposerFormModel(pageList);
  const hasInvoiceDate = formModel.invoiceFields.includes('Date');
  const hasDueDate = formModel.invoiceFields.includes('DueDate');
  const invoiceOtherFields = formModel.invoiceFields.filter(
    (key) => key !== 'Date' && key !== 'DueDate'
  );
  const defaultCards = formModel.cards.filter((card) => isDefaultFormCard(card.elementType));
  const editCards = formModel.cards.filter((card) => !isDefaultFormCard(card.elementType));
  const paymentPlaceholders = formModel.otherPlaceholders.filter(isPaymentPlaceholderKey);
  const editPlaceholders = formModel.otherPlaceholders.filter((key) => !isPaymentPlaceholderKey(key));
  const showStandaloneCustomer =
    formModel.cards.length === 0 && formModel.customerFields.length > 0;
  const showStandaloneCompany =
    formModel.cards.length === 0 && formModel.companyFields.length > 0;

  const hasEditableContent =
    formModel.cards.length > 0
    || formModel.customerFields.length > 0
    || formModel.invoiceFields.length > 0
    || formModel.companyFields.length > 0
    || formModel.otherPlaceholders.length > 0
    || formModel.tables.length > 0
    || formModel.textFields.length > 0
    || formModel.footers.length > 0
    || formModel.terms.length > 0
    || onAddFooter
    || onAddTerms;

  const renderCard = (card: (typeof formModel.cards)[number]) => (
    <InvoiceCardFormSection
      key={card.elementId}
      card={card}
      pages={pageList}
      formContext={formContext}
      onFormContextChange={onChange}
      onCardPropChange={onCardPropChange}
      onDeleteStandardField={onDeleteCardStandardField}
      onToggleStandardField={onToggleCardStandardField}
      onUpdateCustomField={onUpdateCardCustomField}
      onDeleteCustomField={onDeleteCardCustomField}
      onToggleCustomField={onToggleCardCustomField}
      customers={customers}
      selectedCustomerId={selectedCustomerId}
      onSelectCustomer={card.showCustomerPicker ? onSelectCustomer : undefined}
    />
  );

  return (
    <div className="space-y-4">
      {showPageManagement ? (
        <InvoicePagesSection pages={pageList} onDeletePage={onDeletePage} />
      ) : null}

      {!hasEditableContent ? (
        <FormSection title="No editable fields" subtitle="This template has no editable content on the preview.">
          <p className="text-sm text-gray-500">
            Add text blocks, tables, or placeholders in the template builder to edit them here.
          </p>
        </FormSection>
      ) : null}

      <FormGroup title="Default form">
        {defaultCards.map(renderCard)}

        {showStandaloneCompany ? (
          <FormSection title="Company / supplier">
            {formModel.companyFields.map((key) => (
              <FieldInput
                key={key}
                label={placeholderFieldLabel(key)}
                value={formContext[key] ?? ''}
                onChange={(value) => onChange(key, value)}
                multiline={isMultilinePlaceholder(key)}
                fieldKind={resolveFieldKind({ placeholderKey: key, label: placeholderFieldLabel(key) })}
              />
            ))}
          </FormSection>
        ) : null}

        {paymentPlaceholders.length > 0 ? (
          <FormSection
            title="Payment details"
            subtitle="Prefilled from company settings — edit here if needed."
          >
            {paymentPlaceholders.map((key) => (
              <FieldInput
                key={key}
                label={placeholderFieldLabel(key)}
                value={formContext[key] ?? ''}
                onChange={(value) => onChange(key, value)}
                multiline={isMultilinePlaceholder(key)}
                fieldKind={resolveFieldKind({ placeholderKey: key, label: placeholderFieldLabel(key) })}
              />
            ))}
          </FormSection>
        ) : null}

        <InvoiceElementsFormSection
          fields={formModel.textFields}
          footers={formModel.footers}
          terms={formModel.terms}
          showPageNames={pageList.length > 1}
          onChange={onElementTextChange}
          onDeleteFooter={onDeleteFooter}
          onTermsTitleChange={onTermsTitleChange}
          onTermsItemChange={onTermsItemChange}
          onAddTermsItem={onAddTermsItem}
          onDeleteTermsItem={onDeleteTermsItem}
          onDeleteTerms={onDeleteTerms}
        />
      </FormGroup>

      <FormGroup title="Edit form" defaultOpen>
        {editCards.map(renderCard)}

        {hasInvoiceDate || hasDueDate ? (
          <FormSection
            title="Invoice dates"
            subtitle="These update the date fields on the live preview. Due date cannot be before invoice date."
          >
            {hasInvoiceDate ? (
              <Input
                label="Invoice date"
                fieldKind="date"
                value={toIsoDateValue(formContext.Date ?? '')}
                onChange={(e) => onChange('Date', e.target.value)}
              />
            ) : null}
            {hasDueDate ? (
              <Input
                label="Due date"
                fieldKind="date"
                value={toIsoDateValue(formContext.DueDate ?? '')}
                min={toIsoDateValue(formContext.Date ?? '') || undefined}
                onChange={(e) => onChange('DueDate', e.target.value)}
              />
            ) : null}
          </FormSection>
        ) : null}

        {invoiceOtherFields.length > 0 ? (
          <FormSection title="Invoice details">
            {invoiceOtherFields.map((key) => {
              const dataField = formModel.dataFields.find((field) => field.key === key);
              return (
                <FieldInput
                  key={key}
                  label={dataField?.label ?? placeholderFieldLabel(key)}
                  value={formContext[key] ?? ''}
                  onChange={(value) => onChange(key, value)}
                  fieldKind={resolveFieldKind({ placeholderKey: key, label: dataField?.label ?? placeholderFieldLabel(key) })}
                />
              );
            })}
          </FormSection>
        ) : null}

        {editPlaceholders.length > 0 ? (
          <FormSection
            title="Placeholders"
            subtitle="From text like <your name> — type the real values here."
          >
            {editPlaceholders.map((key) => (
              <FieldInput
                key={key}
                label={placeholderFieldLabel(key)}
                value={formContext[key] ?? ''}
                onChange={(value) => onChange(key, value)}
                multiline={isMultilinePlaceholder(key)}
                fieldKind={resolveFieldKind({ placeholderKey: key, label: placeholderFieldLabel(key) })}
              />
            ))}
          </FormSection>
        ) : null}

        {showStandaloneCustomer ? (
          <FormSection title="Customer" subtitle="Who is this invoice for?">
            {formModel.showCustomerPicker ? (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  Select from saved customers
                </label>
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
            ) : null}
            {formModel.customerFields.map((key) => (
              <FieldInput
                key={key}
                label={placeholderFieldLabel(key)}
                value={formContext[key] ?? ''}
                onChange={(value) => onChange(key, value)}
                multiline={isMultilinePlaceholder(key)}
                fieldKind={resolveFieldKind({ placeholderKey: key, label: placeholderFieldLabel(key) })}
              />
            ))}
          </FormSection>
        ) : null}

        <InvoiceTableFormSection
          tables={formModel.tables}
          onCellChange={onTableCellChange}
          onProductPick={onTableProductPick}
          onAddRow={onAddTableRow}
          onDeleteRow={onDeleteTableRow}
          onDiscountModeChange={onTableDiscountModeChange}
          onAmountInWordsChange={onTableAmountInWordsChange}
        />
      </FormGroup>
    </div>
  );
}
