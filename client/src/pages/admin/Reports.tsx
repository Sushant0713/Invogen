import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SalesReportTab } from '@/features/reports/SalesReportTab';
import { GstReportTab } from '@/features/reports/GstReportTab';
import { CustomersReportTab } from '@/features/reports/CustomersReportTab';
import { ProductsReportTab } from '@/features/reports/ProductsReportTab';

const reportTypes = [
  { id: 'sales', label: 'Sales' },
  { id: 'gst', label: 'Gst' },
  { id: 'customers', label: 'Customers' },
  { id: 'products', label: 'Products' },
  { id: 'outstanding', label: 'Outstanding' },
] as const;

export default function AdminReports() {
  const [type, setType] = useState<(typeof reportTypes)[number]['id']>('sales');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="mt-1 text-sm text-gray-500">
          Analyze sales, tax, customers, products, and outstanding invoices.
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
      ) : type === 'customers' ? (
        <CustomersReportTab />
      ) : type === 'products' ? (
        <ProductsReportTab />
      ) : (
        <Card glass={false} className="border border-dashed border-gray-200 bg-white p-10 text-center">
          <p className="text-lg font-semibold text-gray-900">
            {reportTypes.find((item) => item.id === type)?.label} report
          </p>
          <p className="mt-2 text-sm text-gray-500">
            This report section is coming soon. Sales, GST, Customers, and Products analytics are available now.
          </p>
        </Card>
      )}
    </div>
  );
}
