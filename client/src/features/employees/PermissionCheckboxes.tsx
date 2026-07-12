import {
  EMPLOYEE_ASSIGNABLE_PERMISSIONS,
  EMPLOYEE_PERMISSION_OPTIONS,
  INVOICE_CREATE_BUNDLE_PERMISSIONS,
  isAllPermissionsActive,
  isCreateDeleteBundleActive,
  PERMISSIONS,
  type EmployeePermissionUiKey,
  type Permission,
} from '@invogen/shared';
import { cn } from '@/lib/utils';

const NESTED_PERMISSION_OPTIONS = EMPLOYEE_PERMISSION_OPTIONS.filter(
  (option) => option.key === PERMISSIONS.TEMPLATE_CREATE
);

const PRIMARY_PERMISSION_OPTIONS = EMPLOYEE_PERMISSION_OPTIONS.filter(
  (option) => option.key !== PERMISSIONS.TEMPLATE_CREATE
);

// Dependencies: turning ON a key auto-enables all required permissions.
// Turning OFF a base permission also turns OFF anything that depends on it.
const PERMISSION_DEPENDENCIES: Partial<Record<Permission, Permission[]>> = {
  'invoice.edit': ['invoice.view'],
  'invoice.delete': ['invoice.view'],
  'invoice.create': [
    'invoice.view',
    'invoice.edit',
    'template.view',
  ],
  'template.edit': ['template.view'],
  'template.create': ['template.edit', 'template.view'],
  'customer.manage': ['invoice.view'],
};

function addWithDependencies(selected: Set<Permission>, permission: Permission) {
  const stack: Permission[] = [permission];
  while (stack.length) {
    const current = stack.pop()!;
    if (selected.has(current)) continue;
    selected.add(current);
    const deps = PERMISSION_DEPENDENCIES[current] || [];
    deps.forEach((dep) => stack.push(dep));
  }
}

function removeWithDependents(selected: Set<Permission>, permission: Permission) {
  selected.delete(permission);
  let changed = true;
  while (changed) {
    changed = false;
    for (const perm of Array.from(selected)) {
      const deps = PERMISSION_DEPENDENCIES[perm] || [];
      if (deps.some((dep) => !selected.has(dep))) {
        selected.delete(perm);
        changed = true;
      }
    }
  }
}

function isCreateActive(permissions: Permission[]) {
  return permissions.includes(PERMISSIONS.INVOICE_CREATE);
}

function isOptionChecked(optionKey: EmployeePermissionUiKey, permissions: Permission[]) {
  if (optionKey === 'all') {
    return isAllPermissionsActive(permissions);
  }
  if (optionKey === 'create_with_delete') {
    return isCreateDeleteBundleActive(permissions);
  }
  if (optionKey === PERMISSIONS.INVOICE_CREATE) {
    return isCreateActive(permissions);
  }
  return permissions.includes(optionKey);
}

interface PermissionCheckboxesProps {
  value: Permission[];
  onChange: (permissions: Permission[]) => void;
  disabled?: boolean;
  className?: string;
}

export function PermissionCheckboxes({
  value,
  onChange,
  disabled,
  className,
}: PermissionCheckboxesProps) {
  const toggle = (optionKey: EmployeePermissionUiKey) => {
    if (disabled) return;
    const next = new Set<Permission>(value);

    if (optionKey === 'all') {
      if (isAllPermissionsActive(value)) {
        onChange([]);
      } else {
        onChange([...EMPLOYEE_ASSIGNABLE_PERMISSIONS]);
      }
      return;
    }

    if (optionKey === 'create_with_delete') {
      if (isCreateDeleteBundleActive(value)) {
        next.delete(PERMISSIONS.INVOICE_DELETE);
      } else {
        INVOICE_CREATE_BUNDLE_PERMISSIONS.forEach((permission) => next.add(permission));
        next.add(PERMISSIONS.INVOICE_DELETE);
        addWithDependencies(next, PERMISSIONS.INVOICE_CREATE);
      }
      onChange(Array.from(next));
      return;
    }

    if (optionKey === PERMISSIONS.INVOICE_CREATE) {
      if (isCreateActive(value)) {
        removeWithDependents(next, PERMISSIONS.INVOICE_CREATE);
        if (isCreateDeleteBundleActive(Array.from(next))) {
          next.delete(PERMISSIONS.INVOICE_DELETE);
        }
      } else {
        addWithDependencies(next, PERMISSIONS.INVOICE_CREATE);
      }
      onChange(Array.from(next));
      return;
    }

    const permission = optionKey as Permission;
    if (next.has(permission)) {
      removeWithDependents(next, permission);
    } else {
      addWithDependencies(next, permission);
    }
    onChange(Array.from(next));
  };

  return (
    <div className={cn('space-y-3', className)}>
      <p className="text-sm font-medium text-gray-900">Feature access</p>
      <p className="text-xs text-gray-500">
        Register and login are always available. Choose which admin features this employee can use.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {PRIMARY_PERMISSION_OPTIONS.map((option) => {
          const checked = isOptionChecked(option.key, value);
          const showAddTemplates =
            option.key === PERMISSIONS.TEMPLATE_EDIT && value.includes(PERMISSIONS.TEMPLATE_EDIT);
          return (
            <div key={option.bundle ?? option.key} className={showAddTemplates ? 'sm:col-span-2' : undefined}>
              <label
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-colors',
                  checked ? 'border-primary bg-primary/5' : 'border-gray-200 bg-white',
                  disabled && 'cursor-not-allowed opacity-60'
                )}
              >
                <input
                  type="checkbox"
                  className="mt-1 rounded"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggle(option.key)}
                />
                <span>
                  <span className="block text-sm font-medium text-gray-900">{option.label}</span>
                  <span className="block text-xs text-gray-500">{option.description}</span>
                </span>
              </label>
              {showAddTemplates && (
                <div className="mt-2 ml-4 grid gap-2 sm:grid-cols-2">
                  {NESTED_PERMISSION_OPTIONS.map((nested) => {
                    const nestedChecked = isOptionChecked(nested.key, value);
                    return (
                      <label
                        key={nested.key}
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-colors',
                          nestedChecked ? 'border-primary bg-primary/5' : 'border-gray-200 bg-white',
                          disabled && 'cursor-not-allowed opacity-60'
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 rounded"
                          checked={nestedChecked}
                          disabled={disabled}
                          onChange={() => toggle(nested.key)}
                        />
                        <span>
                          <span className="block text-sm font-medium text-gray-900">{nested.label}</span>
                          <span className="block text-xs text-gray-500">{nested.description}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
