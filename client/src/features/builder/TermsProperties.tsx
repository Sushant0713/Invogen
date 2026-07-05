import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  DEFAULT_TERMS_TITLE,
  buildTermsProps,
  parseTermsFromProps,
} from './terms-content';

interface Props {
  props: Record<string, unknown>;
  onChange: (nextProps: Record<string, unknown>, recordHistory?: boolean) => void;
}

export function TermsProperties({ props, onChange }: Props) {
  const { title, items } = parseTermsFromProps(props);

  const commit = (nextTitle: string, nextItems: string[], recordHistory = false) => {
    onChange(buildTermsProps(nextTitle, nextItems, props), recordHistory);
  };

  const updateTitle = (value: string) => {
    commit(value, items, false);
  };

  const updateItem = (index: number, value: string) => {
    const next = items.map((item, i) => (i === index ? value : item));
    commit(title, next, false);
  };

  const addItem = () => {
    commit(title, [...items, ''], true);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) {
      commit(title, [''], true);
      return;
    }
    commit(
      title,
      items.filter((_, i) => i !== index),
      true
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-gray-50/90 p-3 space-y-2">
        <label className="text-xs font-semibold text-gray-700">Terms and Conditions</label>
        <input
          type="text"
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
          value={title}
          placeholder={DEFAULT_TERMS_TITLE}
          onChange={(e) => updateTitle(e.target.value)}
          onBlur={(e) => commit(e.target.value, items, true)}
        />
        <p className="text-[11px] text-gray-400">
          Heading shown above the numbered terms on the invoice.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-gray-600">Terms (one per box)</span>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="h-3.5 w-3.5" />
            Add term
          </Button>
        </div>

        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={index}
              className="rounded-xl border border-gray-200 bg-white p-3 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-gray-500">Term {index + 1}</span>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                  aria-label={`Remove term ${index + 1}`}
                  disabled={items.length <= 1 && !item.trim()}
                  onClick={() => removeItem(index)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <textarea
                className="w-full min-h-[4.5rem] resize-y rounded-lg border border-gray-200 px-3 py-2 text-sm leading-relaxed"
                value={item}
                placeholder="Enter a term or condition…"
                onChange={(e) => updateItem(index, e.target.value)}
                onBlur={(e) => {
                  const next = items.map((row, i) => (i === index ? e.target.value : row));
                  commit(title, next, true);
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
