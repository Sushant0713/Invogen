import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { isTemplateNameTaken } from '@/features/template-gallery/CustomizeTemplateDialog';

interface TemplateSaveOptionsDialogProps {
  open: boolean;
  currentName: string;
  takenNames: Set<string>;
  loading: boolean;
  isSystemTemplate: boolean;
  suggestedName: string;
  onClose: () => void;
  onSaveOverwrite: () => void;
  onSaveCopy: (name: string) => void;
}

export function TemplateSaveOptionsDialog({
  open,
  currentName,
  takenNames,
  loading,
  isSystemTemplate,
  suggestedName,
  onClose,
  onSaveOverwrite,
  onSaveCopy,
}: TemplateSaveOptionsDialogProps) {
  const [step, setStep] = useState<'options' | 'name'>('options');
  const [value, setValue] = useState('');

  useEffect(() => {
    if (open) {
      if (isSystemTemplate) {
        setStep('name');
        setValue(suggestedName);
      } else {
        setStep('options');
        setValue(`${currentName} Copy`);
      }
    }
  }, [open, currentName, isSystemTemplate, suggestedName]);

  if (!open) return null;

  const trimmed = value.trim();
  const nameTaken = Boolean(trimmed) && takenNames.has(trimmed);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-xl">
        {step === 'options' ? (
          <>
            <h3 className="text-base font-semibold text-gray-900">Save Template</h3>
            <p className="mt-1 text-sm text-gray-500">
              Would you like to overwrite your existing template, or save this as a brand new template?
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Button onClick={onSaveOverwrite} loading={loading}>
                Save Changes (Overwrite)
              </Button>
              <Button variant="outline" onClick={() => setStep('name')}>
                Save As New Template
              </Button>
              <Button variant="ghost" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-base font-semibold text-gray-900">
              {isSystemTemplate ? 'Save Custom Template' : 'Save As New Template'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {isSystemTemplate
                ? 'Save a custom copy of this template to your template list.'
                : 'Choose a unique name for your new template copy.'}
            </p>
            <form
              className="mt-4 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!trimmed || nameTaken || loading) return;
                onSaveCopy(trimmed);
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
                <Button
                  type="button"
                  variant="ghost"
                  onClick={isSystemTemplate ? onClose : () => setStep('options')}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={loading} disabled={!trimmed || nameTaken || loading}>
                  Save Copy
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
