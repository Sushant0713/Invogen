import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Loader2, Package, Search, X } from 'lucide-react';
import { useCompanyProducts } from './use-company-products';

const PANEL_WIDTH = 320;
const PANEL_MAX_HEIGHT = 320;

export function ProductCellSelect({
  value,
  width,
  height,
  disabled,
  previewMode,
  fullWidth,
  onChange,
}: {
  value: string;
  width: number;
  height: number;
  disabled?: boolean;
  previewMode?: boolean;
  fullWidth?: boolean;
  onChange: (productName: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [listFilter, setListFilter] = useState('');
  const [debouncedFilter, setDebouncedFilter] = useState('');
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: PANEL_WIDTH });
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const startValueRef = useRef(value);

  useEffect(() => {
    if (!open && document.activeElement !== inputRef.current) {
      setDraft(value);
    }
  }, [value, open]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedFilter(listFilter.trim()), 200);
    return () => window.clearTimeout(timer);
  }, [listFilter]);

  const {
    data: products = [],
    isFetching,
    isError,
    error,
    refetch,
  } = useCompanyProducts({
    enabled: !previewMode,
    search: debouncedFilter,
  });

  const filtered = useMemo(() => {
    const q = listFilter.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q)
        || (p.sku || '').toLowerCase().includes(q)
        || (p.category || '').toLowerCase().includes(q)
    );
  }, [products, listFilter]);

  const updatePanelPosition = () => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.max(PANEL_WIDTH, rect.width);
    let left = rect.left;
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8);
    }
    let top = rect.bottom + 4;
    if (top + PANEL_MAX_HEIGHT > window.innerHeight - 8) {
      top = Math.max(8, rect.top - PANEL_MAX_HEIGHT - 4);
    }
    setPanelPos({ top, left, width });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePanelPosition();
    const onScrollOrResize = () => updatePanelPosition();
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [open]);

  const commitDraft = (next: string) => {
    const trimmed = next.trim();
    if (trimmed !== startValueRef.current.trim()) {
      onChange(trimmed);
      startValueRef.current = trimmed;
    }
    setDraft(trimmed);
  };

  const closePanel = (saveDraft: boolean) => {
    if (saveDraft) commitDraft(draft);
    setOpen(false);
    setListFilter('');
  };

  const pickProduct = (name: string) => {
    setDraft(name);
    commitDraft(name);
    setListFilter('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const openList = () => {
    startValueRef.current = value;
    setDraft(value);
    setListFilter('');
    setDebouncedFilter('');
    setOpen(true);
    void refetch();
    requestAnimationFrame(() => {
      updatePanelPosition();
      searchRef.current?.focus();
    });
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      closePanel(true);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDraft(startValueRef.current);
        setOpen(false);
        setListFilter('');
        inputRef.current?.blur();
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draft]);

  if (previewMode || disabled) {
    return (
      <div
        className={`flex h-full items-start overflow-hidden px-2 py-1 text-xs text-gray-700 ${
          fullWidth ? 'w-full' : ''
        }`}
        style={fullWidth ? { minHeight: height } : { width, height }}
        title={value || undefined}
      >
        <span className="block w-full min-w-0 whitespace-pre-wrap break-words">
          {value || '\u00a0'}
        </span>
      </div>
    );
  }

  const errorMessage =
    isError
      ? String((error as { response?: { data?: { message?: string } } })?.response?.data?.message
        || 'Could not load products')
      : '';

  const panel = open
    ? createPortal(
        <div
          ref={panelRef}
          className="fixed z-[9999] flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
          style={{
            top: panelPos.top,
            left: panelPos.left,
            width: panelPos.width,
            maxHeight: PANEL_MAX_HEIGHT,
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-gray-100 bg-gray-50 px-3 py-2">
            <p className="text-xs font-semibold text-gray-800">Select product</p>
            <p className="text-[11px] text-gray-500">
              From Admin → Products · or type a custom name
            </p>
          </div>

          <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-gray-400" />
            <input
              ref={searchRef}
              value={listFilter}
              onChange={(e) => setListFilter(e.target.value)}
              placeholder="Search products…"
              className="min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter' && draft.trim()) {
                  e.preventDefault();
                  pickProduct(draft.trim());
                }
              }}
            />
            {listFilter ? (
              <button
                type="button"
                className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Clear search"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setListFilter('')}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isError ? (
              <p className="px-3 py-4 text-sm text-red-600">{errorMessage}</p>
            ) : isFetching && products.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-6 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading products…
              </div>
            ) : filtered.length === 0 ? (
              <div className="space-y-2 px-3 py-4">
                <p className="text-sm text-gray-500">
                  {products.length === 0 && !listFilter.trim()
                    ? 'No products yet. Add them in Admin → Products.'
                    : 'No matching products.'}
                </p>
                {draft.trim() ? (
                  <button
                    type="button"
                    className="w-full rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-left text-sm font-medium text-primary hover:bg-primary/10"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickProduct(draft.trim())}
                  >
                    Use “{draft.trim()}”
                  </button>
                ) : null}
              </div>
            ) : (
              <ul className="py-1">
                {filtered.map((product) => {
                  const selected = product.name === value;
                  return (
                    <li key={product._id}>
                      <button
                        type="button"
                        className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-orange-50 ${
                          selected ? 'bg-orange-50' : ''
                        }`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickProduct(product.name)}
                      >
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                          <Package className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-gray-900">
                            {product.name}
                          </span>
                          <span className="mt-0.5 block text-xs text-gray-500">
                            {[
                              product.sku ? `SKU: ${product.sku}` : '',
                              product.price != null ? `₹${product.price}` : '',
                            ]
                              .filter(Boolean)
                              .join(' · ') || 'Product'}
                          </span>
                        </span>
                        {selected ? (
                          <Check className="mt-1 h-4 w-4 shrink-0 text-primary" />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-gray-100 bg-gray-50 px-3 py-2">
            <p className="text-[11px] text-gray-500">
              {isFetching ? 'Updating…' : `${filtered.length} product${filtered.length === 1 ? '' : 's'}`}
            </p>
            <div className="flex gap-2">
              {value ? (
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-white"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickProduct('')}
                >
                  Clear
                </button>
              ) : null}
              {draft.trim()
                && !filtered.some((p) => p.name.toLowerCase() === draft.trim().toLowerCase()) && (
                <button
                  type="button"
                  className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-white hover:bg-primary/90"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickProduct(draft.trim())}
                >
                  Use typed name
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div
      ref={rootRef}
      className={`relative shrink-0 ${fullWidth ? 'w-full' : ''}`}
      style={fullWidth ? { minHeight: height } : { width, height }}
    >
      <div
        className="flex h-full w-full items-center gap-0.5 overflow-hidden px-1.5"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={draft}
          placeholder="Click to choose product"
          className="min-w-0 flex-1 bg-transparent text-xs text-gray-800 outline-none placeholder:text-gray-400"
          onFocus={() => openList()}
          onChange={(e) => {
            const next = e.target.value;
            setDraft(next);
            setListFilter(next);
            if (!open) {
              setOpen(true);
              requestAnimationFrame(updatePanelPosition);
            }
          }}
          onBlur={() => {
            window.setTimeout(() => {
              if (
                !rootRef.current?.contains(document.activeElement)
                && !panelRef.current?.contains(document.activeElement)
              ) {
                closePanel(true);
              }
            }, 120);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
              e.preventDefault();
              commitDraft(draft);
              setOpen(false);
              setListFilter('');
              inputRef.current?.blur();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              setDraft(startValueRef.current);
              setOpen(false);
              setListFilter('');
              inputRef.current?.blur();
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              openList();
            }
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label="Open product list"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (open) closePanel(true);
            else openList();
          }}
        >
          {isFetching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      {panel}
    </div>
  );
}
