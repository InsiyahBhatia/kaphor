export const MARKET_CATEGORIES = [
  {
    group: 'ETHNIC',
    items: ['Sarees', 'Lehengas', 'Anarkalis', 'Sherwanis', 'Suits', 'Kurtas', 'Dupattas'],
  },
  {
    group: 'APPAREL',
    items: ['Jackets', 'Coats', 'Blazers', 'Dresses', 'Tops', 'Shirts', 'Bottoms', 'Denims', 'Knitwear'],
  },
  {
    group: 'ACCESSORIES',
    items: ['Bags', 'Jewelry', 'Watches', 'Eyewear', 'Belts', 'Hats', 'Scarves', 'Wallets', 'Ties'],
  },
  {
    group: 'FOOTWEAR',
    items: ['Sneakers', 'Heels', 'Boots', 'Dress Shoes', 'Sandals', 'Traditionals'],
  },
];

export const ALL_CATEGORY_ITEMS = MARKET_CATEGORIES.flatMap((c) => c.items);

export const ACCESSORY_CATEGORY_ITEMS = [
  ...MARKET_CATEGORIES.find((c) => c.group === 'ACCESSORIES')?.items || [],
  ...MARKET_CATEGORIES.find((c) => c.group === 'FOOTWEAR')?.items || [],
];

export function isAccessoryCategory(category?: string | null, subCategory?: string | null): boolean {
  if (!category && !subCategory) return false;
  const terms = [
    'accessory', 'accessories', 'bag', 'bags', 'jewelry', 'jewellery',
    'watch', 'watches', 'eyewear', 'sunglasses', 'belt', 'belts', 'hat', 'hats',
    'cap', 'caps', 'headwear', 'scarf', 'scarves', 'wallet', 'wallets', 'tie', 'ties',
    'footwear', 'shoes', 'sneakers', 'heels', 'boots', 'sandals',
  ];
  const cat = (category || '').trim().toLowerCase();
  const sub = (subCategory || '').trim().toLowerCase();
  return terms.some((t) => cat.includes(t) || sub.includes(t)) ||
    ACCESSORY_CATEGORY_ITEMS.some((i) => i.toLowerCase() === cat || i.toLowerCase() === sub);
}

export const MARKET_CONDITIONS = [
  { id: 'PRISTINE', label: 'PRISTINE', desc: 'Brand new / unworn heritage piece.' },
  { id: 'MINOR_WEAR', label: 'MINOR WEAR', desc: 'Gently loved with faint signs of life.' },
  { id: 'UPCYCLE', label: 'UPCYCLE', desc: 'Reconstructed artistry from archival fabrics.' },
  { id: 'RECYCLE_ONLY', label: 'RECYCLE ONLY', desc: 'End-of-life garment for fiber recovery.' },
];

export const LISTING_TYPES = [
  { id: 'SALE', label: 'SALE', desc: 'Direct purchase at a fixed price.' },
  { id: 'RENTAL', label: 'RENTAL', desc: 'Temporary access for a specific duration.' },
  { id: 'ACCESSORY_SWAP', label: 'SWAP', desc: 'Direct exchange for other assets.' },
];

export const MARKET_SIZES = ['FREE SIZE', 'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
