import { Input } from '@/components/ui/Input';
import type { ScannedTextField } from './invoice-document';

interface InvoiceElementsFormSectionProps {
  fields: ScannedTextField[];
  onChange: (pageId: string, elementId: string, elementType: string, value: string) => void;
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

export function InvoiceElementsFormSection({ fields, onChange }: InvoiceElementsFormSectionProps) {
  if (fields.length === 0) return null;

  return (
    <FormSection title="Text & fields" subtitle="Editable text blocks from the template">
      {fields.map((field) =>
        field.multiline ? (
          <div key={field.elementId} className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              {field.label}
              <span className="ml-2 text-xs font-normal text-gray-400">{field.pageName}</span>
            </label>
            <textarea
              className="min-h-[88px] w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={field.value}
              onChange={(e) =>
                onChange(field.pageId, field.elementId, field.elementType, e.target.value)
              }
            />
          </div>
        ) : (
          <Input
            key={field.elementId}
            label={`${field.label} (${field.pageName})`}
            value={field.value}
            onChange={(e) =>
              onChange(field.pageId, field.elementId, field.elementType, e.target.value)
            }
          />
        )
      )}
    </FormSection>
  );
}
