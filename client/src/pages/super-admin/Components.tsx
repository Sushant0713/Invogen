import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Loader } from '@/components/ui/Loader';

export default function SuperAdminComponents() {
  const { data, isLoading } = useQuery({
    queryKey: ['super-admin-components'],
    queryFn: async () => (await api.get('/super-admin/components')).data.data,
  });
  if (isLoading) return <Loader />;
  return (
    <DataTable
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'type', label: 'Type' },
        { key: 'category', label: 'Category' },
        { key: 'isActive', label: 'Status', render: (r) => <Badge variant={r.isActive ? 'success' : 'warning'}>{r.isActive ? 'Active' : 'Inactive'}</Badge> },
      ]}
      data={data || []}
      keyField="_id"
    />
  );
}
