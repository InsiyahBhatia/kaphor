"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MARKET_SIZES = exports.LISTING_TYPES = exports.MARKET_CONDITIONS = exports.ACCESSORY_CATEGORY_ITEMS = exports.ALL_CATEGORY_ITEMS = exports.MARKET_CATEGORIES = void 0;
exports.isAccessoryCategory = isAccessoryCategory;
exports.MARKET_CATEGORIES = [
    {
        group: 'ETHNIC',
        items: ['Sarees', 'Lehengas', 'Anarkalis', 'Sherwanis', 'Suits', 'Kurtas', 'Dupattas', 'Kaftans', 'Pashminas', 'Shawls', 'Indo-Western'],
    },
    {
        group: 'APPAREL',
        items: ['Skirts', 'Dresses', 'Gowns', 'Co-ords', 'Jumpsuits', 'Tops', 'Shirts', 'Bottoms', 'Pants', 'Denims', 'Jackets', 'Coats', 'Blazers', 'Knitwear'],
    },
    {
        group: 'ACCESSORIES',
        items: ['Bags', 'Jewelry', 'Watches', 'Eyewear', 'Belts', 'Hats', 'Scarves', 'Wallets', 'Ties', 'Hair Accessories'],
    },
    {
        group: 'FOOTWEAR',
        items: ['Sneakers', 'Heels', 'Boots', 'Dress Shoes', 'Sandals', 'Flats', 'Traditionals', 'Juttis'],
    },
];
exports.ALL_CATEGORY_ITEMS = exports.MARKET_CATEGORIES.flatMap((c) => c.items);
exports.ACCESSORY_CATEGORY_ITEMS = [
    ...exports.MARKET_CATEGORIES.find((c) => c.group === 'ACCESSORIES')?.items || [],
    ...exports.MARKET_CATEGORIES.find((c) => c.group === 'FOOTWEAR')?.items || [],
];
function isAccessoryCategory(category, subCategory) {
    if (!category && !subCategory)
        return false;
    const terms = [
        'accessory', 'accessories', 'bag', 'bags', 'jewelry', 'jewellery',
        'watch', 'watches', 'eyewear', 'sunglasses', 'belt', 'belts', 'hat', 'hats',
        'cap', 'caps', 'headwear', 'scarf', 'scarves', 'wallet', 'wallets', 'tie', 'ties',
        'footwear', 'shoes', 'sneakers', 'heels', 'boots', 'sandals',
    ];
    const cat = (category || '').trim().toLowerCase();
    const sub = (subCategory || '').trim().toLowerCase();
    return terms.some((t) => cat.includes(t) || sub.includes(t)) ||
        exports.ACCESSORY_CATEGORY_ITEMS.some((i) => i.toLowerCase() === cat || i.toLowerCase() === sub);
}
exports.MARKET_CONDITIONS = [
    { id: 'PRISTINE', label: 'PRISTINE', desc: 'Brand new / unworn heritage piece.' },
    { id: 'MINOR_WEAR', label: 'MINOR WEAR', desc: 'Gently loved with faint signs of life.' },
    { id: 'UPCYCLE', label: 'UPCYCLE', desc: 'Reconstructed artistry from archival fabrics.' },
    { id: 'RECYCLE_ONLY', label: 'RECYCLE ONLY', desc: 'End-of-life garment for fiber recovery.' },
];
exports.LISTING_TYPES = [
    { id: 'SALE', label: 'SALE', desc: 'Direct purchase at a fixed price.' },
    { id: 'RENTAL', label: 'RENTAL', desc: 'Temporary access for a specific duration.' },
    { id: 'ACCESSORY_SWAP', label: 'SWAP', desc: 'Direct exchange for other assets.' },
];
exports.MARKET_SIZES = ['FREE SIZE', 'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
//# sourceMappingURL=market.js.map