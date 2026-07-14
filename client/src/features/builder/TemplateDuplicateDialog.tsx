import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { isTemplateNameTaken } from '@/features/template-gallery/CustomizeTemplateDialog';

interface TemplateDuplicateDialogProps {
  open: boolean;
  defaultName: string;
  defaultDescription?: string;
  takenNames: Set<string>;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (payload: { name: string; description: string }) => void;
}

export function TemplateDuplicateDialog({
  open,
  defaultName,
  defaultDescription = '',
  takenNames,
  loading = false,
  onClose,
  onConfirm,
}: TemplateDuplicateDialogProps) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState(defaultDescription);

  useEffect(() => {
    if (!open) return;
    setName(defaultName);
    setDescription(defaultDescription);
  }, [open, defaultName, defaultDescription]);

  if (!open) return null;

  const trimmed = name.trim();
  const nameTaken = isTemplateNameTaken(trimmed, takenNames);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900">Duplicate template</h3>
        <p className="mt-1 text-sm text-gray-500">
          Create a new template copy. Choose a unique name so you can keep both versions.
        </p>
        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!trimmed || nameTaken || loading) return;
            onConfirm({ name: trimmed, description: description.trim() });
          }}
        >
          <Input
            label="Template name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
            error={nameTaken ? 'This name is already used by another template.' : undefined}
          />
          <Input
            label="Description (optional)"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" loading={loading} disabled={!trimmed || nameTaken || loading}>
              Create copy
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
