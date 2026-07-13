import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, Pencil, Share2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { confirmToast } from '@/lib/confirm-toast';
import { deleteInvoiceApi } from '@/features/invoice-composer/invoice-share';
import { toast } from 'sonner';
import { useState } from 'react';
import { ShareInvoiceDialog } from '@/features/invoice-composer/ShareInvoiceDialog';
import { useAppSelector } from '@/hooks/useAppDispatch';
import { PERMISSIONS, UserRole } from '@invogen/shared';

interface InvoiceRowActionsProps {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  invoicesApi: string;
  /** React Query key for the invoices list (must match the list page query). */
  listQueryKey: string[];
  editPathPrefix: string;
  viewPathPrefix: string;
  customerName?: string;
  customerEmail?: string;
  sharesQueryKey?: string[];
}

export function InvoiceRowActions({
  invoiceId,
  invoiceNumber,
  status,
  invoicesApi,
  listQueryKey,
  editPathPrefix,
  viewPathPrefix,
  customerName,
  customerEmail,
  sharesQueryKey = ['admin-invoice-shares'],
}: InvoiceRowActionsProps) {
  const queryClient = useQueryClient();
  const [shareOpen, setShareOpen] = useState(false);
  const user = useAppSelector((s) => s.auth.user);
  const permissions = user?.permissions ?? [];

  const isEmployee = user?.role === UserRole.EMPLOYEE;
  const canView = !isEmployee || permissions.includes(PERMISSIONS.INVOICE_VIEW);
  const canEdit =
    status !== 'paid' && (!isEmployee || permissions.includes(PERMISSIONS.INVOICE_EDIT));
  const canDelete =
    status === 'draft' && (!isEmployee || permissions.includes(PERMISSIONS.INVOICE_DELETE));
  const canShare = !isEmployee || permissions.includes(PERMISSIONS.INVOICE_CREATE);

  const deleteMutation = useMutation({
    mutationFn: () => deleteInvoiceApi(invoicesApi, invoiceId),
    onSuccess: () => {
      queryClient.setQueryData(
        listQueryKey,
        (old: { data?: Array<{ _id?: string }> } | undefined) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.filter((row) => String(row._id) !== invoiceId),
          };
        }
      );
      void queryClient.invalidateQueries({ queryKey: listQueryKey });
      void queryClient.invalidateQueries({ queryKey: sharesQueryKey });
      toast.success('Invoice deleted');
    },
    onError: () => toast.error('Failed to delete invoice'),
  });

  const handleDelete = async () => {
    const ok = await confirmToast(`Permanently delete invoice ${invoiceNumber}?`, {
      description: 'This action cannot be undone.',
      confirmLabel: 'Delete permanently',
      variant: 'danger',
    });
    if (ok) deleteMutation.mutate();
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {canView && (
          <Link to={`${viewPathPrefix}/${invoiceId}/view`}>
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4" />
              View
            </Button>
          </Link>
        )}
        {canEdit && (
          <Link to={`${editPathPrefix}/${invoiceId}/edit`}>
            <Button variant="outline" size="sm">
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          </Link>
        )}
        {canShare && (
          <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        )}
        {canDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => void handleDelete()}
            loading={deleteMutation.isPending}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      <ShareInvoiceDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        invoiceId={invoiceId}
        invoicesApi={invoicesApi}
        invoiceNumber={invoiceNumber}
        defaultRecipientName={customerName}
        defaultRecipientEmail={customerEmail}
        onShared={() => {
          void queryClient.invalidateQueries({ queryKey: sharesQueryKey });
          void queryClient.invalidateQueries({ queryKey: listQueryKey });
        }}
      />
    </>
  );
}
