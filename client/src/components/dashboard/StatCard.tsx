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
    <Card className={cn('relative overflow-hidden', compact ? 'p-4' : undefined, className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={cn('font-medium text-gray-500', compact ? 'text-xs' : 'text-sm')}>{title}</p>
          <p className={cn('font-bold text-gray-900', compact ? 'mt-1 text-xl' : 'mt-2 text-3xl')}>{value}</p>
          {trend && <p className="mt-1 text-xs text-green-600">{trend}</p>}
        </div>
        <div className={cn('shrink-0 rounded-lg bg-primary-50', compact ? 'p-2' : 'rounded-xl p-3')}>
          <Icon className={cn('text-primary', compact ? 'h-4 w-4' : 'h-6 w-6')} />
        </div>
      </div>
    </Card>
  );
}
