import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link2, Mail, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { shareInvoiceApi, type ShareInvoiceInput } from '@/features/invoice-composer/invoice-share';
import { toast } from 'sonner';

interface ShareInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
  invoicesApi: string;
  invoiceNumber: string;
  defaultRecipientName?: string;
  defaultRecipientEmail?: string;
  onShared?: () => void;
}

export function ShareInvoiceDialog({
  open,
  onClose,
  invoiceId,
  invoicesApi,
  invoiceNumber,
  defaultRecipientName = '',
  defaultRecipientEmail = '',
  onShared,
}: ShareInvoiceDialogProps) {
  const [recipientName, setRecipientName] = useState(defaultRecipientName);
  const [recipientEmail, setRecipientEmail] = useState(defaultRecipientEmail);

  const shareMutation = useMutation({
    mutationFn: (input: ShareInvoiceInput) => shareInvoiceApi(invoicesApi, invoiceId, input),
    onSuccess: async (result, variables) => {
      onShared?.();
      if (variables.method === 'email') {
        const subject = encodeURIComponent(`Invoice ${result.invoiceNumber}`);
        const body = encodeURIComponent(
          `Hello${recipientName ? ` ${recipientName}` : ''},\n\nPlease view your invoice here:\n${result.viewUrl}\n\nThank you.`
        );
        window.location.href = `mailto:${recipientEmail}?subject=${subject}&body=${body}`;
      } else if (variables.method === 'whatsapp') {
        const text = encodeURIComponent(
          `Invoice ${result.invoiceNumber} — view here: ${result.viewUrl}`
        );
        window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
      } else {
        try {
          await navigator.clipboard.writeText(result.viewUrl);
          toast.success('View link copied — client can open read-only invoice');
        } catch {
          toast.success('Share link created');
        }
      }
      onClose();
    },
    onError: () => toast.error('Failed to share invoice'),
  });

  if (!open) return null;

  const share = (method: ShareInvoiceInput['method']) => {
    shareMutation.mutate({
      recipientName: recipientName.trim() || undefined,
      recipientEmail: recipientEmail.trim() || undefined,
      method,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">Share invoice</h2>
        <p className="mt-1 text-sm text-gray-500">
          Send {invoiceNumber} with a view-only link. Clients can open the invoice but not edit it.
        </p>

        <div className="mt-4 space-y-3">
          <Input
            label="Recipient name"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="Customer name"
          />
          <Input
            label="Recipient email"
            fieldKind="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="client@example.com"
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => share('email')}
            loading={shareMutation.isPending}
            disabled={!recipientEmail.trim()}
          >
            <Mail className="h-4 w-4" />
            Email link
          </Button>
          <Button type="button" variant="outline" onClick={() => share('whatsapp')} loading={shareMutation.isPending}>
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </Button>
          <Button type="button" variant="outline" onClick={() => share('link')} loading={shareMutation.isPending}>
            <Link2 className="h-4 w-4" />
            Copy link
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} className="ml-auto">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
