import { forwardRef, useState, type ChangeEvent, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getFieldInputProps,
  normalizeFieldInput,
  type FieldKind,
} from '@/lib/form-fields';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  /** Applies correct type, inputMode, pattern, autocomplete, and input normalization. */
  fieldKind?: FieldKind;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, type, fieldKind, onChange, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const kindProps = fieldKind ? getFieldInputProps(fieldKind) : {};
    const resolvedType = type ?? kindProps.type ?? 'text';
    const isPassword = resolvedType === 'password';
    const inputId = id || label?.toLowerCase().replace(/\s/g, '-');

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      if (fieldKind) {
        const normalized = normalizeFieldInput(fieldKind, e.target.value);
        if (normalized !== e.target.value) {
          onChange?.({
            ...e,
            target: { ...e.target, value: normalized },
            currentTarget: { ...e.currentTarget, value: normalized },
          });
          return;
        }
      }
      onChange?.(e);
    };

    const { type: _kindType, onChange: _kindOnChange, ...restKindProps } = kindProps;

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full rounded-xl border border-gray-200 bg-white/80 px-4 py-2.5 text-sm transition-all',
              'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
              error && 'border-red-500',
              isPassword && 'pr-11 [&::-ms-clear]:hidden [&::-ms-reveal]:hidden',
              className
            )}
            {...restKindProps}
            {...props}
            type={isPassword && showPassword ? 'text' : resolvedType}
            onChange={handleChange}
          />
          {isPassword && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
