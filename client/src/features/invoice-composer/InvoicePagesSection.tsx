import { Trash2 } from 'lucide-react';
import type { TemplatePage } from '@invogen/shared';
import { isPageBlank } from './invoice-document';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface InvoicePagesSectionProps {
  pages: TemplatePage[];
  onDeletePage: (pageId: string) => void;
}

export function InvoicePagesSection({ pages, onDeletePage }: InvoicePagesSectionProps) {
  if (pages.length <= 1 && !pages.some((page) => isPageBlank(page))) {
    return null;
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Pages</h3>
        <p className="mt-0.5 text-xs text-gray-500">
          Remove blank or unused pages from this invoice.
        </p>
      </div>
      <div className="space-y-2">
        {pages.map((page, index) => {
          const blank = isPageBlank(page);
          const canDelete = pages.length > 1;
          return (
            <div
              key={page.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-800">
                  {index + 1}. {page.name}
                </p>
                {blank ? (
                  <Badge variant="warning" className="mt-1">
                    Blank page
                  </Badge>
                ) : (
                  <p className="mt-0.5 text-xs text-gray-500">
                    {page.elements.filter((el) => el.visible !== false).length} elements
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={!canDelete}
                onClick={() => onDeletePage(page.id)}
                className="shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700 disabled:text-gray-400"
                title={canDelete ? `Delete ${page.name}` : 'At least one page is required'}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
