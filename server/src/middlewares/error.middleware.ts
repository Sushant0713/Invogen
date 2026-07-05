import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { sendError } from '../utils/response';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof AppError) {
    return sendError(res, err.message, err.statusCode);
  }

  if (err.name === 'ValidationError') {
    return sendError(res, err.message, 400);
  }

  if (err.name === 'CastError') {
    return sendError(res, 'Invalid ID format', 400);
  }

  if ((err as { code?: number }).code === 11000) {
    return sendError(res, 'Duplicate field value', 409);
  }

  console.error('Unhandled error:', err);
  return sendError(res, 'Internal server error', 500);
};

export const notFound = (_req: Request, res: Response) => {
  return sendError(res, 'Route not found', 404);
};
