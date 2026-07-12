import type { TemplateSummary } from '@invogen/shared';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

export function suggestTemplateName(baseName: string, existingNames: Set<string>): string {
  if (!existingNames.has(baseName)) return baseName;
  const custom = `${baseName} (Custom)`;
  if (!existingNames.has(custom)) return custom;
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${baseName} (${i})`;
    if (!existingNames.has(candidate)) return candidate;
  }
  return `${baseName} (Custom)`;
}

export function isTemplateNameTaken(name: string, existingNames: Set<string>): boolean {
  return existingNames.has(name.trim());
}

interface CustomizeTemplateDialogProps {
  systemTemplate: TemplateSummary;
  name: string;
  description: string;
  existingNames: Set<string>;
  existingCategoryLabels?: string[];
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  loading?: boolean;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export function CustomizeTemplateDialog({
  systemTemplate,
  name,
  description,
  existingNames,
  existingCategoryLabels = [],
  title = 'Name your template copy',
  subtitle = 'Choose a unique name so you can keep your existing templates and this new copy.',
  submitLabel = 'Create & Edit',
  loading = false,
  onNameChange,
  onDescriptionChange,
  onCancel,
  onSubmit,
}: CustomizeTemplateDialogProps) {
  const trimmedName = name.trim();
  const nameTaken = trimmedName ? isTemplateNameTaken(trimmedName, existingNames) : false;
  const canSubmit = Boolean(trimmedName) && !nameTaken && !loading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-lg" glass={false}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </CardHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSubmit) return;
            onSubmit();
          }}
        >
          <div className="rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Based on</p>
            <p className="mt-1 font-medium text-gray-900">{systemTemplate.name}</p>
            <p className="text-xs text-gray-500">{systemTemplate.category}</p>
          </div>

          {existingCategoryLabels.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-medium">You already have templates for this category</p>
              <ul className="mt-1 list-inside list-disc text-xs text-amber-800">
                {existingCategoryLabels.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs">Pick a new name below to keep both.</p>
            </div>
          ) : null}

          <Input
            label="Your template name"
            required
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="e.g. Travel Agency Invoice (Custom)"
            error={nameTaken ? 'This name is already used. Choose a different name.' : undefined}
          />

          <Input
            label="Description"
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder="Short description shown in the gallery"
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" loading={loading} disabled={!canSubmit}>
              {submitLabel}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
