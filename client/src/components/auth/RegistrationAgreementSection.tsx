import { useState } from 'react';
import { CheckCircle2, FileText, Loader2, Shield } from 'lucide-react';
import { AgreementDocumentModal } from '@/components/auth/AgreementDocumentModal';
import { useAgreementsQuery, type PublicAgreementDocument } from '@/hooks/useAgreements';
import { cn } from '@/lib/utils';

type AgreementKind = 'terms' | 'privacy';

interface RegistrationAgreementSectionProps {
  agreed: boolean;
  onAgreedChange: (value: boolean) => void;
  error?: string;
}

function AgreementCard({
  kind,
  document,
  onView,
}: {
  kind: AgreementKind;
  document: PublicAgreementDocument;
  onView: () => void;
}) {
  const isTerms = kind === 'terms';
  const Icon = isTerms ? FileText : Shield;

  return (
    <button
      type="button"
      onClick={onView}
      className={cn(
        'group flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-all',
        isTerms
          ? 'border-primary/20 bg-primary/5 hover:border-primary/40 hover:bg-primary/10'
          : 'border-violet-200 bg-violet-50/60 hover:border-violet-300 hover:bg-violet-50'
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
          isTerms ? 'bg-white text-primary shadow-sm' : 'bg-white text-violet-600 shadow-sm'
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-gray-900">{document.title}</p>
        <p className="mt-0.5 text-xs text-gray-500">Version {document.version}</p>
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-gray-600">
          {document.content}
        </p>
        <span
          className={cn(
            'mt-3 inline-flex text-xs font-semibold',
            isTerms ? 'text-primary' : 'text-violet-700'
          )}
        >
          Read full document →
        </span>
      </div>
    </button>
  );
}

export function RegistrationAgreementSection({
  agreed,
  onAgreedChange,
  error,
}: RegistrationAgreementSectionProps) {
  const { data: agreements, isLoading } = useAgreementsQuery();
  const [modalKind, setModalKind] = useState<AgreementKind | null>(null);

  const openDoc = modalKind ? agreements?.[modalKind] ?? null : null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Legal agreements</h3>
        <p className="mt-1 text-xs text-gray-500">
          Review our policies before creating your account.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 py-10 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Loading agreements…
        </div>
      ) : agreements ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <AgreementCard
            kind="terms"
            document={agreements.terms}
            onView={() => setModalKind('terms')}
          />
          <AgreementCard
            kind="privacy"
            document={agreements.privacy}
            onView={() => setModalKind('privacy')}
          />
        </div>
      ) : null}

      <label
        className={cn(
          'flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors',
          agreed
            ? 'border-green-200 bg-green-50/80'
            : 'border-gray-200 bg-white hover:border-primary/30',
          error && !agreed && 'border-red-200 bg-red-50/50'
        )}
      >
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => onAgreedChange(e.target.checked)}
          className="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
        />
        <span className="text-sm text-gray-700">
          I have read and agree to the{' '}
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={(e) => {
              e.preventDefault();
              setModalKind('terms');
            }}
          >
            {agreements?.terms.title || 'Terms & Conditions'}
          </button>{' '}
          and{' '}
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={(e) => {
              e.preventDefault();
              setModalKind('privacy');
            }}
          >
            {agreements?.privacy.title || 'Privacy Policy'}
          </button>
          .
        </span>
        {agreed ? (
          <CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-green-600" />
        ) : null}
      </label>

      {error ? <p className="text-xs text-red-500">{error}</p> : null}

      <AgreementDocumentModal
        open={modalKind !== null}
        onClose={() => setModalKind(null)}
        agreement={openDoc}
        kind={modalKind ?? 'terms'}
        onAccept={() => onAgreedChange(true)}
        acceptLabel="I agree to this document"
      />
    </div>
  );
}
