import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';

const reportTypes = ['sales', 'gst', 'customers', 'products', 'outstanding'];

export default function AdminReports() {
  const [type, setType] = useState('sales');
  const { data, isLoading } = useQuery({
    queryKey: ['admin-reports', type],
    queryFn: async () => (await api.get(`/admin/reports/${type}`)).data.data,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {reportTypes.map((t) => (
          <Button key={t} variant={type === t ? 'primary' : 'outline'} size="sm" onClick={() => setType(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </Button>
        ))}
      </div>
      <Card>
        {isLoading ? <Loader /> : (
          <pre className="text-sm overflow-auto max-h-96">{JSON.stringify(data, null, 2)}</pre>
        )}
      </Card>
    </div>
  );
}
