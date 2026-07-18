import { useMemo, useState } from 'react';
import { AlertTriangle, Link2 } from 'lucide-react';
import type { CanvasElement } from '@invogen/shared';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch';
import { updateElement, selectElement } from '@/store/slices/builderSlice';
import {
  buildLayoutIntentProps,
  getElementCollisionPolicy,
  getElementFlowGroupId,
  getElementLayoutMode,
  getElementOverflowPolicy,
  suggestFlowGroupId,
  type CollisionPolicy,
  type LayoutMode,
  type OverflowPolicy,
} from './layout-intent';
import { detectLayoutWarnings } from './layout-warnings';
import { isLayoutFixedChrome } from './layout-policy';

function SelectField({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <select
        className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Live-layout intent controls — preserve design in builder, guide invoice adaptation. */
export function LayoutIntentPanel({ element }: { element: CanvasElement }) {
  const dispatch = useAppDispatch();
  const chrome = isLayoutFixedChrome(element);
  const mode = getElementLayoutMode(element);
  const overflow = getElementOverflowPolicy(element);
  const collision = getElementCollisionPolicy(element);
  const flowGroupId = getElementFlowGroupId(element) ?? '';

  const patchProps = (patch: Parameters<typeof buildLayoutIntentProps>[0]) => {
    dispatch(
      updateElement({
        id: element.id,
        changes: { props: buildLayoutIntentProps(patch) },
        recordHistory: true,
      })
    );
  };

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div>
        <p className="text-sm font-medium text-gray-900">Live layout intent</p>
        <p className="mt-1 text-xs text-gray-500">
          Builder keeps this placement. Invoice live preview adapts only as you allow below.
        </p>
      </div>

      {chrome ? (
        <p className="text-xs text-gray-600">
          This component is fixed chrome (logo, image, icon, footer, watermark, etc.) and never
          moves in live preview.
        </p>
      ) : (
        <>
          <SelectField
            label="Position"
            value={mode}
            onChange={(v) => patchProps({ layoutMode: v as LayoutMode })}
            options={[
              { value: 'flow', label: 'Flow — may move when content above grows' },
              { value: 'fixed', label: 'Fixed — never move in live preview' },
            ]}
          />
          <SelectField
            label="Overflow"
            value={overflow}
            onChange={(v) => patchProps({ overflowPolicy: v as OverflowPolicy })}
            options={[
              { value: 'wrapGrow', label: 'Wrap & grow height' },
              { value: 'wrap', label: 'Wrap inside box (clip extra)' },
              { value: 'clip', label: 'Clip — keep authored size' },
            ]}
          />
          <SelectField
            label="Collision"
            value={collision}
            onChange={(v) => patchProps({ collisionPolicy: v as CollisionPolicy })}
            options={[
              { value: 'pushRelated', label: 'Push related components below' },
              { value: 'allowOverlap', label: 'Allow overlap (design intent)' },
              { value: 'warnOnly', label: 'Keep place + warn in builder' },
            ]}
          />
          <label className="block space-y-1">
            <span className="text-xs font-medium text-gray-600">Flow group</span>
            <div className="flex gap-2">
              <Input
                defaultValue={flowGroupId}
                key={`${element.id}:${flowGroupId}`}
                placeholder="e.g. bill-to"
                onBlur={(e) => patchProps({ flowGroupId: e.target.value || null })}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                title="Generate group id"
                onClick={() => patchProps({ flowGroupId: suggestFlowGroupId('flow') })}
              >
                <Link2 className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[11px] text-gray-500">
              Same group moves together (address → phone → email). Different groups stay independent.
            </p>
          </label>
        </>
      )}
    </div>
  );
}

/** Page-level layout risk list + long-data stress check (does not mutate the template). */
export function LayoutWarningsPanel() {
  const dispatch = useAppDispatch();
  const { pages, activePageIndex } = useAppSelector((s) => s.builder);
  const page = pages[activePageIndex];
  const [stress, setStress] = useState(false);

  const warnings = useMemo(
    () => (page ? detectLayoutWarnings(page, { stress }) : []),
    [page, stress]
  );

  if (!page) return null;

  return (
    <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div>
            <p className="text-sm font-medium text-amber-900">Layout check</p>
            <p className="mt-0.5 text-xs text-amber-800/80">
              Warnings only — your canvas positions are not changed.
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant={stress ? 'default' : 'outline'}
          className="shrink-0 text-xs"
          onClick={() => setStress((v) => !v)}
        >
          {stress ? 'Typical data' : 'Long data'}
        </Button>
      </div>

      {warnings.length === 0 ? (
        <p className="text-xs text-amber-900/70">
          {stress ? 'No issues with long sample data.' : 'No issues with current values.'}
        </p>
      ) : (
        <ul className="max-h-40 space-y-1 overflow-auto text-xs text-amber-950">
          {warnings.slice(0, 12).map((w) => (
            <li key={w.id}>
              <button
                type="button"
                className="text-left underline-offset-2 hover:underline"
                onClick={() => dispatch(selectElement(w.elementId))}
              >
                {w.message}
              </button>
            </li>
          ))}
          {warnings.length > 12 && (
            <li className="text-amber-800/70">+{warnings.length - 12} more…</li>
          )}
        </ul>
      )}
    </div>
  );
}
