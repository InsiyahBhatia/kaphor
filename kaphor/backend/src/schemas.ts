import { z } from 'zod';

// ── Address Schemas ────────────────────────────────────────────────────────────

/**
 * Indian pincode validation: 6 digits
 */
const pincodeSchema = z.string().regex(/^[1-9][0-9]{5}$/, 'Invalid pincode (must be 6 digits)');

/**
 * Indian mobile: 10 digits, optional +91 prefix
 */
const phoneSchema = z.string().regex(/^(\+91[\s-]?)?[6-9]\d{9}$/, 'Invalid phone number');

/**
 * Schema for creating a new address
 */
export const createAddressSchema = z.object({
  label: z.string().min(1).max(50, 'Label too long'),
  fullName: z.string().min(1).max(100, 'Name too long'),
  phone: phoneSchema,
  line1: z.string().min(3, 'Address too short').max(200, 'Address too long'),
  line2: z.string().max(200).optional().nullable(),
  landmark: z.string().max(200).optional().nullable(),
  city: z.string().min(2, 'City is required').max(100),
  state: z.string().min(2, 'State is required').max(100),
  pincode: pincodeSchema,
  isDefault: z.boolean().optional().default(false),
});

/**
 * Schema for updating an address (all fields optional)
 */
export const updateAddressSchema = z.object({
  label: z.string().min(1).max(50).optional(),
  fullName: z.string().min(1).max(100).optional(),
  phone: phoneSchema.optional(),
  line1: z.string().min(3).max(200).optional(),
  line2: z.string().max(200).optional().nullable(),
  landmark: z.string().max(200).optional().nullable(),
  city: z.string().min(2).max(100).optional(),
  state: z.string().min(2).max(100).optional(),
  pincode: pincodeSchema.optional(),
  isDefault: z.boolean().optional(),
});

/**
 * Route param for address ID
 */
export const addressIdParam = z.object({
  id: z.string().uuid('Address ID must be a valid UUID'),
});

// ── Shared Field Validators ────────────────────────────────────────────────────

/**
 * Email: valid format, then normalized (trim + lowercase) like the old normalizeEmail() sanitizer.
 */
const emailSchema = z
  .string()
  .email('Invalid email format')
  .transform((v) => v.trim().toLowerCase());

/**
 * Password: at least 10 chars with uppercase, lowercase, digit and special character.
 */
const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters long')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    'Password must contain uppercase, lowercase, number and special character'
  );

/** Strips all HTML tags (replaces the old sanitize-html-based sanitizer). */
function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]*>/g, '');
}

/**
 * Username: trimmed, alphanumeric, 3–20 chars.
 */
const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must be between 3 and 20 characters')
  .max(20, 'Username must be between 3 and 20 characters')
  .regex(/^[A-Za-z0-9]+$/, 'Username must be alphanumeric');

/**
 * Display name: HTML-stripped + trimmed, 2–50 chars.
 */
const displayNameSchema = z
  .string()
  .transform((v) => stripHtmlTags(v).trim())
  .refine((v) => v.length >= 2 && v.length <= 50, 'Display name must be between 2 and 50 characters');

// ── Auth Schemas ────────────────────────────────────────────────────────────────

/** POST /auth/register */
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  username: usernameSchema,
  displayName: displayNameSchema,
}).passthrough();

/** POST /auth/login — only email is validated; password presence is handled by the controller */
export const loginSchema = z.object({
  email: emailSchema,
}).passthrough();

/** POST /auth/forgot-password */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
}).passthrough();

/** POST /auth/reset-password — password is validated; token presence is handled by the controller */
export const resetPasswordSchema = z.object({
  password: passwordSchema,
}).passthrough();

// ── Garment Schemas ─────────────────────────────────────────────────────────────

/** Accepts a JSON number or a multipart/form-data numeric string. */
const moneyField = z.union([z.number(), z.string()]).optional().nullable();

/** Parses a possibly-empty money field to a finite number (null when absent/empty). */
function toFiniteNumber(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : Number.NaN;
}

