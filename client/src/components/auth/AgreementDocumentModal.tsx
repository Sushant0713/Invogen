import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Shield, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { PublicAgreementDocument } from '@/hooks/useAgreements';
import { cn } from '@/lib/utils';

type AgreementKind = 'terms' | 'privacy';

const kindMeta: Record<AgreementKind, { icon: typeof FileText; accent: string }> = {
  terms: { icon: FileText, accent: 'bg-primary/10 text-primary' },
  privacy: { icon: Shield, accent: 'bg-violet-100 text-violet-700' },
};

interface AgreementDocumentModalProps {
  open: boolean;
  onClose: () => void;
  agreement: PublicAgreementDocument | null;
  kind: AgreementKind;
  onAccept?: () => void;
  acceptLabel?: string;
}

export function AgreementDocumentModal({
  open,
  onClose,
  agreement,
  kind,
  onAccept,
  acceptLabel = 'I have read this document',
}: AgreementDocumentModalProps) {
  const meta = kindMeta[kind];
  const Icon = meta.icon;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || !agreement) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="agreement-modal-title"
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-gray-100 px-5 py-4">
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', meta.accent)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="agreement-modal-title" className="text-lg font-semibold text-gray-900">
              {agreement.title}
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">Version {agreement.version}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-gradient-to-b from-gray-50/80 to-white px-6 py-5">
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
            {agreement.content}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-gray-100 bg-white px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          {onAccept ? (
            <Button
              type="button"
              onClick={() => {
                onAccept();
                onClose();
              }}
            >
              {acceptLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
