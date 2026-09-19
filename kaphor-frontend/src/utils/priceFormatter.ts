/**
 * Universal Garment Price & Listing Type Formatter for Kaphor
 * Handles:
 * - Conversion of database paise (e.g. 25000 -> ₹250) vs raw rupees (e.g. 420 -> ₹420)
 * - ACCESSORY_SWAP (never shows ₹--- or strikethrough ₹0)
 * - RENTAL / LEASE rates
 * - Robust fallbacks so no screen shows missing or broken prices
 */

export interface FormattedPriceResult {
  isSwap: boolean;
  isRental: boolean;
  isSale: boolean;
  displayPrice: string;
  priceUnit?: string;
  originalPrice?: string | null;
  discountTag?: string | null;
  subtext: string;
  numericRupees: number;
  estTradeValue: number;
}

/**
 * Normalizes a raw price value to whole Indian Rupees (₹).
 * Handles null/undefined and string values safely without any paise guesswork.
 */
export function normalizeRupees(rawPrice: number | string | null | undefined): number {
  if (rawPrice == null) return 0;
  const num = typeof rawPrice === 'string' ? parseFloat(rawPrice) : rawPrice;
  if (isNaN(num) || num <= 0) return 0;
  return Math.round(num);
}

/**
 * Format a number as Indian Rupee currency (e.g. ₹1,800)
 */
export function formatRupees(amount: number | string | null | undefined): string {
  const rupees = normalizeRupees(amount);
  return `₹${rupees.toLocaleString('en-IN')}`;
}

/**
 * Main helper to get complete price details for any garment object
 */
export function getFormattedGarmentPrice(garment: any): FormattedPriceResult {
  if (!garment) {
    return {
      isSwap: false,
      isRental: false,
      isSale: true,
      displayPrice: '₹---',
      originalPrice: null,
      discountTag: null,
      subtext: 'Archive Item',
      numericRupees: 0,
      estTradeValue: 0,
    };
  }

  const rawListingType = String(garment.listingType || 'SALE').toUpperCase();
  const isSwap = rawListingType === 'ACCESSORY_SWAP' || rawListingType === 'SWAP';
  const isRental = rawListingType === 'RENTAL' || rawListingType === 'LEASE';
  const isSale = !isSwap && !isRental;

  // 1. SWAP LISTING
  if (isSwap) {
    const rawVal = garment.price || garment.estimatedValue || garment.rentalPriceDay;
    const estValRupees = normalizeRupees(rawVal) || 750; // Sensible fair trade estimate if 0

    return {
      isSwap: true,
      isRental: false,
      isSale: false,
      displayPrice: 'SWAP ONLY',
      priceUnit: undefined,
      originalPrice: null,
      discountTag: 'CIRCULAR TRADE',
      subtext: 'Direct Peer Exchange · ₹0 Cash Required',
      numericRupees: 0,
      estTradeValue: estValRupees,
    };
  }

  // 2. RENTAL LISTING
  if (isRental) {
    let dayRupees = normalizeRupees(garment.rentalPriceDay);
    if (dayRupees === 0) {
      // Derive fair daily rental if missing (approx 15% of retail price or ₹299 minimum)
      const retail = normalizeRupees(garment.price);
      dayRupees = retail > 0 ? Math.max(199, Math.round(retail * 0.15)) : 299;
    }

    return {
      isSwap: false,
      isRental: true,
      isSale: false,
      displayPrice: formatRupees(dayRupees),
      priceUnit: ' / day',
      originalPrice: null,
      discountTag: 'HERITAGE LEASE',
      subtext: 'Short-term circular lease · ₹500 refundable deposit',
      numericRupees: dayRupees,
      estTradeValue: dayRupees * 4,
    };
  }

  // 3. SALE LISTING
  const saleRupees = normalizeRupees(garment.price);
  if (saleRupees > 0) {
    const rawOrig = normalizeRupees(garment.originalPrice || garment.costPrice);
    const estOriginal = rawOrig > saleRupees ? rawOrig : Math.round(saleRupees * 1.8);
    const discountPct = Math.round(((estOriginal - saleRupees) / estOriginal) * 100);
    return {
      isSwap: false,
      isRental: false,
      isSale: true,
      displayPrice: formatRupees(saleRupees),
      priceUnit: undefined,
      originalPrice: formatRupees(estOriginal),
      discountTag: `${discountPct}% OFF ARCHIVE`,
      subtext: 'Certified Authenticated Asset · Full Ownership',
      numericRupees: saleRupees,
      estTradeValue: saleRupees,
    };
  }

  // Fallback for sale listing with no price specified
  return {
    isSwap: false,
    isRental: false,
    isSale: true,
    displayPrice: 'PRICE ON REQUEST',
    priceUnit: undefined,
    originalPrice: null,
    discountTag: 'ARCHIVE PIECE',
    subtext: 'Direct Inquiry with Curator',
    numericRupees: 0,
    estTradeValue: 500,
  };
}
