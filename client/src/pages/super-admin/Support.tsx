import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Loader } from '@/components/ui/Loader';

export default function SuperAdminSupport() {
  const { data, isLoading } = useQuery({
    queryKey: ['super-admin-support'],
    queryFn: async () => (await api.get('/super-admin/support-tickets')).data,
  });
  if (isLoading) return <Loader />;
  return (
    <DataTable
      columns={[
        { key: 'subject', label: 'Subject' },
        { key: 'status', label: 'Status', render: (r) => <Badge>{r.status as string}</Badge> },
        { key: 'priority', label: 'Priority', render: (r) => <Badge variant="warning">{r.priority as string}</Badge> },
      ]}
      data={data?.data || []}
      keyField="_id"
    />
  );
}
