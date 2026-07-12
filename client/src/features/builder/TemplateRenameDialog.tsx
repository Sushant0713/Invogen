import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface TemplateRenameDialogProps {
  open: boolean;
  currentName: string;
  takenNames: Set<string>;
  onClose: () => void;
  onApply: (name: string) => void;
}

export function TemplateRenameDialog({
  open,
  currentName,
  takenNames,
  onClose,
  onApply,
}: TemplateRenameDialogProps) {
  const [value, setValue] = useState(currentName);

  useEffect(() => {
    if (open) setValue(currentName);
  }, [open, currentName]);

  if (!open) return null;

  const trimmed = value.trim();
  const nameTaken = Boolean(trimmed) && takenNames.has(trimmed);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900">Rename template</h3>
        <p className="mt-1 text-sm text-gray-500">
          Choose a unique name for your template. Save the template to keep this change.
        </p>
        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!trimmed || nameTaken) return;
            onApply(trimmed);
          }}
        >
          <Input
            label="Template name"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoFocus
            error={nameTaken ? 'This name is already used by another template.' : undefined}
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!trimmed || nameTaken}>
              Apply
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
