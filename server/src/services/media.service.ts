import { Media } from '../models';
import { AppError } from '../utils/AppError';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIMETYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/avif',
  'image/bmp',
  'application/pdf',
];

const MIME_ALIASES: Record<string, string> = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/x-png': 'image/png',
};

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  bmp: 'image/bmp',
  pdf: 'application/pdf',
};

function resolveMimetype(mimetype: string, originalname: string): string {
  const lower = (mimetype || '').toLowerCase();
  if (MIME_ALIASES[lower]) return MIME_ALIASES[lower];
  if (ALLOWED_MIMETYPES.includes(lower)) return lower;
  const ext = originalname.split('.').pop()?.toLowerCase();
  if (ext && EXT_TO_MIME[ext]) return EXT_TO_MIME[ext];
  return lower;
}

export const mediaService = {
  async saveFile(data: {
    buffer: Buffer;
    mimetype: string;
    originalname: string;
    size: number;
    uploadedBy: string;
    companyId: string | null;
  }) {
    if (data.size > MAX_FILE_SIZE) {
      throw new AppError('File too large (max 5MB)', 400);
    }
    const mimetype = resolveMimetype(data.mimetype, data.originalname);
    if (!ALLOWED_MIMETYPES.includes(mimetype)) {
      throw new AppError(
        `Unsupported file type (${data.mimetype || 'unknown'}). Use JPG, PNG, GIF, WebP, or SVG.`,
        400
      );
    }

    const media = await Media.create({
      companyId: data.companyId || null,
      uploadedBy: data.uploadedBy,
      filename: data.originalname,
      mimetype,
      size: data.size,
      data: data.buffer,
    });

    return media;
  },

  async getFile(id: string) {
    const media = await Media.findById(id);
    if (!media) throw new AppError('File not found', 404);
    return media;
  },

  async deleteFile(id: string, companyId: string | null) {
    const filter: Record<string, unknown> = { _id: id };
    if (companyId) filter.companyId = companyId;
    const media = await Media.findOneAndDelete(filter);
    if (!media) throw new AppError('File not found', 404);
    return media;
  },
};
