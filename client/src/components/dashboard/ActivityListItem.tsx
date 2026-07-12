import { formatActivityAccount, type ActivityUserRef } from '@/lib/activity';
import { formatDate } from '@/lib/utils';

interface ActivityListItemProps {
  description: string;
  createdAt: string;
  userId?: ActivityUserRef;
  meta?: string;
}

export function ActivityListItem({ description, createdAt, userId, meta }: ActivityListItemProps) {
  const account = formatActivityAccount(userId);

  return (
    <div className="border-b border-gray-50 pb-2 last:border-b-0 last:pb-0">
      <p className="text-sm">{description}</p>
      {account ? (
        <p className="text-xs text-gray-600 mt-0.5">{account}</p>
      ) : null}
      {meta ? (
        <p className="text-xs text-gray-500 mt-0.5">{meta}</p>
      ) : null}
      <p className="text-xs text-gray-400 mt-0.5">{formatDate(createdAt)}</p>
    </div>
  );
}
