import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import { DataTable } from '@/components/ui/DataTable';
import { formatDate } from '@/lib/utils';
import { Loader } from '@/components/ui/Loader';

export default function SuperAdminInvoices() {
  const { data, isLoading } = useQuery({
    queryKey: ['super-admin-invoices'],
    queryFn: async () => (await api.get('/super-admin/invoices')).data,
  });
  if (isLoading) return <Loader />;
  return (
    <DataTable
      columns={[
        { key: 'invoiceNumber', label: 'Invoice' },
        { key: 'companyId', label: 'Company', render: (r) => (r.companyId as { name?: string })?.name || '-' },
        { key: 'status', label: 'Status' },
        { key: 'createdAt', label: 'Date', render: (r) => formatDate(r.createdAt as string) },
      ]}
      data={data?.data || []}
      keyField="_id"
    />
  );
}
