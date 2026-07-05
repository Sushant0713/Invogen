import { useRef, useState } from 'react';
import { ChevronDown, ImageIcon, Stamp, PenLine, Building2, Barcode } from 'lucide-react';
import { ComponentType } from '@invogen/shared';
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch';
import { addElement, setImageCropMode } from '@/store/slices/builderSlice';
import { createCanvasElement, getDefaultElementSize, PAGE_WIDTH } from './builder-dnd';
import { getPaletteItem } from './palette-catalog';
import { getImageDefaultProps } from './image-components';
import { getImageUploadPatch } from './image-crop';
import { useImageUpload } from './use-image-upload';

const INSERT_OPTIONS = [
  { type: ComponentType.IMAGE, label: 'Image', icon: ImageIcon },
  { type: ComponentType.LOGO, label: 'Logo', icon: Building2 },
  { type: ComponentType.SIGNATURE, label: 'Signature', icon: PenLine },
  { type: ComponentType.STAMP, label: 'Stamp', icon: Stamp },
  { type: ComponentType.BARCODE, label: 'Barcode', icon: Barcode },
] as const;

export function InsertImageMenu() {
  const dispatch = useAppDispatch();
  const { pages, activePageIndex } = useAppSelector((s) => s.builder);
  const [open, setOpen] = useState(false);
  const pendingTypeRef = useRef<string>(ComponentType.IMAGE);

  const insertImageElement = (type: string, src?: string) => {
    const page = pages[activePageIndex];
    const paletteItem = getPaletteItem(type);
    const defaultProps = {
      ...(paletteItem?.defaultProps ?? getImageDefaultProps(type)),
      ...(src ? getImageUploadPatch(src) : {}),
    };
    const { width } = getDefaultElementSize(type);

    const element = createCanvasElement(
      type,
      (PAGE_WIDTH - width) / 2,
      page.margins.top + 80,
      defaultProps,
      page.margins
    );
    dispatch(addElement(element));
    if (src) {
      dispatch(setImageCropMode(element.id));
    }
    setOpen(false);
  };

  const { input, pickFile, uploading } = useImageUpload((url) => {
    insertImageElement(pendingTypeRef.current, url);
  });

  const handlePick = (type: string) => {
    pendingTypeRef.current = type;
    pickFile();
  };

  return (
    <div className="relative">
      {input}
      <button
        type="button"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
        onClick={() => setOpen((v) => !v)}
        title="Insert image on the page"
      >
        <ImageIcon className="h-4 w-4 text-primary" />
        <span className="hidden sm:inline">Insert image</span>
        <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            {INSERT_OPTIONS.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-primary-50 hover:text-primary"
                onClick={() => {
                  pendingTypeRef.current = type;
                  insertImageElement(type);
                  setOpen(false);
                }}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
            <div className="my-1 border-t border-gray-100" />
            <button
              type="button"
              disabled={uploading}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-primary-50 hover:text-primary disabled:opacity-50"
              onClick={() => {
                setOpen(false);
                handlePick(ComponentType.IMAGE);
              }}
            >
              <ImageIcon className="h-4 w-4 shrink-0" />
              {uploading ? 'Uploading…' : 'Upload from computer…'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
