import { Link, Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileText, Loader2, Shield } from 'lucide-react';
import api from '@/api/client';
import type { PublicAgreements } from '@/hooks/useAgreements';
import { resolveMediaUrl } from '@/lib/media';
import { registerPath } from '@/lib/workspace-portal';

type LegalType = 'terms' | 'privacy';

const meta: Record<LegalType, { icon: typeof FileText; accent: string; label: string }> = {
  terms: { icon: FileText, accent: 'from-primary/10 to-orange-50', label: 'Terms & Conditions' },
  privacy: { icon: Shield, accent: 'from-violet-100 to-indigo-50', label: 'Privacy Policy' },
};

export default function LegalDocumentPage() {
  const { type } = useParams<{ type: string }>();
  if (type !== 'terms' && type !== 'privacy') {
    return <Navigate to="/legal/terms" replace />;
  }
  const docType = type as LegalType;
  const info = meta[docType];
  const Icon = info.icon;

  const { data: branding } = useQuery({
    queryKey: ['auth-branding'],
    queryFn: async () => (await api.get('/auth/branding')).data.data as { name: string; logo: string },
  });

  const { data: agreements, isLoading } = useQuery({
    queryKey: ['auth-agreements'],
    queryFn: async () => (await api.get('/auth/agreements')).data.data as PublicAgreements,
    staleTime: 5 * 60_000,
  });

  const document = agreements?.[docType];
  const logo = resolveMediaUrl(branding?.logo);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            {logo ? (
              <img src={logo} alt={branding?.name || 'Invogen'} className="h-8 w-auto object-contain" />
            ) : (
              <span className="text-lg font-bold text-primary">{branding?.name || 'Invogen'}</span>
            )}
          </div>
          <Link
            to={registerPath('admin')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to register
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <div
          className={cn(
            'mb-8 rounded-2xl border border-gray-100 bg-gradient-to-br p-6 shadow-sm',
            info.accent
          )}
        >
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {document?.title || info.label}
              </h1>
              {document?.version ? (
                <p className="mt-1 text-sm text-gray-500">Version {document.version}</p>
              ) : null}
            </div>
          </div>
        </div>

        <article className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Loading…
            </div>
          ) : (
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
              {document?.content || 'This document is not available yet.'}
            </div>
          )}
        </article>
      </main>
    </div>
  );
}
