import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import api from '@/api/client';
import { cn } from '@/lib/utils';

type NotificationItem = {
  _id: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
};

type NotificationBellProps = {
  apiBase: '/admin' | '/super-admin';
};

export function NotificationBell({ apiBase }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const unreadKey = [`${apiBase.slice(1)}-notifications-unread`] as const;
  const listKey = [`${apiBase.slice(1)}-notifications`] as const;

  const { data: unread = 0 } = useQuery({
    queryKey: unreadKey,
    queryFn: async () => (await api.get(`${apiBase}/notifications/unread-count`)).data.data as number,
    refetchInterval: 15_000,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: listKey,
    queryFn: async () => (await api.get(`${apiBase}/notifications`)).data.data as NotificationItem[],
    enabled: open,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`${apiBase}/notifications/${id}/read`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: unreadKey });
      void queryClient.invalidateQueries({ queryKey: listKey });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.patch(`${apiBase}/notifications/read-all`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: unreadKey });
      void queryClient.invalidateQueries({ queryKey: listKey });
    },
  });

  return (
    <div className="relative ml-auto">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition-colors hover:border-primary/30 hover:text-primary"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-100 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <p className="text-sm font-semibold text-gray-900">Notifications</p>
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => markAllReadMutation.mutate()}
              >
                Mark all read
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-gray-500">No notifications yet.</p>
              ) : (
                notifications.map((item) => {
                  const content = (
                    <div
                      className={cn(
                        'border-b border-gray-50 px-4 py-3 transition-colors hover:bg-gray-50',
                        !item.isRead && 'bg-primary/5'
                      )}
                    >
                      <p className="text-sm font-medium text-gray-900">{item.title}</p>
                      <p className="mt-1 text-sm text-gray-600">{item.message}</p>
                    </div>
                  );

                  if (item.link) {
                    return (
                      <Link
                        key={item._id}
                        to={item.link}
                        onClick={() => {
                          if (!item.isRead) markReadMutation.mutate(item._id);
                          setOpen(false);
                        }}
                      >
                        {content}
                      </Link>
                    );
                  }

                  return (
                    <button
                      key={item._id}
                      type="button"
                      className="block w-full text-left"
                      onClick={() => {
                        if (!item.isRead) markReadMutation.mutate(item._id);
                      }}
                    >
                      {content}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function AdminNotificationBell() {
  return <NotificationBell apiBase="/admin" />;
}

export function SuperAdminNotificationBell() {
  return <NotificationBell apiBase="/super-admin" />;
}
