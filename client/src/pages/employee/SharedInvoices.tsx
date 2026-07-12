import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Eye, ExternalLink } from 'lucide-react';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Loader } from '@/components/ui/Loader';
import { formatDate } from '@/lib/utils';
import { fetchSharedInvoices } from '@/features/invoice-composer/invoice-share';
import { buildPublicInvoiceViewUrl } from '@/lib/invoice-routes';
import { PERMISSIONS } from '@invogen/shared';
import { useAppSelector } from '@/hooks/useAppDispatch';

export default function EmployeeSharedInvoices() {
  const permissions = useAppSelector((s) => s.auth.user?.permissions ?? []);
  const canAccess =
    permissions.includes(PERMISSIONS.INVOICE_VIEW) ||
    permissions.includes(PERMISSIONS.INVOICE_CREATE) ||
    permissions.includes(PERMISSIONS.INVOICE_EDIT);

  const { data = [], isLoading } = useQuery({
    queryKey: ['employee-invoice-shares'],
    queryFn: () => fetchSharedInvoices('/employee/invoices'),
    enabled: canAccess,
  });

  if (!canAccess) return <Navigate to="/403" replace />;
  if (isLoading) return <Loader />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Shared Invoices</h1>
        <p className="mt-1 text-sm text-gray-500">
          Invoices sent to clients — who received each link and when.
        </p>
      </div>

      <DataTable
        columns={[
          { key: 'invoiceNumber', label: 'Invoice' },
          { key: 'customerName', label: 'Customer' },
          { key: 'recipientName', label: 'Sent to' },
          { key: 'recipientEmail', label: 'Email' },
          {
            key: 'method',
            label: 'Method',
            render: (row) => <Badge>{String(row.method)}</Badge>,
          },
          {
            key: 'sharedAt',
            label: 'Shared',
            render: (row) => formatDate(row.sharedAt as string),
          },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => (
              <div className="flex flex-wrap gap-2">
                <Link to={`/employee/invoices/${String(row.invoiceId)}/view`}>
                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4" />
                    View
                  </Button>
                </Link>
                <a
                  href={buildPublicInvoiceViewUrl(String(row.token))}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="ghost" size="sm">
                    <ExternalLink className="h-4 w-4" />
                    Client link
                  </Button>
                </a>
              </div>
            ),
          },
        ]}
        data={data}
        keyField="token"
      />
    </div>
  );
}
