import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SalesReportTab } from '@/features/super-admin-reports/SalesReportTab';
import { GstReportTab } from '@/features/super-admin-reports/GstReportTab';
import { ClientsReportTab } from '@/features/super-admin-reports/ClientsReportTab';
import { PlansReportTab } from '@/features/super-admin-reports/PlansReportTab';
import { OutstandingReportTab } from '@/features/super-admin-reports/OutstandingReportTab';
import { AdminReportTab } from '@/features/super-admin-reports/AdminReportTab';

const reportTypes = [
  { id: 'sales', label: 'Sales' },
  { id: 'gst', label: 'Gst' },
  { id: 'clients', label: 'Clients' },
  { id: 'admin', label: 'Admin' },
  { id: 'plans', label: 'Plans' },
  { id: 'outstanding', label: 'Outstanding' },
] as const;

export default function SuperAdminReports() {
  const [type, setType] = useState<(typeof reportTypes)[number]['id']>('sales');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="mt-1 text-sm text-gray-500">
          Platform subscription sales, tax, clients, admin invoices, plans, and outstanding collections.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {reportTypes.map((item) => (
          <Button
            key={item.id}
            type="button"
            size="sm"
            variant={type === item.id ? 'primary' : 'outline'}
            className="min-w-[88px] rounded-full"
            onClick={() => setType(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {type === 'sales' ? (
        <SalesReportTab />
      ) : type === 'gst' ? (
        <GstReportTab />
      ) : type === 'clients' ? (
        <ClientsReportTab />
      ) : type === 'admin' ? (
        <AdminReportTab />
      ) : type === 'plans' ? (
        <PlansReportTab />
      ) : (
        <OutstandingReportTab />
      )}
    </div>
  );
}
