import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/api/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { DataTable } from '@/components/ui/DataTable';
import { Loader } from '@/components/ui/Loader';
import { toast } from 'sonner';
import { Package, Percent } from 'lucide-react';
import { formatDiscountDate } from '@invogen/shared';
import {
  type ProductDiscountRecord,
  type ApplyScope,
  selectClass,
  getStatusSnapshot,
  LifecycleStatusBadge,
  formatDiscountValue,
  scopeLabel,
  buildDiscountStats,
  DiscountStatsBar,
  LifecyclePreview,
} from '@/features/discounts/discount-shared';
import { ProductCheckboxList } from '@/features/discounts/ProductCheckboxList';

interface ProductOption {
  _id: string;
  name: string;
  sku?: string;
  price?: number;
  category?: string;
  discount?: number;
}

const emptyForm = () => ({
  name: '',
  description: '',
  value: '',
  applyScope: 'all' as ApplyScope,
  productIds: [] as string[],
  category: '',
  minQuantity: '1',
  priority: '0',
  startDate: '',
  endDate: '',
  isActive: true,
});

export default function AdminDiscountRulesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [form, setForm] = useState(emptyForm);

  const { data: discounts, isLoading } = useQuery({
    queryKey: ['admin-product-discounts'],
    queryFn: async () =>
      (await api.get('/admin/product-discounts', { params: { limit: 100 } })).data.data as ProductDiscountRecord[],
  });

  const { data: products } = useQuery({
    queryKey: ['admin-product-discount-products'],
    queryFn: async () =>
      (await api.get('/admin/product-discounts/products')).data.data as ProductOption[],
  });

  const stats = useMemo(() => buildDiscountStats(discounts || []), [discounts]);

  const filtered = useMemo(() => {
    return (discounts || []).filter((discount) => {
      const lifecycle = getStatusSnapshot(discount).lifecycle;
      if (statusFilter !== 'all' && lifecycle !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        discount.name.toLowerCase().includes(q) ||
        discount.description?.toLowerCase().includes(q) ||
        discount.category?.toLowerCase().includes(q)
      );
    });
  }, [discounts, search, statusFilter]);

  const categorySuggestions = useMemo(() => {
    const set = new Set<string>();
    (products || []).forEach((p) => {
      if (p.category?.trim()) set.add(p.category.trim());
    });
    return Array.from(set).sort();
  }, [products]);

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(false);
  };

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      editingId
        ? api.patch(`/admin/product-discounts/${editingId}`, body)
        : api.post('/admin/product-discounts', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-product-discounts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-product-discount-products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['builder-company-products'] });
      toast.success(editingId ? 'Discount updated' : 'Discount created');
      resetForm();
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Failed to save discount');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/product-discounts/${id}`, { isActive }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-product-discounts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['builder-company-products'] });
      toast.success(variables.isActive ? 'Discount enabled' : 'Discount disabled');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/product-discounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-product-discounts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['builder-company-products'] });
      toast.success('Discount deleted');
    },
  });

  const handleEdit = (discount: ProductDiscountRecord) => {
    const productIds = (discount.productIds || [])
      .map((p) => (typeof p === 'string' ? p : p._id))
      .filter(Boolean);
    setEditingId(discount._id);
    setForm({
      name: discount.name,
      description: discount.description || '',
      value: String(discount.value),
      applyScope: discount.applyScope,
      productIds,
      category: discount.category || '',
      minQuantity: discount.minQuantity ? String(discount.minQuantity) : '1',
      priority: discount.priority != null ? String(discount.priority) : '0',
      startDate: discount.startDate ? discount.startDate.slice(0, 10) : '',
      endDate: discount.endDate ? discount.endDate.slice(0, 10) : '',
      isActive: discount.isActive,
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      discountType: 'percentage',
      value: Number(form.value),
      applyScope: form.applyScope,
      productIds: form.applyScope === 'products' ? form.productIds : [],
      category: form.applyScope === 'category' ? form.category.trim() : undefined,
      minQuantity: form.minQuantity ? Number(form.minQuantity) : 1,
      priority: form.priority ? Number(form.priority) : 0,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      isActive: form.isActive,
    });
  };

  if (isLoading) return <Loader />;

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-gradient-to-r from-primary-50/80 to-white border-primary/10">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <Percent className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Direct product discounts</h2>
            <p className="text-sm text-gray-500 mt-1">
              Create and manage discount rules for your catalog. View usage analytics on{' '}
              <Link to="/admin/discounts" className="font-medium text-primary hover:underline">
                Discount → Analytics
              </Link>
              .
            </p>
          </div>
        </div>
      </Card>

      <DiscountStatsBar stats={stats} />

      <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <Input
            placeholder="Search discounts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs"
          />
          <select
            className={selectClass + ' sm:max-w-[180px]'}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="scheduled">Scheduled</option>
            <option value="expired">Expired</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }}>
          <Package className="h-4 w-4 mr-1.5" />
          Add discount
        </Button>
      </div>

      {showForm && (
        <Card>
          <h3 className="font-semibold mb-1">{editingId ? 'Edit discount' : 'New direct discount'}</h3>
          <p className="text-sm text-gray-500 mb-4">
            The discount percentage is saved on each matching product in your catalog.
          </p>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid md:grid-cols-2 gap-4">
              <Input label="Discount name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <Input label="Discount percentage (%)" type="number" min="0" max="100" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} required />
              <Input label="Description" className="md:col-span-2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Apply to</label>
                <select
                  className={selectClass}
                  value={form.applyScope}
                  onChange={(e) => setForm({ ...form, applyScope: e.target.value as ApplyScope, productIds: [], category: '' })}
                >
                  <option value="all">All products</option>
                  <option value="products">Selected products</option>
                  <option value="category">Product category</option>
                </select>
              </div>
              {form.applyScope === 'category' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
                  <input
                    list="admin-discount-categories"
                    className={selectClass}
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    required
                  />
                  <datalist id="admin-discount-categories">
                    {categorySuggestions.map((c) => <option key={c} value={c} />)}
                  </datalist>
                </div>
              )}
              {form.applyScope === 'products' && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Products</label>
                  <ProductCheckboxList
                    products={products || []}
                    selectedIds={form.productIds}
                    onChange={(productIds) => setForm({ ...form, productIds })}
                  />
                </div>
              )}
              <Input label="Minimum quantity" type="number" min="1" value={form.minQuantity} onChange={(e) => setForm({ ...form, minQuantity: e.target.value })} />
              <Input label="Priority" type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} placeholder="Higher priority wins overlaps" />
              <Input label="Start date" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              <Input label="End date" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
            <LifecyclePreview form={form} />
            <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <Switch checked={form.isActive} onChange={(isActive) => setForm({ ...form, isActive })} label="Discount enabled" />
            </div>
            <div className="flex gap-2">
              <Button type="submit" loading={saveMutation.isPending}>{editingId ? 'Update' : 'Save'} discount</Button>
              <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      <DataTable
        columns={[
          { key: 'name', label: 'Name' },
          {
            key: 'offer',
            label: 'Offer',
            render: (r) => {
              const d = r as unknown as ProductDiscountRecord;
              return (
                <div>
                  <Badge variant="success">{formatDiscountValue(d)}</Badge>
                  {d.minQuantity && d.minQuantity > 1 && (
                    <p className="text-xs text-gray-500 mt-1">Min qty: {d.minQuantity}</p>
                  )}
                </div>
              );
            },
          },
          {
            key: 'scope',
            label: 'Applies to',
            render: (r) => <span className="text-sm text-gray-700">{scopeLabel(r as unknown as ProductDiscountRecord)}</span>,
          },
          {
            key: 'schedule',
            label: 'Schedule',
            render: (r) => {
              const d = r as unknown as ProductDiscountRecord;
              return (
                <span className="text-sm text-gray-700">
                  {d.startDate ? formatDiscountDate(d.startDate) : 'Now'} → {d.endDate ? formatDiscountDate(d.endDate) : 'No end'}
                </span>
              );
            },
          },
          {
            key: 'priority',
            label: 'Priority',
            render: (r) => <span className="text-sm tabular-nums">{(r as unknown as ProductDiscountRecord).priority ?? 0}</span>,
          },
          {
            key: 'enabled',
            label: 'Enabled',
            render: (r) => {
              const d = r as unknown as ProductDiscountRecord;
              return (
                <Switch
                  checked={d.isActive}
                  disabled={toggleMutation.isPending}
                  onChange={(isActive) => toggleMutation.mutate({ id: d._id, isActive })}
                  label={`Enable ${d.name}`}
                />
              );
            },
          },
          {
            key: 'lifecycle',
            label: 'Status',
            render: (r) => <LifecycleStatusBadge discount={r as unknown as ProductDiscountRecord} />,
          },
          {
            key: 'actions',
            label: 'Actions',
            render: (r) => {
              const d = r as unknown as ProductDiscountRecord;
              return (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(d)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => deleteMutation.mutate(d._id)}>Delete</Button>
                </div>
              );
            },
          },
        ]}
        data={filtered as unknown as Record<string, unknown>[]}
        keyField="_id"
      />
    </div>
  );
}
