import { z, ZodError } from 'zod';
import { Request, Response, NextFunction } from 'express';

type ValidationSchemas = {
  body?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  params?: z.ZodTypeAny;
};

export function validate(schemas: ValidationSchemas) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) req.query = schemas.query.parse(req.query) as any;
      if (schemas.params) req.params = schemas.params.parse(req.params) as any;
      next();
    } catch (e) {
      if (e instanceof z.ZodError) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: e.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
        return;
      }
      next(e);
    }
  };
}
