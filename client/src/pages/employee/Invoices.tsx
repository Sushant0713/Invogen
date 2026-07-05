import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';
import { Loader } from '@/components/ui/Loader';
import { Plus } from 'lucide-react';

export default function EmployeeInvoices() {
  const { data, isLoading } = useQuery({
    queryKey: ['employee-invoices'],
    queryFn: async () => (await api.get('/employee/invoices')).data,
  });
  if (isLoading) return <Loader />;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="mt-1 text-sm text-gray-500">Create invoices from your company templates.</p>
        </div>
        <Link to="/employee/invoices/new">
          <Button>
            <Plus className="h-4 w-4" />
            New Invoice
          </Button>
        </Link>
      </div>
      <DataTable
        columns={[
          { key: 'invoiceNumber', label: 'Invoice' },
          { key: 'status', label: 'Status' },
          { key: 'createdAt', label: 'Date', render: (r) => formatDate(r.createdAt as string) },
        ]}
        data={data?.data || []}
        keyField="_id"
      />
    </div>
  );
}
