import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import {
  getFieldKindPlaceholder,
  resolveFieldKind,
  type FieldKind,
} from '@/lib/form-fields';
import type { PlaceholderContext } from '@/features/template-gallery/placeholder-utils';
import type { CustomerRecord } from './apply-invoice-form';
import {
  getComposerCardFieldPlaceholder,
  getComposerCardPropRawValue,
  type ScannedCard,
} from './invoice-document';

interface InvoiceCardFormSectionProps {
  card: ScannedCard;
  pages: { id: string; elements: { id: string; props?: Record<string, unknown> }[] }[];
  formContext: PlaceholderContext;
  onFormContextChange: (key: string, value: string) => void;
  onCardPropChange: (pageId: string, elementId: string, key: string, value: string) => void;
  onDeleteStandardField: (pageId: string, elementId: string, fieldKey: string, formContextKey?: string) => void;
  onAddCustomField: (pageId: string, elementId: string) => void;
  onUpdateCustomField: (
    pageId: string,
    elementId: string,
    fieldId: string,
    patch: { label?: string; value?: string }
  ) => void;
  onDeleteCustomField: (pageId: string, elementId: string, fieldId: string) => void;
  customers?: CustomerRecord[];
  selectedCustomerId?: string;
  onSelectCustomer?: (customerId: string) => void;
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

function CardFieldInput({
  label,
  value,
  onChange,
  multiline,
  fieldKind,
  placeholder,
  onDelete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  fieldKind?: FieldKind;
  placeholder?: string;
  onDelete?: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        {onDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={onDelete}
            title={`Remove ${label}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
      {multiline ? (
        <textarea
          className="min-h-[88px] w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          fieldKind={fieldKind}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function customFieldValuePlaceholder(label: string): string {
  const kind = resolveFieldKind({ label });
  if (kind) return getFieldKindPlaceholder(kind) ?? 'Enter value';
  return 'Enter value';
}

export function InvoiceCardFormSection({
  card,
  pages,
  formContext,
  onFormContextChange,
  onCardPropChange,
  onDeleteStandardField,
  onAddCustomField,
  onUpdateCustomField,
  onDeleteCustomField,
  customers = [],
  selectedCustomerId = '',
  onSelectCustomer,
}: InvoiceCardFormSectionProps) {
  const resolveValue = (field: ScannedCard['fields'][number]): string => {
    if (field.valueSource === 'formContext' && field.formContextKey) {
      return formContext[field.formContextKey] ?? '';
    }
    return getComposerCardPropRawValue(pages, card.pageId, card.elementId, field.key) ?? '';
  };

  const resolvePlaceholder = (field: ScannedCard['fields'][number]): string => {
    if (field.placeholder) return field.placeholder;
    return getComposerCardFieldPlaceholder(card.elementType, field.key, field.label);
  };

  const handleFieldChange = (field: ScannedCard['fields'][number], value: string) => {
    if (field.valueSource === 'formContext' && field.formContextKey) {
      onFormContextChange(field.formContextKey, value);
      return;
    }
    onCardPropChange(card.pageId, card.elementId, field.key, value);
  };

  const subtitle =
    card.elementType === 'customer_card'
      ? 'Who is this invoice for?'
      : card.elementType === 'company_card'
        ? 'Your company details on the invoice'
        : 'Payment information shown on the invoice';

  return (
    <FormSection title={card.sectionTitle} subtitle={subtitle}>
      {card.showCustomerPicker && onSelectCustomer ? (
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

      {card.fields.map((field) => (
        <CardFieldInput
          key={`${card.elementId}-${field.key}`}
          label={field.label}
          value={resolveValue(field)}
          onChange={(value) => handleFieldChange(field, value)}
          multiline={field.multiline}
          placeholder={resolvePlaceholder(field)}
          fieldKind={resolveFieldKind({
            propKey: field.key.startsWith('__placeholder_') ? undefined : field.key,
            placeholderKey: field.formContextKey,
            label: field.label,
          })}
          onDelete={() =>
            onDeleteStandardField(card.pageId, card.elementId, field.key, field.formContextKey)
          }
        />
      ))}

      {card.customFields.map((field) => {
        const fieldKind = resolveFieldKind({ label: field.label });
        const valuePlaceholder = customFieldValuePlaceholder(field.label);
        return (
          <div
            key={field.id}
            className="space-y-2 rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Custom field
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => onDeleteCustomField(card.pageId, card.elementId, field.id)}
                title="Remove field"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Input
              label="Field name"
              value={field.label}
              onChange={(e) =>
                onUpdateCustomField(card.pageId, card.elementId, field.id, {
                  label: e.target.value,
                })
              }
              placeholder="e.g. GSTIN, Mobile, Department"
            />
            <CardFieldInput
              label="Value"
              value={field.value}
              onChange={(value) =>
                onUpdateCustomField(card.pageId, card.elementId, field.id, { value })
              }
              fieldKind={fieldKind}
              placeholder={valuePlaceholder}
            />
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => onAddCustomField(card.pageId, card.elementId)}
      >
        <Plus className="h-4 w-4" />
        Add field
      </Button>
    </FormSection>
  );
}
