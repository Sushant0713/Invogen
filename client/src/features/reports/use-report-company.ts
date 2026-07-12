import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';

type ReportCompany = {
  _id?: string;
  name?: string;
};

export function useReportCompany() {
  return useQuery({
    queryKey: ['admin-company'],
    queryFn: async () => (await api.get('/admin/company')).data.data as ReportCompany,
    staleTime: 5 * 60 * 1000,
  });
}
