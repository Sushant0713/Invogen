import { useCallback, useRef, useState } from 'react';
import axios from 'axios';
import { uploadImage } from '@/lib/upload';
import { toast } from 'sonner';
import { UPLOAD_IMAGE_PROPS } from './image-crop';

const ALLOWED_IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'bmp']);

function isAllowedImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  const ext = file.name.split('.').pop()?.toLowerCase();
  return !!ext && ALLOWED_IMAGE_EXT.has(ext);
}

export function useImageUpload(onSuccess: (url: string) => void) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const pickFile = () => inputRef.current?.click();

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!isAllowedImageFile(file)) {
      toast.error('Please choose a JPG, PNG, GIF, WebP, or SVG image');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB');
      return;
    }
    setUploading(true);
    try {
      const result = await uploadImage(file);
      onSuccess(result.url);
      toast.success('Image uploaded');
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? (error.response?.data as { message?: string } | undefined)?.message
        : undefined;
      toast.error(message || 'Upload failed — check you are signed in and try again');
    } finally {
      setUploading(false);
    }
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => {
        void handleFile(e.target.files?.[0]);
        e.target.value = '';
      }}
    />
  );

  return { input, pickFile, uploading, handleFile, uploadProps: UPLOAD_IMAGE_PROPS };
}
