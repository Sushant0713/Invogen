import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/api/client';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import { toast } from 'sonner';

export default function AdminInvoiceCreate() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ customerId: '', templateId: '', type: 'tax' });

  const { data: customers, isLoading: loadingCustomers } = useQuery({
    queryKey: ['admin-customers-list'],
    queryFn: async () => (await api.get('/admin/customers')).data.data,
  });
  const { data: templates, isLoading: loadingTemplates } = useQuery({
    queryKey: ['admin-templates-list'],
    queryFn: async () => (await api.get('/admin/templates')).data.data,
  });

  const mutation = useMutation({
    mutationFn: (body: typeof form) => api.post('/admin/invoices', {
      ...body,
      lineItems: [{ name: 'Service', quantity: 1, unit: 'pcs', price: 1000, discount: 0, tax: 18, total: 1180 }],
      totals: { subtotal: 1000, discount: 0, tax: 180, total: 1180 },
    }),
    onSuccess: () => {
      toast.success('Invoice created');
      navigate('/admin/invoices');
    },
  });

  if (loadingCustomers || loadingTemplates) return <Loader />;

  return (
    <Card className="max-w-lg space-y-4">
      <h2 className="text-lg font-semibold">Create Invoice</h2>
      <div>
        <label className="text-sm font-medium">Customer</label>
        <select className="w-full mt-1 rounded-xl border p-2.5" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
          <option value="">Select customer</option>
          {(customers || []).map((c: { _id: string; name: string }) => (
            <option key={c._id} value={c._id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium">Template</label>
        <select className="w-full mt-1 rounded-xl border p-2.5" value={form.templateId} onChange={(e) => setForm({ ...form, templateId: e.target.value })}>
          <option value="">Select template</option>
          {(templates || []).map((t: { _id: string; name: string }) => (
            <option key={t._id} value={t._id}>{t.name}</option>
          ))}
        </select>
      </div>
      <Input label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
      <Button onClick={() => mutation.mutate(form)} loading={mutation.isPending}>Create Invoice</Button>
    </Card>
  );
}
