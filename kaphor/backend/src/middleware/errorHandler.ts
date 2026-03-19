import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { logger } from '../lib/logger';

interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  details?: unknown;
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error(err instanceof Error ? err.message : String(err), {
    stack: err instanceof Error ? err.stack : undefined,
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (err instanceof ZodError) {
    const response: ErrorResponse = {
      error: 'VALIDATION_ERROR',
      message: err.message,
      statusCode: 422,
      details: err.flatten().fieldErrors,
    };
    res.status(422).json(response);
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const code = err.code;
    if (code === 'P2002') {
      res.status(409).json({
        error: 'CONFLICT',
        message: 'A record with this value already exists',
        statusCode: 409,
      });
      return;
    }
    if (code === 'P2025') {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Record not found',
        statusCode: 404,
      });
      return;
    }
    res.status(500).json({
      error: 'DATABASE_ERROR',
      message: isProd ? 'A database error occurred' : err.message,
      statusCode: 500,
    });
    return;
  }

  if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
    res.status(401).json({
      error: err instanceof jwt.TokenExpiredError ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
      message: err.message,
      statusCode: 401,
    });
    return;
  }

  if (err && typeof err === 'object' && 'code' in err) {
    const stripeError = err as any;
    if (stripeError.code?.startsWith('stripe_')) {
      res.status(400).json({
        error: 'PAYMENT_ERROR',
        message: isProd ? 'Payment processing failed' : stripeError.message,
        statusCode: 400,
      });
      return;
    }
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'FILE_TOO_LARGE', message: 'File size must not exceed 10MB', statusCode: 400 });
      return;
    }
    res.status(400).json({ error: 'INVALID_FILE', message: err.message, statusCode: 400 });
    return;
  }
  if (err instanceof Error && err.message === 'INVALID_FILE') {
    res.status(400).json({
      error: 'INVALID_FILE',
      message: 'Only JPEG, PNG, WebP allowed',
      statusCode: 400,
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: isProd ? 'An unexpected error occurred' : message,
    statusCode: 500,
  });
}