/** POST / — create a garment listing */
export const createGarmentSchema = z
  .object({
    title: z.string().min(3).max(100),
    description: z.string().min(3).max(1000),
    category: z.string().min(1),
    condition: z.string().min(1),
    size: z.string().min(1),
    listingType: z.enum(['SALE', 'RENTAL', 'ACCESSORY_SWAP']),
    price: moneyField,
    originalPrice: moneyField,
    costPrice: moneyField,
    rentalPriceDay: moneyField,
    rentalPriceWeek: moneyField,
    isAccessory: z.union([z.boolean(), z.literal('true'), z.literal('false')]).optional(),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    const needsPrice = value.listingType === 'SALE';
    const needsRental = value.listingType === 'RENTAL';

    // price is required + numeric for SALE only (swaps don't require price)
    if (needsPrice) {
      const n = toFiniteNumber(value.price);
      if (n === null) {
        ctx.addIssue({ code: 'custom', path: ['price'], message: 'price is required for this listing type' });
      } else if (Number.isNaN(n) || n < 0) {
        ctx.addIssue({ code: 'custom', path: ['price'], message: 'price must be a number >= 0' });
      }
    }

    // rentalPriceDay is required + numeric for RENTAL
    if (needsRental) {
      const n = toFiniteNumber(value.rentalPriceDay);
      if (n === null) {
        ctx.addIssue({ code: 'custom', path: ['rentalPriceDay'], message: 'rentalPriceDay is required for RENTAL listings' });
      } else if (Number.isNaN(n) || n < 0) {
        ctx.addIssue({ code: 'custom', path: ['rentalPriceDay'], message: 'rentalPriceDay must be a number >= 0' });
      }
    }

    // rentalPriceWeek is validated whenever present
    const week = toFiniteNumber(value.rentalPriceWeek);
    if (week !== null && (Number.isNaN(week) || week < 0)) {
      ctx.addIssue({ code: 'custom', path: ['rentalPriceWeek'], message: 'rentalPriceWeek must be a number >= 0' });
    }

    // ACCESSORY_SWAP listings are strictly reserved for accessories
    if (value.listingType === 'ACCESSORY_SWAP') {
      const cat = String(value.category || '').toLowerCase();
      const sub = String((value as any).subCategory || '').toLowerCase();
      const accessoryTerms = [
        'accessory', 'accessories', 'bag', 'bags', 'jewelry', 'jewellery',
        'watch', 'watches', 'eyewear', 'belt', 'belts', 'hat', 'hats',
        'scarf', 'scarves', 'wallet', 'wallets', 'tie', 'ties',
        'footwear', 'shoes', 'sneakers', 'heels', 'boots', 'sandals'
      ];
      const isAcc = accessoryTerms.some(term => cat.includes(term) || sub.includes(term)) ||
        value.isAccessory === true || value.isAccessory === 'true';
      if (!isAcc) {
        ctx.addIssue({
          code: 'custom',
          path: ['category'],
          message: 'Only accessories (bags, jewelry, watches, eyewear, belts, hats, scarves, wallets, ties, footwear) are eligible for swap listings',
        });
      }
    }
  });

/** PUT /:id — update a garment listing (all fields optional) */
export const updateGarmentSchema = z
  .object({
    title: z.string().min(3).max(100).optional(),
    description: z.string().min(3).max(1000).optional(),
    category: z.string().min(1).optional(),
    condition: z.string().min(1).optional(),
    size: z.string().min(1).optional(),
    listingType: z.enum(['SALE', 'RENTAL', 'ACCESSORY_SWAP']).optional(),
    price: moneyField,
    originalPrice: moneyField,
    costPrice: moneyField,
    rentalPriceDay: moneyField,
    rentalPriceWeek: moneyField,
  })
  .passthrough()
  .superRefine((value, ctx) => {
    for (const key of ['price', 'rentalPriceDay', 'rentalPriceWeek'] as const) {
      const n = toFiniteNumber(value[key]);
      if (n !== null && (Number.isNaN(n) || n < 0)) {
        ctx.addIssue({ code: 'custom', path: [key], message: `${key} must be a number >= 0` });
      }
    }

    if (value.listingType === 'ACCESSORY_SWAP' && value.category) {
      const cat = String(value.category).toLowerCase();
      const accessoryTerms = [
        'accessory', 'accessories', 'bag', 'bags', 'jewelry', 'jewellery',
        'watch', 'watches', 'eyewear', 'belt', 'belts', 'hat', 'hats',
        'scarf', 'scarves', 'wallet', 'wallets', 'tie', 'ties',
        'footwear', 'shoes', 'sneakers', 'heels', 'boots', 'sandals'
      ];
      const isAcc = accessoryTerms.some(term => cat.includes(term));
      if (!isAcc) {
        ctx.addIssue({
          code: 'custom',
          path: ['category'],
          message: 'Only accessories are eligible for swap listings',
        });
      }
    }
  });

// ── Interaction Schemas ─────────────────────────────────────────────────────────

/** POST /interactions — record a behaviour event */
export const createInteractionSchema = z.object({
  garmentId: z.string().uuid('garmentId must be a valid UUID').optional().nullable(),
  eventType: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
}).passthrough();
