import { toast } from 'sonner';

interface ConfirmToastOptions {
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
}

export function confirmToast(message: string, options?: ConfirmToastOptions): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const show = options?.variant === 'danger' ? toast.warning : toast;

    const id = show(message, {
      description: options?.description,
      duration: Infinity,
      dismissible: true,
      onDismiss: () => settle(false),
      action: {
        label: options?.confirmLabel || 'Confirm',
        onClick: () => {
          toast.dismiss(id);
          settle(true);
        },
      },
      cancel: {
        label: options?.cancelLabel || 'Cancel',
        onClick: () => {
          toast.dismiss(id);
          settle(false);
        },
      },
    });
  });
}
