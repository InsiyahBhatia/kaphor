import { Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import sanitizeHtml from 'sanitize-html';

/**
 * Strips all HTML tags from a string.
 */
export const sanitizeText = (value: string) => {
  if (typeof value !== 'string') return value;
  return sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {},
  });
};

/**
 * Middleware to check for validation errors and return them.
 */
export const validateRequeset = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'VALIDATION_ERROR', 
      errors: errors.array().map(err => ({ field: (err as any).path, message: err.msg })) 
    });
  }
  next();
};

/**
 * Common validation rules
 */
export const commonValidations = {
  uuid: (name: string) => param(name).isUUID().withMessage(`${name} must be a valid UUID`),
  email: () => body('email').isEmail().withMessage('Invalid email format').normalizeEmail(),
  password: () => body('password')
    .isLength({ min: 10 })
    .withMessage('Password must be at least 10 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number and special character'),
  username: () => body('username').isAlphanumeric().isLength({ min: 3, max: 20 }).trim(),
  displayName: () => body('displayName').customSanitizer(sanitizeText).isLength({ min: 2, max: 50 }).trim(),
};
