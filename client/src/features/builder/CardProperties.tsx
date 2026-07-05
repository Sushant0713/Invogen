import { getCardFieldDefs, getCardFieldValue } from './card-components';

interface Props {
  type: string;
  props: Record<string, unknown>;
  onChange: (key: string, value: string, recordHistory?: boolean) => void;
}

export function CardProperties({ type, props, onChange }: Props) {
  const fields = getCardFieldDefs(type);
  if (!fields.length) return null;

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-gray-400">
        Sample text for the template — replaced with live invoice data when generated.
      </p>
      {fields.map((field) => (
        <div key={field.key}>
          <label className="text-xs text-gray-500">{field.label}</label>
          {field.multiline ? (
            <textarea
              className="mt-1 w-full rounded-lg border p-2 text-sm"
              rows={3}
              value={getCardFieldValue(props, field.key, field.placeholder)}
              onChange={(e) => onChange(field.key, e.target.value)}
              onBlur={(e) => onChange(field.key, e.target.value, true)}
            />
          ) : (
            <input
              type="text"
              className="mt-1 w-full rounded-lg border p-2 text-sm"
              value={getCardFieldValue(props, field.key, field.placeholder)}
              onChange={(e) => onChange(field.key, e.target.value)}
              onBlur={(e) => onChange(field.key, e.target.value, true)}
            />
          )}
        </div>
      ))}
    </div>
  );
}
