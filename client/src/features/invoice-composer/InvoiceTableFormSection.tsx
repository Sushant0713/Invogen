import { Input } from '@/components/ui/Input';
import type { ScannedTable } from './invoice-document';
import { isTableCellEditableForRow } from './invoice-document';

interface InvoiceTableFormSectionProps {
  tables: ScannedTable[];
  onCellChange: (
    pageId: string,
    elementId: string,
    rowId: string,
    columnId: string,
    value: string
  ) => void;
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
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function InvoiceTableFormSection({ tables, onCellChange }: InvoiceTableFormSectionProps) {
  if (tables.length === 0) return null;

  return (
    <>
      {tables.map((table, tableIndex) => (
        <FormSection
          key={table.elementId}
          title={`${tables.length > 1 ? `${tableIndex + 1}. ` : ''}${table.label}`}
          subtitle={`${table.pageName} · ${table.tableKind} · ${table.rows.length} row${table.rows.length === 1 ? '' : 's'}`}
        >
          {table.rows.map((row, rowIndex) => (
            <div key={row.id} className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Row {rowIndex + 1}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {table.columns.map((col) => {
                  const editable = isTableCellEditableForRow(
                    table.elementType,
                    col.id,
                    row,
                    col.columnType,
                    col.label
                  );
                  const isSerial = col.columnType === 'sr_no';
                  const cellValue = isSerial
                    ? String(rowIndex + 1)
                    : (row.cells[col.id] ?? '');

                  return (
                    <Input
                      key={col.id}
                      label={col.label}
                      value={cellValue}
                      disabled={!editable}
                      onChange={(e) =>
                        onCellChange(
                          table.pageId,
                          table.elementId,
                          row.id,
                          col.id,
                          e.target.value
                        )
                      }
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </FormSection>
      ))}
    </>
  );
}
