import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/client';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { inferFieldKind, type FieldKind } from '@/lib/form-fields';
import { toast } from 'sonner';

function CrudPage({
  endpoint,
  queryKey,
  columns,
  fields,
  title,
  extraRowActions,
}: {
  endpoint: string;
  queryKey: string;
  columns: { key: string; label: string; render?: (r: Record<string, unknown>) => React.ReactNode }[];
  fields: { name: string; label: string; type?: string; fieldKind?: FieldKind; suggest?: boolean }[];
  title: string;
  extraRowActions?: (row: Record<string, unknown>) => ReactNode;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => (await api.get(endpoint)).data,
  });

  const rows: Record<string, unknown>[] = data?.data || [];

  const suggestionsFor = (name: string): string[] =>
    Array.from(
      new Set(
        rows
          .map((row) => row[name])
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          .map((value) => value.trim())
      )
    ).sort((a, b) => a.localeCompare(b));

  const closeForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm({});
  };

  const buildPayload = (body: Record<string, string>, isUpdate = false) => {
    const parsed = { ...body };
    if (parsed.price) parsed.price = String(Number(parsed.price));
    if (isUpdate) {
      // On edit, drop untouched empty fields so we never clobber values (e.g. password).
      Object.keys(parsed).forEach((key) => {
        if (parsed[key] === '') delete parsed[key];
      });
    }
    return parsed;
  };

  const createMutation = useMutation({
    mutationFn: (body: Record<string, string>) => api.post(endpoint, buildPayload(body)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      closeForm();
      toast.success(`${title} created`);
    },
    onError: () => toast.error(`Failed to create ${title.toLowerCase()}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, string> }) =>
      api.patch(`${endpoint}/${id}`, buildPayload(body, true)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      closeForm();
      toast.success(`${title} updated`);
    },
    onError: () => toast.error(`Failed to update ${title.toLowerCase()}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`${endpoint}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast.success(`${title} deleted`);
    },
  });

  const startEdit = (row: Record<string, unknown>) => {
    const next: Record<string, string> = {};
    fields.forEach((f) => {
      const value = row[f.name];
      next[f.name] = value == null ? '' : String(value);
    });
    setForm(next);
    setEditId(row._id as string);
    setShowForm(true);
  };

  const submitting = createMutation.isPending || updateMutation.isPending;

  if (isLoading) return <Loader />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => (showForm ? closeForm() : setShowForm(true))}>
          {showForm ? 'Close' : `Add ${title}`}
        </Button>
      </div>
      {showForm && (
        <Card>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editId) updateMutation.mutate({ id: editId, body: form });
              else createMutation.mutate(form);
            }}
            className="grid md:grid-cols-2 gap-4"
          >
            {fields.map((f) => {
              const fieldKind = f.fieldKind ?? inferFieldKind(f.name);
              const listId = f.suggest ? `${queryKey}-${f.name}-suggestions` : undefined;
              const suggestions = f.suggest ? suggestionsFor(f.name) : [];
              return (
                <div key={f.name}>
                  <Input
                    label={f.label}
                    fieldKind={fieldKind}
                    type={f.type}
                    list={listId}
                    autoComplete={listId ? 'off' : undefined}
                    value={form[f.name] || ''}
                    onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                  />
                  {listId && (
                    <datalist id={listId}>
                      {suggestions.map((value) => (
                        <option key={value} value={value} />
                      ))}
                    </datalist>
                  )}
                </div>
              );
            })}
            <div className="md:col-span-2 flex items-center gap-2">
              <Button type="submit" loading={submitting}>
                {editId ? 'Update' : 'Save'}
              </Button>
              <Button type="button" variant="outline" onClick={closeForm}>
                Cancel
              </Button>
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
              <div className="flex flex-wrap gap-2">
                {extraRowActions?.(r)}
                <Button size="sm" variant="outline" onClick={() => startEdit(r)}>
                  Edit
                </Button>
                <Button size="sm" variant="danger" onClick={() => deleteMutation.mutate(r._id as string)}>
                  Delete
                </Button>
              </div>
            ),
          },
        ]}
        data={rows}
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
        { name: 'email', label: 'Email', fieldKind: 'email' },
        { name: 'password', label: 'Password', fieldKind: 'password-new' },
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

export function CustomersCrud({
  endpoint = '/admin/customers',
  queryKey = 'admin-customers',
  invoicesPathPrefix,
}: {
  endpoint?: string;
  queryKey?: string;
  invoicesPathPrefix?: string;
}) {
  return (
    <CrudPage
      endpoint={endpoint}
      queryKey={queryKey}
      title="Customer"
      fields={[
        { name: 'name', label: 'Name' },
        { name: 'email', label: 'Email', fieldKind: 'email' },
        { name: 'phone', label: 'Phone', fieldKind: 'phone' },
        { name: 'gst', label: 'GST Number', fieldKind: 'gstin' },
      ]}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'gst', label: 'GST' },
      ]}
      extraRowActions={
        invoicesPathPrefix
          ? (row) => (
              <Link to={`${invoicesPathPrefix}?customerId=${String(row._id)}`}>
                <Button size="sm" variant="outline">
                  View invoices
                </Button>
              </Link>
            )
          : undefined
      }
    />
  );
}

export function AdminCustomers() {
  return <CustomersCrud />;
}

export function ProductsCrud({
  endpoint = '/admin/products',
  queryKey = 'admin-products',
}: {
  endpoint?: string;
  queryKey?: string;
}) {
  return (
    <CrudPage
      endpoint={endpoint}
      queryKey={queryKey}
      title="Product"
      fields={[
        { name: 'name', label: 'Name' },
        { name: 'sku', label: 'SKU' },
        { name: 'price', label: 'Price', fieldKind: 'price' },
        { name: 'hsn', label: 'HSN', fieldKind: 'hsn' },
        { name: 'category', label: 'Category', suggest: true },
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

export function AdminProducts() {
  return <ProductsCrud />;
}

export function AdminProductsCrud() {
  return <AdminProducts />;
}
