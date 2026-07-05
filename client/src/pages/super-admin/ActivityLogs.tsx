import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import { DataTable } from '@/components/ui/DataTable';
import { formatDate } from '@/lib/utils';
import { Loader } from '@/components/ui/Loader';
import { formatActivityAccount, type ActivityUserRef } from '@/lib/activity';

export default function SuperAdminActivityLogs() {
  const { data, isLoading } = useQuery({
    queryKey: ['super-admin-activity'],
    queryFn: async () => (await api.get('/super-admin/activity-logs')).data,
  });
  if (isLoading) return <Loader />;
  return (
    <DataTable
      columns={[
        { key: 'action', label: 'Action' },
        { key: 'module', label: 'Module' },
        {
          key: 'userId',
          label: 'Account',
          render: (r) => formatActivityAccount(r.userId as ActivityUserRef) || '—',
        },
        { key: 'description', label: 'Description' },
        { key: 'createdAt', label: 'Date', render: (r) => formatDate(r.createdAt as string) },
      ]}
      data={data?.data || []}
      keyField="_id"
    />
  );
}
