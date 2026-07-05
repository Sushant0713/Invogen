import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  ADDRESS_DETAIL_FIELDS,
  DEFAULT_ADDRESS_TITLE,
  type AddressData,
  buildAddressProps,
  parseAddressFromProps,
} from './address-content';

interface Props {
  props: Record<string, unknown>;
  onChange: (nextProps: Record<string, unknown>, recordHistory?: boolean) => void;
}

export function AddressProperties({ props, onChange }: Props) {
  const data = parseAddressFromProps(props);

  const commit = (next: AddressData, recordHistory = false) => {
    onChange(buildAddressProps(next, props), recordHistory);
  };

  const updateTitle = (title: string) => {
    commit({ ...data, title }, false);
  };

  const updateLine = (index: number, value: string) => {
    const lines = data.lines.map((line, i) => (i === index ? value : line));
    commit({ ...data, lines }, false);
  };

  const updateDetail = (key: keyof Pick<AddressData, 'city' | 'state' | 'postalCode' | 'country'>, value: string) => {
    commit({ ...data, [key]: value }, false);
  };

  const addLine = () => {
    commit({ ...data, lines: [...data.lines, ''] }, true);
  };

  const removeLine = (index: number) => {
    if (data.lines.length <= 1) {
      commit({ ...data, lines: [''] }, true);
      return;
    }
    commit(
      { ...data, lines: data.lines.filter((_, i) => i !== index) },
      true
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-gray-50/90 p-3 space-y-2">
        <label className="text-xs font-semibold text-gray-700">Address</label>
        <input
          type="text"
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
          value={data.title}
          placeholder={DEFAULT_ADDRESS_TITLE}
          onChange={(e) => updateTitle(e.target.value)}
          onBlur={(e) => commit({ ...data, title: e.target.value }, true)}
        />
        <p className="text-[11px] text-gray-400">
          Section heading shown above the address on the invoice.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-gray-600">Street lines</span>
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus className="h-3.5 w-3.5" />
            Add line
          </Button>
        </div>

        <div className="space-y-2">
          {data.lines.map((line, index) => (
            <div
              key={index}
              className="rounded-xl border border-gray-200 bg-white p-3 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-gray-500">Line {index + 1}</span>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                  aria-label={`Remove address line ${index + 1}`}
                  disabled={data.lines.length <= 1 && !line.trim()}
                  onClick={() => removeLine(index)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={line}
                placeholder={index === 0 ? '123 Business Street' : 'Apartment, suite, etc.'}
                onChange={(e) => updateLine(index, e.target.value)}
                onBlur={(e) => {
                  const lines = data.lines.map((row, i) => (i === index ? e.target.value : row));
                  commit({ ...data, lines }, true);
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-medium text-gray-600">City & region</span>
        <div className="grid grid-cols-2 gap-2">
          {ADDRESS_DETAIL_FIELDS.map((field) => (
            <div
              key={field.key}
              className={`rounded-xl border border-gray-200 bg-white p-3 space-y-1.5 ${
                field.key === 'country' ? 'col-span-2' : ''
              }`}
            >
              <label className="text-[11px] font-medium text-gray-500">{field.label}</label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={data[field.key]}
                placeholder={field.placeholder}
                onChange={(e) => updateDetail(field.key, e.target.value)}
                onBlur={(e) => commit({ ...data, [field.key]: e.target.value }, true)}
              />
            </div>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-gray-400">
        Sample address for the template — replaced with live invoice data when generated.
      </p>
    </div>
  );
}
