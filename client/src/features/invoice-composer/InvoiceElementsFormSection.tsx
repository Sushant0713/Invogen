import { Plus, Trash2 } from 'lucide-react';
import { ComponentType } from '@invogen/shared';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { DEFAULT_TERMS_TITLE } from '@/features/builder/terms-content';
import {
  footerLabel,
  termsLabel,
  type ScannedFooter,
  type ScannedTerms,
  type ScannedTextField,
} from './invoice-document';

interface InvoiceElementsFormSectionProps {
  fields: ScannedTextField[];
  footers: ScannedFooter[];
  terms: ScannedTerms[];
  showPageNames?: boolean;
  onChange: (pageId: string, elementId: string, elementType: string, value: string) => void;
  onAddFooter?: (pageId?: string) => void;
  onDeleteFooter?: (pageId: string, elementId: string) => void;
  onTermsTitleChange?: (pageId: string, elementId: string, title: string) => void;
  onTermsItemChange?: (pageId: string, elementId: string, itemIndex: number, value: string) => void;
  onAddTermsItem?: (pageId: string, elementId: string) => void;
  onDeleteTermsItem?: (pageId: string, elementId: string, itemIndex: number) => void;
  onAddTerms?: (pageId?: string) => void;
  onDeleteTerms?: (pageId: string, elementId: string) => void;
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

export function InvoiceElementsFormSection({
  fields,
  footers,
  terms,
  showPageNames = false,
  onChange,
  onAddFooter,
  onDeleteFooter,
  onTermsTitleChange,
  onTermsItemChange,
  onAddTermsItem,
  onDeleteTermsItem,
  onAddTerms,
  onDeleteTerms,
}: InvoiceElementsFormSectionProps) {
  const hasContent =
    fields.length > 0
    || footers.length > 0
    || terms.length > 0
    || onAddFooter
    || onAddTerms;

  if (!hasContent) return null;

  return (
    <FormSection title="Text & fields" subtitle="Editable text blocks from the template">
      {footers.map((footer) => (
        <div key={footer.elementId} className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="block text-sm font-medium text-gray-700">
              {footerLabel(footer, footers.length)}
              {showPageNames ? (
                <span className="ml-2 text-xs font-normal text-gray-400">{footer.pageName}</span>
              ) : null}
            </label>
            {onDeleteFooter ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => onDeleteFooter(footer.pageId, footer.elementId)}
                title={`Remove ${footerLabel(footer, footers.length)}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
          <Input
            value={footer.value}
            placeholder="Thank you for your business!"
            onChange={(e) =>
              onChange(footer.pageId, footer.elementId, ComponentType.FOOTER, e.target.value)
            }
          />
        </div>
      ))}

      {onAddFooter ? (
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => onAddFooter()}>
          <Plus className="h-4 w-4" />
          Add footer
        </Button>
      ) : null}

      {terms.map((block) => (
        <div
          key={block.elementId}
          className="space-y-3 rounded-lg border border-gray-100 bg-gray-50/60 p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-gray-700">
              {termsLabel(block, terms.length)}
              {showPageNames ? (
                <span className="ml-2 text-xs font-normal text-gray-400">{block.pageName}</span>
              ) : null}
            </p>
            {onDeleteTerms ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => onDeleteTerms(block.pageId, block.elementId)}
                title={`Remove ${termsLabel(block, terms.length)}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>

          {onTermsTitleChange ? (
            <Input
              label="Section title"
              value={block.title}
              placeholder={DEFAULT_TERMS_TITLE}
              onChange={(e) =>
                onTermsTitleChange(block.pageId, block.elementId, e.target.value)
              }
            />
          ) : null}

          <div className="space-y-2">
            {block.items.map((item, itemIndex) => (
              <div key={`${block.elementId}-${itemIndex}`} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-medium text-gray-600">
                    Term {itemIndex + 1}
                  </label>
                  {onDeleteTermsItem ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                      disabled={block.items.length <= 1 && !item.trim()}
                      onClick={() =>
                        onDeleteTermsItem(block.pageId, block.elementId, itemIndex)
                      }
                      title={`Remove term ${itemIndex + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
                <textarea
                  className="min-h-[72px] w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  value={item}
                  placeholder="Enter a term or condition…"
                  onChange={(e) =>
                    onTermsItemChange?.(
                      block.pageId,
                      block.elementId,
                      itemIndex,
                      e.target.value
                    )
                  }
                />
              </div>
            ))}
          </div>

          {onAddTermsItem ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => onAddTermsItem(block.pageId, block.elementId)}
            >
              <Plus className="h-4 w-4" />
              Add term
            </Button>
          ) : null}
        </div>
      ))}

      {onAddTerms ? (
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => onAddTerms()}>
          <Plus className="h-4 w-4" />
          Add terms & conditions
        </Button>
      ) : null}

      {fields.map((field) =>
        field.multiline ? (
          <div key={field.elementId} className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">{field.label}</label>
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
            label={field.label}
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
