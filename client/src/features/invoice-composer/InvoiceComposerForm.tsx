import { Input } from '@/components/ui/Input';
import { resolveFieldKind, type FieldKind } from '@/lib/form-fields';
import {
  isMultilinePlaceholder,
  placeholderFieldLabel,
  type PlaceholderContext,
} from '@/features/template-gallery/placeholder-utils';
import type { TemplatePage } from '@invogen/shared';
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
    product: { name: string; sku?: string; price?: number }
  ) => void;
  onAddTableRow?: (pageId: string, elementId: string) => void;
  onDeleteTableRow?: (pageId: string, elementId: string, rowId: string) => void;
  onTableDiscountModeChange?: (
    pageId: string,
    elementId: string,
    mode: 'amount' | 'percent'
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
  pages,
  pageList,
  formContext,
  onChange,
  onDeletePage,
  onTableCellChange,
  onTableProductPick,
  onAddTableRow,
  onDeleteTableRow,
  onTableDiscountModeChange,
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
}: InvoiceComposerFormProps) {
  const formModel = buildComposerFormModel(pages);

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

  return (
    <div className="space-y-4">
      <InvoicePagesSection pages={pageList} onDeletePage={onDeletePage} />

      {!hasEditableContent ? (
        <FormSection title="No editable fields" subtitle="This template has no editable content on the preview.">
          <p className="text-sm text-gray-500">
            Add text blocks, tables, or placeholders in the template builder to edit them here.
          </p>
        </FormSection>
      ) : null}

      {formModel.cards.map((card) => (
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
      ))}

      {formModel.otherPlaceholders.length > 0 ? (
        <FormSection
          title="Placeholders"
          subtitle="From text like <your name> — type the real values here."
        >
          {formModel.otherPlaceholders.map((key) => (
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

      {formModel.cards.length === 0 && formModel.customerFields.length > 0 ? (
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

      {formModel.invoiceFields.length > 0 ? (
        <FormSection title="Invoice details">
          {formModel.invoiceFields.map((key) => {
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

      {formModel.cards.length === 0 && formModel.companyFields.length > 0 ? (
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

      <InvoiceTableFormSection
        tables={formModel.tables}
        onCellChange={onTableCellChange}
        onProductPick={onTableProductPick}
        onAddRow={onAddTableRow}
        onDeleteRow={onDeleteTableRow}
        onDiscountModeChange={onTableDiscountModeChange}
      />

      <InvoiceElementsFormSection
        fields={formModel.textFields}
        footers={formModel.footers}
        terms={formModel.terms}
        showPageNames={pageList.length > 1}
        onChange={onElementTextChange}
        onAddFooter={onAddFooter}
        onDeleteFooter={onDeleteFooter}
        onTermsTitleChange={onTermsTitleChange}
        onTermsItemChange={onTermsItemChange}
        onAddTermsItem={onAddTermsItem}
        onDeleteTermsItem={onDeleteTermsItem}
        onAddTerms={onAddTerms}
        onDeleteTerms={onDeleteTerms}
      />
    </div>
  );
}
