import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/client';
import { Input } from '@/components/ui/Input';
import { useDebouncedCallback } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  AGREEMENT_DOCUMENT_OPTIONS,
  type AgreementDocumentType,
  type AgreementSettingsStore,
  type CompanyProfileForAgreement,
  hydrateAgreementSettingsStore,
  updateAgreementStoreDocument,
} from './agreement-settings.types';

const selectClass =
  'w-full rounded-xl border border-gray-200 bg-white/80 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

interface SettingRow {
  _id: string;
  key: string;
  value: unknown;
}

export function AgreementSettingPanel({
  initialStore,
  companyProfile,
}: {
  initialStore: AgreementSettingsStore;
  companyProfile: CompanyProfileForAgreement;
}) {
  const queryClient = useQueryClient();
  const [store, setStore] = useState(() => hydrateAgreementSettingsStore(initialStore, companyProfile));
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const skipAutoSave = useRef(true);
  const lastSavedRef = useRef(JSON.stringify(initialStore));
  const saveStatusTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const activeDoc = store.documents[store.activeDocument];

  const saveMutation = useMutation({
    mutationFn: async (value: AgreementSettingsStore) =>
      api.patch('/super-admin/settings/agreement_settings', { value }),
    onMutate: () => {
      if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current);
      setSaveStatus('saving');
    },
    onSuccess: (_data, value) => {
      lastSavedRef.current = JSON.stringify(value);
      setSaveStatus('saved');
      queryClient.setQueryData<SettingRow[]>(['super-admin-settings'], (old) => {
        if (!old) return old;
        return old.map((row) =>
          row.key === 'agreement_settings' ? { ...row, value } : row
        );
      });
      saveStatusTimer.current = setTimeout(() => setSaveStatus('idle'), 2000);
    },
    onError: () => {
      setSaveStatus('error');
      toast.error('Failed to save agreement');
    },
  });

  const debouncedSave = useDebouncedCallback((value: AgreementSettingsStore) => {
    const serialized = JSON.stringify(value);
    if (serialized === lastSavedRef.current) return;
    saveMutation.mutate(value);
  }, 800);

  useEffect(() => {
    return () => {
      if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current);
    };
  }, []);

  useEffect(() => {
    if (skipAutoSave.current) {
      skipAutoSave.current = false;
      return;
    }
    debouncedSave(store);
  }, [store, debouncedSave]);

  const updateActive = (patch: Parameters<typeof updateAgreementStoreDocument>[1]) => {
    setStore((prev) => updateAgreementStoreDocument(prev, patch));
  };

  const setActiveDocument = (type: AgreementDocumentType) => {
    setStore((prev) => ({ ...prev, activeDocument: type }));
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-gray-500">
          Manage Terms &amp; Conditions and Privacy Policy. Changes save automatically.
        </p>
        <p
          className={cn(
            'min-w-[7rem] text-right text-xs font-medium',
            saveStatus === 'saving' && 'text-primary',
            saveStatus === 'saved' && 'text-green-600',
            saveStatus === 'error' && 'text-red-600',
            saveStatus === 'idle' && 'text-gray-400'
          )}
        >
          {saveStatus === 'saving' && 'Saving...'}
          {saveStatus === 'saved' && 'All changes saved'}
          {saveStatus === 'error' && 'Save failed'}
          {saveStatus === 'idle' && 'Auto-save on'}
        </p>
      </div>

      <div className="grid shrink-0 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="agreement-document-type" className="block text-sm font-medium text-gray-700">
            Agreement title
          </label>
          <select
            id="agreement-document-type"
            className={selectClass}
            value={store.activeDocument}
            onChange={(e) => setActiveDocument(e.target.value as AgreementDocumentType)}
          >
            {AGREEMENT_DOCUMENT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="Version"
          value={activeDoc.version}
          onChange={(e) => updateActive({ version: e.target.value })}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <label htmlFor="agreement-content" className="shrink-0 text-sm font-medium text-gray-700">
          {activeDoc.title} content
        </label>
        <div className="relative min-h-0 flex-1">
          <textarea
            id="agreement-content"
            value={activeDoc.content}
            onChange={(e) => updateActive({ content: e.target.value })}
            placeholder={`Write your ${activeDoc.title.toLowerCase()} here...`}
            className="absolute inset-0 h-full w-full resize-none rounded-xl border border-gray-200 bg-white/80 px-4 py-3 text-sm leading-relaxed focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>
    </div>
  );
}
