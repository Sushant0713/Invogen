import { useRef, useState } from 'react';
import { FileText, ImagePlus, Loader2, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resolveMediaUrl } from '@/lib/media';
import { uploadFile, type UploadedFile } from '@/lib/upload';
import { toast } from 'sonner';

interface FileUploadProps {
  label: string;
  hint?: string;
  value?: string;
  filename?: string;
  accept?: string;
  previewType?: 'image' | 'document';
  onChange: (url: string, meta?: { filename: string; mimetype: string }) => void;
  onClear?: () => void;
  className?: string;
  uploadFn?: (file: File) => Promise<UploadedFile>;
}

export function FileUpload({
  label,
  hint,
  value,
  filename,
  accept = 'image/*',
  previewType = 'image',
  onChange,
  onClear,
  className,
  uploadFn,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleSelect = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const result = await (uploadFn || uploadFile)(file);
      onChange(result.url, { filename: result.filename, mimetype: result.mimetype });
      toast.success(`${label} uploaded`);
    } catch {
      toast.error(`Failed to upload ${label.toLowerCase()}`);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const mediaUrl = resolveMediaUrl(value);
  const isPdf =
    mediaUrl?.includes('/uploads/') &&
    (filename?.toLowerCase().endsWith('.pdf') || previewType === 'document');

  return (
    <div className={cn('space-y-2', className)}>
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {hint && <p className="text-xs text-gray-500">{hint}</p>}
      </div>

      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 p-4">
        {mediaUrl && previewType === 'image' && !isPdf ? (
          <div className="flex items-start gap-4">
            <img
              src={mediaUrl}
              alt={label}
              className="h-20 w-20 rounded-lg border border-gray-200 bg-white object-contain"
            />
            <div className="flex flex-1 flex-col gap-2">
              <p className="text-xs text-gray-500 truncate">{filename || 'Uploaded file'}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Replace
                </button>
                {onClear && (
                  <button
                    type="button"
                    onClick={onClear}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
                  >
                    <X className="h-3.5 w-3.5" />
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : mediaUrl ? (
          <div className="flex items-start gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-gray-200 bg-white">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <p className="text-sm font-medium text-gray-800 truncate">{filename || 'Uploaded document'}</p>
              <a
                href={mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                View file
              </a>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Replace
                </button>
                {onClear && (
                  <button
                    type="button"
                    onClick={onClear}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
                  >
                    <X className="h-3.5 w-3.5" />
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 py-4 text-gray-500 hover:text-primary disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : previewType === 'image' ? (
              <ImagePlus className="h-8 w-8" />
            ) : (
              <Upload className="h-8 w-8" />
            )}
            <span className="text-sm font-medium">{uploading ? 'Uploading...' : `Upload ${label.toLowerCase()}`}</span>
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleSelect(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
