import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';

export type PublicAgreementDocument = {
  title: string;
  version: string;
  content: string;
};

export type PublicAgreements = {
  terms: PublicAgreementDocument;
  privacy: PublicAgreementDocument;
};

export function useAgreementsQuery() {
  return useQuery({
    queryKey: ['auth-agreements'],
    queryFn: async () => (await api.get('/auth/agreements')).data.data as PublicAgreements,
    staleTime: 5 * 60_000,
  });
}
