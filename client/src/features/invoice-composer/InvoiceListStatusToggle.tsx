import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/client';
import {
  InvoiceStatusToggle,
  type DashboardInvoiceStatus,
} from '@/components/dashboard/InvoiceStatusToggle';
import { toast } from 'sonner';

const TOGGLE_STATUSES = new Set<DashboardInvoiceStatus>(['draft', 'sent', 'paid']);

interface InvoiceListStatusToggleProps {
  invoiceId: string;
  status: string;
  invoicesApi: string;
  listQueryKey: Array<string | undefined>;
  disabled?: boolean;
}

export function InvoiceListStatusToggle({
  invoiceId,
  status,
  invoicesApi,
  listQueryKey,
  disabled,
}: InvoiceListStatusToggleProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (next: DashboardInvoiceStatus) => {
      await api.patch(`${invoicesApi}/${invoiceId}/status`, { status: next });
      return next;
    },
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: listQueryKey });
      const previous = queryClient.getQueryData<{ data?: Array<{ _id?: string; status?: string }> }>(
        listQueryKey
      );
      queryClient.setQueryData(listQueryKey, (old: typeof previous) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((row) =>
            String(row._id) === invoiceId ? { ...row, status: next } : row
          ),
        };
      });
      return { previous };
    },
    onError: (error, _next, context) => {
      if (context?.previous) {
        queryClient.setQueryData(listQueryKey, context.previous);
      }
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message
        || 'Failed to update status';
      toast.error(message);
    },
    onSuccess: () => {
      toast.success('Invoice status updated');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: listQueryKey });
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['employee-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-reports-sales'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-reports-customers'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-reports-gst'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-reports-products'] });
    },
  });

  if (!TOGGLE_STATUSES.has(status as DashboardInvoiceStatus)) {
    return <span className="capitalize text-sm text-gray-600">{status}</span>;
  }

  return (
    <InvoiceStatusToggle
      value={status}
      disabled={disabled}
      loading={mutation.isPending}
      onChange={(next) => mutation.mutate(next)}
    />
  );
}
