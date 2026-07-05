import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/client';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { toast } from 'sonner';

function CrudPage({
  endpoint,
  queryKey,
  columns,
  fields,
  title,
}: {
  endpoint: string;
  queryKey: string;
  columns: { key: string; label: string; render?: (r: Record<string, unknown>) => React.ReactNode }[];
  fields: { name: string; label: string; type?: string }[];
  title: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => (await api.get(endpoint)).data,
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, string>) => {
      const parsed = { ...body };
      if (parsed.price) parsed.price = String(Number(parsed.price));
      return api.post(endpoint, parsed);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      setShowForm(false);
      setForm({});
      toast.success(`${title} created`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`${endpoint}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast.success(`${title} deleted`);
    },
  });

  if (isLoading) return <Loader />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowForm(!showForm)}>Add {title}</Button>
      </div>
      {showForm && (
        <Card>
          <form
            onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }}
            className="grid md:grid-cols-2 gap-4"
          >
            {fields.map((f) => (
              <Input
                key={f.name}
                label={f.label}
                type={f.type || 'text'}
                value={form[f.name] || ''}
                onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
              />
            ))}
            <div className="md:col-span-2">
              <Button type="submit" loading={createMutation.isPending}>Save</Button>
            </div>
          </form>
        </Card>
      )}
      <DataTable
        columns={[
          ...columns,
          {
            key: 'actions',
            label: 'Actions',
            render: (r) => (
              <Button size="sm" variant="danger" onClick={() => deleteMutation.mutate(r._id as string)}>
                Delete
              </Button>
            ),
          },
        ]}
        data={data?.data || []}
        keyField="_id"
      />
    </div>
  );
}

export default function AdminEmployees() {
  return (
    <CrudPage
      endpoint="/admin/employees"
      queryKey="admin-employees"
      title="Employee"
      fields={[
        { name: 'firstName', label: 'First Name' },
        { name: 'lastName', label: 'Last Name' },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'password', label: 'Password', type: 'password' },
        { name: 'department', label: 'Department' },
        { name: 'designation', label: 'Designation' },
      ]}
      columns={[
        { key: 'userId', label: 'Name', render: (r) => {
          const u = r.userId as { firstName?: string; lastName?: string; email?: string };
          return `${u?.firstName || ''} ${u?.lastName || ''} (${u?.email || ''})`;
        }},
        { key: 'department', label: 'Department' },
        { key: 'designation', label: 'Designation' },
      ]}
    />
  );
}

export function AdminCustomers() {
  return (
    <CrudPage
      endpoint="/admin/customers"
      queryKey="admin-customers"
      title="Customer"
      fields={[
        { name: 'name', label: 'Name' },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'phone', label: 'Phone' },
        { name: 'gst', label: 'GST Number' },
      ]}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'gst', label: 'GST' },
      ]}
    />
  );
}

export function AdminProducts() {
  return (
    <CrudPage
      endpoint="/admin/products"
      queryKey="admin-products"
      title="Product"
      fields={[
        { name: 'name', label: 'Name' },
        { name: 'sku', label: 'SKU' },
        { name: 'price', label: 'Price', type: 'number' },
        { name: 'hsn', label: 'HSN' },
        { name: 'category', label: 'Category' },
      ]}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'sku', label: 'SKU' },
        { key: 'price', label: 'Price' },
        { key: 'category', label: 'Category' },
      ]}
    />
  );
}
