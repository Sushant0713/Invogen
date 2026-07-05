import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';
import type { RefObject } from 'react';
import {
  ensureGoogleFontLoaded,
  fetchGoogleFonts,
  getGoogleFontsSync,
  parseFontFamilyName,
  type GoogleFontEntry,
} from './google-fonts';

function useClickOutside(
  buttonRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void
) {
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: globalThis.MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open, onClose, buttonRef, panelRef]);
}

interface FontFamilyPickerProps {
  value: string;
  onChange: (family: string) => void;
}

export function FontFamilyPicker({ value, onChange }: FontFamilyPickerProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [fonts, setFonts] = useState<GoogleFontEntry[]>(getGoogleFontsSync());
  const [loading, setLoading] = useState(true);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 280 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selectedName = parseFontFamilyName(value);

  useEffect(() => {
    let active = true;
    fetchGoogleFonts()
      .then((list) => {
        if (active) setFonts(list);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    ensureGoogleFontLoaded(selectedName);
  }, [selectedName]);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const width = Math.max(280, rect.width);
    const left = Math.min(rect.left, window.innerWidth - width - 12);
    setPosition({
      top: rect.bottom + 8,
      left: Math.max(12, left),
      width,
    });
  }, [open, fonts.length]);

  useClickOutside(buttonRef, panelRef, open, () => {
    setOpen(false);
    setQuery('');
  });

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? fonts.filter((font) => font.family.toLowerCase().includes(normalizedQuery))
    : fonts;
  const visibleFonts = filtered.slice(0, normalizedQuery ? 400 : 120);
  const hiddenCount = Math.max(0, filtered.length - visibleFonts.length);

  const handleSelect = (family: string) => {
    ensureGoogleFontLoaded(family);
    onChange(family);
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-8 min-w-[132px] max-w-[180px] items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium transition-colors ${
          open ? 'border-primary/40 bg-primary/5 text-primary' : 'text-gray-700 hover:bg-gray-50'
        }`}
        style={{ fontFamily: `"${selectedName}", sans-serif` }}
      >
        <span className="truncate">{selectedName}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          id={listId}
          role="listbox"
          style={{
            position: 'fixed',
            top: position.top,
            left: position.left,
            width: position.width,
            zIndex: 10000,
          }}
          className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="border-b border-gray-100 p-2">
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search all Google fonts"
                className="w-full bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            {loading && (
              <p className="px-3 py-2 text-xs text-gray-500">Loading Google fonts…</p>
            )}
            {!loading && filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-gray-500">No fonts match your search.</p>
            )}
            {visibleFonts.map((font) => (
              <button
                key={font.family}
                type="button"
                role="option"
                aria-selected={font.family === selectedName}
                onMouseEnter={() => ensureGoogleFontLoaded(font.family)}
                onClick={() => handleSelect(font.family)}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 ${
                  font.family === selectedName ? 'bg-primary/5 text-primary' : 'text-gray-800'
                }`}
                style={{ fontFamily: `"${font.family}", sans-serif` }}
              >
                <span>{font.family}</span>
                <span className="text-[10px] capitalize text-gray-400">{font.category}</span>
              </button>
            ))}
            {hiddenCount > 0 && (
              <p className="border-t border-gray-100 px-3 py-2 text-[10px] text-gray-400">
                {hiddenCount} more fonts — keep typing to narrow results
              </p>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
