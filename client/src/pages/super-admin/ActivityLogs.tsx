import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Search, Trash2 } from 'lucide-react';
import api from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { formatActivityAccount, type ActivityUserRef } from '@/lib/activity';
import { confirmToast } from '@/lib/confirm-toast';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';

type ActivityLogRow = {
  _id: string;
  action: string;
  module: string;
  description: string;
  createdAt: string;
  userId?: ActivityUserRef;
};

type ActivityLogsResponse = {
  data: ActivityLogRow[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export default function SuperAdminActivityLogs() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['super-admin-activity', page, search],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (search) params.search = search;
      const res = await api.get('/super-admin/activity-logs', { params });
      return {
        data: res.data.data as ActivityLogRow[],
        meta: res.data.meta as ActivityLogsResponse['meta'],
      };
    },
  });

  const rows = data?.data ?? [];
  const meta = data?.meta;

  const visibleIds = useMemo(() => rows.map((row) => row._id), [rows]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.includes(id));

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => visibleIds.includes(id)));
  }, [visibleIds]);

  const deleteMutation = useMutation({
    mutationFn: async (payload: { ids?: string[]; all?: boolean; search?: string }) =>
      (await api.post('/super-admin/activity-logs/delete', payload)).data.data as { deleted: number },
    onSuccess: (result) => {
      toast.success(`Deleted ${result.deleted} activity log${result.deleted === 1 ? '' : 's'}`);
      setSelectedIds([]);
      void queryClient.invalidateQueries({ queryKey: ['super-admin-activity'] });
      void queryClient.invalidateQueries({ queryKey: ['super-admin-dashboard'] });
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || 'Failed to delete activity logs');
    },
  });

  const toggleRow = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !visibleIds.includes(id)));
      return;
    }
    setSelectedIds((current) => [...new Set([...current, ...visibleIds])]);
  };

  const runSearch = () => {
    setSearch(searchInput.trim());
    setPage(1);
    setSelectedIds([]);
  };

  const handleDeleteSelected = async () => {
    if (!selectedIds.length) return;
    const confirmed = await confirmToast(
      `Delete ${selectedIds.length} selected activity log${selectedIds.length === 1 ? '' : 's'}?`,
      { variant: 'danger', confirmLabel: 'Delete' }
    );
    if (!confirmed) return;
    deleteMutation.mutate({ ids: selectedIds });
  };

  const handleDeleteFiltered = async () => {
    const label = search
      ? `all activity logs matching "${search}"`
      : 'all activity logs';
    const confirmed = await confirmToast(`Delete ${label}?`, {
      variant: 'danger',
      confirmLabel: 'Delete all',
      description: 'This cannot be undone.',
    });
    if (!confirmed) return;
    deleteMutation.mutate({ all: true, search: search || undefined });
  };

  if (isLoading && !data) return <Loader />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Activity Logs</h1>
        <p className="mt-1 text-sm text-gray-500">
          Platform-wide actions from admins, employees, and super admins.
        </p>
      </div>

      <Card glass={false} className="border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="Action, module, description, account, IP…"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') runSearch();
                }}
              />
            </div>
          </div>
          <Button type="button" onClick={runSearch}>
            Search
          </Button>
          {search ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearchInput('');
                setSearch('');
                setPage(1);
                setSelectedIds([]);
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>

        {isFetching ? (
          <p className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Updating logs…
          </p>
        ) : null}
      </Card>

      <Card glass={false} className="overflow-hidden border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={allVisibleSelected}
                ref={(input) => {
                  if (input) input.indeterminate = !allVisibleSelected && someVisibleSelected;
                }}
                onChange={toggleSelectAllVisible}
                disabled={!visibleIds.length}
              />
              Select all on page
            </label>
            {selectedIds.length > 0 ? (
              <span className="text-sm text-gray-500">{selectedIds.length} selected</span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!selectedIds.length || deleteMutation.isPending}
              onClick={() => void handleDeleteSelected()}
            >
              <Trash2 className="h-4 w-4" />
              Delete selected
            </Button>
            <Button
              type="button"
              size="sm"
              variant="danger"
              disabled={!meta?.total || deleteMutation.isPending}
              onClick={() => void handleDeleteFiltered()}
            >
              <Trash2 className="h-4 w-4" />
              {search ? 'Delete matching' : 'Delete all'}
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80 text-left">
                <th className="w-12 px-4 py-3" />
                <th className="px-4 py-3 font-medium text-gray-600">Action</th>
                <th className="px-4 py-3 font-medium text-gray-600">Module</th>
                <th className="px-4 py-3 font-medium text-gray-600">Account</th>
                <th className="px-4 py-3 font-medium text-gray-600">Description</th>
                <th className="px-4 py-3 font-medium text-gray-600">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                    {search ? 'No activity logs match your search.' : 'No activity logs found.'}
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const checked = selectedIds.includes(row._id);
                  return (
                    <tr key={row._id} className="border-b border-gray-50 hover:bg-primary-50/20">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                          checked={checked}
                          onChange={() => toggleRow(row._id)}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{row.action}</td>
                      <td className="px-4 py-3 text-gray-700">{row.module}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {formatActivityAccount(row.userId) || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{row.description}</td>
                      <td className="px-4 py-3 text-gray-700">{formatDate(row.createdAt)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {meta && meta.total > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-4">
            <p className="text-sm text-gray-500">
              Showing {(meta.page - 1) * meta.limit + 1} to{' '}
              {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} logs
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={meta.page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              {Array.from({ length: Math.min(meta.totalPages, 5) }, (_, index) => index + 1).map(
                (pageNumber) => (
                  <Button
                    key={pageNumber}
                    type="button"
                    size="sm"
                    variant={pageNumber === meta.page ? 'primary' : 'outline'}
                    onClick={() => setPage(pageNumber)}
                  >
                    {pageNumber}
                  </Button>
                )
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={meta.page >= meta.totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
