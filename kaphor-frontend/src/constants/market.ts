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
