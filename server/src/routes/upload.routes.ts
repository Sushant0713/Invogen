import { Router, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { authenticate } from '../middlewares/auth.middleware';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/AppError';
import { mediaService } from '../services/media.service';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { param } from '../utils/controller';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const router = Router();

/** Relative path — clients resolve via same-origin proxy; use API_PUBLIC_URL when an absolute URL is required. */
const buildMediaUrl = (id: string) => `/api/v1/uploads/${id}`;

router.post(
  '/image',
  authenticate,
  upload.single('file'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new AppError('No file uploaded', 400);

      const media = await mediaService.saveFile({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        originalname: req.file.originalname,
        size: req.file.size,
        uploadedBy: req.user!.userId,
        companyId: req.user!.companyId,
      });

      const id = media._id.toString();
      return sendSuccess(res, {
        id,
        url: buildMediaUrl(id),
        filename: media.filename,
        mimetype: media.mimetype,
        size: media.size,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/file',
  authenticate,
  upload.single('file'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new AppError('No file uploaded', 400);

      const media = await mediaService.saveFile({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        originalname: req.file.originalname,
        size: req.file.size,
        uploadedBy: req.user!.userId,
        companyId: req.user!.companyId,
      });

      const id = media._id.toString();
      return sendSuccess(res, {
        id,
        url: buildMediaUrl(id),
        filename: media.filename,
        mimetype: media.mimetype,
        size: media.size,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/:id', async (req, res: Response, next: NextFunction) => {
  try {
    const media = await mediaService.getFile(param(req.params.id));
    res.set('Content-Type', media.mimetype);
    res.set('Content-Length', String(media.size));
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(media.data);
  } catch (error) {
    next(error);
  }
});

router.delete(
  '/:id',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await mediaService.deleteFile(param(req.params.id), req.user!.companyId);
      return sendSuccess(res, null, 'File deleted');
    } catch (error) {
      next(error);
    }
  }
);

export default router;
