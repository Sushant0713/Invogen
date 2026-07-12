import { cn } from '@/lib/utils';
import {
  WORKSPACE_PORTAL_OPTIONS,
  type WorkspacePortal,
} from '@/lib/workspace-portal';

interface AuthPortalSwitcherProps {
  value: WorkspacePortal;
  onChange: (portal: WorkspacePortal) => void;
  className?: string;
}

export function AuthPortalSwitcher({ value, onChange, className }: AuthPortalSwitcherProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <p className="text-center text-xs font-semibold uppercase tracking-wide text-gray-400">
        I am signing in as
      </p>
      <div
        className="grid grid-cols-2 gap-2 rounded-2xl border border-gray-200 bg-gray-50/80 p-1.5"
        role="tablist"
        aria-label="Choose workspace type"
      >
        {WORKSPACE_PORTAL_OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = value === option.id;

          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(option.id)}
              className={cn(
                'rounded-xl px-3 py-3 text-left transition-all duration-200',
                active
                  ? 'bg-white text-gray-900 shadow-sm ring-1 ring-primary/15'
                  : 'text-gray-500 hover:text-gray-800',
              )}
            >
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex h-8 w-8 items-center justify-center rounded-lg',
                    active ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{option.shortLabel}</span>
                  <span className="block text-[11px] leading-tight text-gray-500">
                    {option.id === 'admin' ? 'Company owner' : 'Team member'}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-center text-xs text-gray-500">
        {WORKSPACE_PORTAL_OPTIONS.find((option) => option.id === value)?.description}
      </p>
    </div>
  );
}
