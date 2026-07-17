import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  createCardCustomField,
  getCardFieldDefs,
  getCardFieldValue,
  isCustomCardFieldHidden,
  parseCardCustomFields,
  parseCardFieldIcons,
  parseHiddenCardFields,
  setCardFieldIcon,
  setCustomCardFieldHidden,
  type CardCustomField,
} from './card-components';
import { cardFieldSupportsIcon, resolveCardLineGlyphKey } from './icon-components';
import { LibraryIconTile } from './LibraryIconTile';

interface Props {
  type: string;
  props: Record<string, unknown>;
  onChange: (key: string, value: string, recordHistory?: boolean) => void;
  onChangeMany: (patch: Record<string, unknown>, recordHistory?: boolean) => void;
  onCustomFieldsChange: (customFields: CardCustomField[], recordHistory?: boolean) => void;
}

export function CardProperties({
  type,
  props,
  onChange,
  onChangeMany,
  onCustomFieldsChange,
}: Props) {
  const fields = getCardFieldDefs(type);
  const customFields = parseCardCustomFields(props.customFields);
  const hidden = new Set(parseHiddenCardFields(props.hiddenFields));
  const iconFields = new Set(parseCardFieldIcons(props.fieldIcons));

  if (!fields.length) return null;

  const toggleFieldIcon = (key: string) => {
    onChangeMany(
      { fieldIcons: setCardFieldIcon(props.fieldIcons, key, !iconFields.has(key)) },
      true
    );
  };

  const selectAllIfPlaceholder = (
    el: HTMLInputElement | HTMLTextAreaElement,
    placeholder: string
  ) => {
    const current = el.value ?? '';
    if (current.trim() === placeholder.trim()) {
      // Replace the whole sample value on first keypress (Canva-like).
      el.select?.();
      return true;
    }
    return false;
  };

  const setFieldHidden = (key: string, nextHidden: boolean) => {
    const next = new Set(parseHiddenCardFields(props.hiddenFields));
    if (nextHidden) next.add(key);
    else next.delete(key);
    onChangeMany({ hiddenFields: [...next] }, true);
  };

  const writeHiddenFields = (nextHiddenFields: string[]) => {
    onChangeMany({ hiddenFields: nextHiddenFields }, true);
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-gray-400">
        Sample text for the template — replaced with live invoice data when generated.
      </p>
      {fields.map((field) => (
        <div key={field.key}>
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs text-gray-500">{field.label}</label>
            <div className="flex items-center gap-1">
              {cardFieldSupportsIcon(field.key) && field.key !== 'address' && (
                <button
                  type="button"
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
                    iconFields.has(field.key)
                      ? 'ring-2 ring-primary/40'
                      : 'opacity-60 hover:opacity-100'
                  } ${hidden.has(field.key) ? 'pointer-events-none opacity-30' : ''}`}
                  title={iconFields.has(field.key) ? 'Remove icon from line' : 'Show icon before this line'}
                  onClick={() => toggleFieldIcon(field.key)}
                >
                  <LibraryIconTile
                    iconKey={resolveCardLineGlyphKey(type, field.key)}
                    variant={iconFields.has(field.key) ? 'solid' : 'soft'}
                    size={20}
                  />
                </button>
              )}
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                title={hidden.has(field.key) ? 'Show field' : 'Hide field'}
                onClick={() => setFieldHidden(field.key, !hidden.has(field.key))}
              >
                {hidden.has(field.key)
                  ? <EyeOff className="h-3.5 w-3.5" />
                  : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          {field.key === 'address' && (
            <div
              className={`mt-1 grid grid-cols-2 gap-1 rounded-lg bg-gray-200/70 p-1 ${
                hidden.has(field.key) ? 'pointer-events-none opacity-40' : ''
              }`}
            >
              <button
                type="button"
                className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                  !iconFields.has(field.key)
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                onClick={() => {
                  if (iconFields.has(field.key)) toggleFieldIcon(field.key);
                }}
              >
                Label
              </button>
              <button
                type="button"
                className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                  iconFields.has(field.key)
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                onClick={() => {
                  if (!iconFields.has(field.key)) toggleFieldIcon(field.key);
                }}
              >
                <LibraryIconTile
                  iconKey={resolveCardLineGlyphKey(type, field.key)}
                  size={16}
                />
                Logo
              </button>
            </div>
          )}
          {field.key === 'address' && (
            <p className="mt-1 text-[11px] text-gray-400">
              {iconFields.has(field.key)
                ? 'Logo only — no Address text label.'
                : 'Address text only — no logo.'}
            </p>
          )}
          {field.multiline ? (
            <textarea
              className="mt-1 w-full rounded-lg border p-2 text-sm"
              rows={3}
              value={getCardFieldValue(props, field.key, field.placeholder)}
              placeholder={field.placeholder}
              disabled={hidden.has(field.key)}
              onMouseDown={(e) => {
                if (selectAllIfPlaceholder(e.currentTarget, field.placeholder)) {
                  // Prevent the click from moving the caret after we select-all.
                  e.preventDefault();
                }
              }}
              onChange={(e) => onChange(field.key, e.target.value)}
              onBlur={(e) => onChange(field.key, e.target.value, true)}
            />
          ) : (
            <input
              type="text"
              className="mt-1 w-full rounded-lg border p-2 text-sm"
              value={getCardFieldValue(props, field.key, field.placeholder)}
              placeholder={field.placeholder}
              disabled={hidden.has(field.key)}
              onMouseDown={(e) => {
                if (selectAllIfPlaceholder(e.currentTarget, field.placeholder)) {
                  e.preventDefault();
                }
              }}
              onChange={(e) => onChange(field.key, e.target.value)}
              onBlur={(e) => onChange(field.key, e.target.value, true)}
            />
          )}
        </div>
      ))}

      {customFields.map((field) => (
        <div
          key={field.id}
          className="space-y-2 rounded-lg border border-dashed border-gray-200 bg-gray-50/60 p-2"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
              Custom field
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={`inline-flex h-6 w-6 items-center justify-center rounded transition-all ${
                  iconFields.has(`custom:${field.id}`)
                    ? 'ring-2 ring-primary/40'
                    : 'opacity-60 hover:opacity-100'
                }`}
                title={
                  iconFields.has(`custom:${field.id}`)
                    ? 'Remove icon from line'
                    : 'Show icon before this line'
                }
                onClick={() => toggleFieldIcon(`custom:${field.id}`)}
              >
                <LibraryIconTile
                  iconKey="verified"
                  variant={iconFields.has(`custom:${field.id}`) ? 'solid' : 'soft'}
                  size={18}
                />
              </button>
              <button
                type="button"
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                title={isCustomCardFieldHidden(hidden, field.id) ? 'Show field' : 'Hide field'}
                onClick={() =>
                  writeHiddenFields(
                    setCustomCardFieldHidden(
                      parseHiddenCardFields(props.hiddenFields),
                      field.id,
                      !isCustomCardFieldHidden(hidden, field.id)
                    )
                  )
                }
              >
                {isCustomCardFieldHidden(hidden, field.id)
                  ? <EyeOff className="h-3.5 w-3.5" />
                  : <Eye className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                title="Remove field"
                onClick={() =>
                  onCustomFieldsChange(
                    customFields.filter((item) => item.id !== field.id),
                    true
                  )
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <Input
            label="Field name"
            value={field.label}
            disabled={isCustomCardFieldHidden(hidden, field.id)}
            onChange={(e) =>
              onCustomFieldsChange(
                customFields.map((item) =>
                  item.id === field.id ? { ...item, label: e.target.value } : item
                ),
                false
              )
            }
            onBlur={(e) =>
              onCustomFieldsChange(
                customFields.map((item) =>
                  item.id === field.id ? { ...item, label: e.target.value } : item
                ),
                true
              )
            }
            placeholder="e.g. GSTIN, Mobile"
          />
          <Input
            label="Sample value"
            value={field.value}
            disabled={isCustomCardFieldHidden(hidden, field.id)}
            onChange={(e) =>
              onCustomFieldsChange(
                customFields.map((item) =>
                  item.id === field.id ? { ...item, value: e.target.value } : item
                ),
                false
              )
            }
            onBlur={(e) =>
              onCustomFieldsChange(
                customFields.map((item) =>
                  item.id === field.id ? { ...item, value: e.target.value } : item
                ),
                true
              )
            }
            placeholder="Shown on canvas until invoice is filled"
          />
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => onCustomFieldsChange([...customFields, createCardCustomField()], true)}
      >
        <Plus className="h-4 w-4" />
        Add field
      </Button>
    </div>
  );
}
