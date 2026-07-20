import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
  listQueryParams,
  sortRows,
  paginated = false,
  pageSize = 10,
}: {
  endpoint: string;
  queryKey: string;
  columns: { key: string; label: string; render?: (r: Record<string, unknown>) => React.ReactNode }[];
  fields: { name: string; label: string; type?: string; fieldKind?: FieldKind; suggest?: boolean }[];
  title: string;
  extraRowActions?: (row: Record<string, unknown>) => ReactNode;
  listQueryParams?: Record<string, string | number>;
  sortRows?: (rows: Record<string, unknown>[]) => Record<string, unknown>[];
  paginated?: boolean;
  pageSize?: number;
}) {
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  const queryParams = useMemo(() => {
    if (!paginated && !listQueryParams) return undefined;
    return {
      ...listQueryParams,
      ...(paginated ? { page, limit: pageSize } : {}),
    };
  }, [listQueryParams, paginated, page, pageSize]);

  const { data, isLoading } = useQuery({
    queryKey: [queryKey, queryParams],
    queryFn: async () => (await api.get(endpoint, { params: queryParams })).data,
  });

  const meta = data?.meta as { page: number; totalPages: number } | undefined;

  useEffect(() => {
    if (paginated && meta && page > meta.totalPages && meta.totalPages > 0) {
      setPage(meta.totalPages);
    }
  }, [paginated, meta, page]);

  const rows: Record<string, unknown>[] = useMemo(() => {
    const raw: Record<string, unknown>[] = data?.data || [];
    return sortRows ? sortRows(raw) : raw;
  }, [data, sortRows]);

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
    const parsed: Record<string, unknown> = { ...body };
    if (parsed.price !== undefined && parsed.price !== '') {
      parsed.price = Number(parsed.price);
    }
    if (parsed.gst !== undefined && parsed.gst !== '') {
      parsed.gst = Number(parsed.gst);
    }
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
      if (queryKey === 'admin-products' || queryKey === 'employee-products') {
        queryClient.invalidateQueries({ queryKey: ['builder-company-products'] });
      }
      closeForm();
      toast.success(`${title} created`);
    },
    onError: (error: any) => {
      const msg = error.response?.data?.message || `Failed to create ${title.toLowerCase()}`;
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, string> }) =>
      api.patch(`${endpoint}/${id}`, buildPayload(body, true)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      if (queryKey === 'admin-products' || queryKey === 'employee-products') {
        queryClient.invalidateQueries({ queryKey: ['builder-company-products'] });
      }
      closeForm();
      toast.success(`${title} updated`);
    },
    onError: (error: any) => {
      const msg = error.response?.data?.message || `Failed to update ${title.toLowerCase()}`;
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`${endpoint}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      if (queryKey === 'admin-products' || queryKey === 'employee-products') {
        queryClient.invalidateQueries({ queryKey: ['builder-company-products'] });
      }
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
        pagination={
          paginated && meta && meta.totalPages > 1
            ? { page, totalPages: meta.totalPages, onPageChange: setPage }
            : undefined
        }
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
        { name: 'pan', label: 'PAN Number', fieldKind: 'pan' },
      ]}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'gst', label: 'GST' },
        { key: 'pan', label: 'PAN' },
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
      paginated
      pageSize={10}
      listQueryParams={{ naturalOrder: 'true' }}
      title="Product"
      fields={[
        { name: 'name', label: 'Name' },
        { name: 'sku', label: 'SKU' },
        { name: 'price', label: 'Price', fieldKind: 'price' },
        { name: 'hsn', label: 'HSN', fieldKind: 'hsn' },
        { name: 'category', label: 'Category', suggest: true },
      ]}
      columns={[
        {
          key: 'name',
          label: 'Name',
          render: (r: Record<string, any>) => (
            <div className="flex flex-col">
              <span>{r.name}</span>
              {r.suspendedBySystem && (
                <span className="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 w-max">
                  Suspended (Plan Limit)
                </span>
              )}
            </div>
          ),
        },
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
