import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  compact?: boolean;
  className?: string;
}

export function StatCard({ title, value, icon: Icon, trend, compact, className }: StatCardProps) {
  return (
    <Card className={cn('relative', compact ? 'p-4' : undefined, className)}>
      <div
        className={cn(
          'absolute right-4 top-4 rounded-xl bg-primary-50',
          compact ? 'p-2' : 'p-2.5',
        )}
      >
        <Icon className={cn('text-primary', compact ? 'h-4 w-4' : 'h-5 w-5')} />
      </div>

      <div className="min-w-0 pr-12">
        <p className={cn('font-medium text-gray-500', compact ? 'text-xs' : 'text-sm')}>{title}</p>
        <p
          className={cn(
            'mt-2 font-bold tabular-nums leading-snug text-gray-900 break-words',
            compact ? 'text-lg' : 'text-lg sm:text-xl xl:text-2xl',
          )}
        >
          {value}
        </p>
        {trend ? <p className="mt-2 text-xs leading-relaxed text-green-600">{trend}</p> : null}
      </div>
    </Card>
  );
}
