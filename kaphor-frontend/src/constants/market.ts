export const MARKET_CATEGORIES = [
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

export function matchMarketCategory(rawCategory?: string, subCategory?: string, title?: string): string {
  const genericTokens = new Set([
    'apparel', 'clothing', 'ethnic', 'ethnicwear', 'accessory', 'accessories',
    'footwear', 'shoes', 'fashion', 'garment', 'wear', 'outfit', 'item', 'piece',
    'womenswear', 'menswear', 'women', 'men', "women's apparel", "men's apparel"
  ]);

  const candidates = [rawCategory, subCategory, title]
    .filter(Boolean)
    .map((s) => String(s).trim());

  // 1. Direct exact match in candidates
  for (const c of candidates) {
    const exact = ALL_CATEGORY_ITEMS.find((item) => item.toLowerCase() === c.toLowerCase());
    if (exact) return exact;
  }

  // 2. Filter out pure generic category words
  const searchTexts: string[] = [];
  for (const c of candidates) {
    if (!genericTokens.has(c.toLowerCase())) {
      searchTexts.push(c);
    }
  }
  if (searchTexts.length === 0) searchTexts.push(...candidates);
  const combined = searchTexts.join(' ').toLowerCase();

  // Ethnic
  if (/saree|sari|kanjeevaram|banarasi/i.test(combined)) return 'Sarees';
  if (/lehenga|choli|ghagra/i.test(combined)) return 'Lehengas';
  if (/anarkali|kalidar/i.test(combined)) return 'Anarkalis';
  if (/sherwani|achkan|bandhgala/i.test(combined)) return 'Sherwanis';
  if (/kurta|kurti|kurtis|pathani/i.test(combined)) return 'Kurtas';
  if (/salwar|churidar|patiala|\bsuit\b|pant\s*suit/i.test(combined)) return 'Suits';
  if (/dupatta|chunni|odhni/i.test(combined)) return 'Dupattas';
  if (/kaftan|caftan/i.test(combined)) return 'Kaftans';
  if (/pashmina/i.test(combined)) return 'Pashminas';
  if (/shawl|stole/i.test(combined)) return 'Shawls';
  if (/indo-western|indowestern|fusion/i.test(combined)) return 'Indo-Western';

  // Footwear
  if (/sneaker|trainer|running\s*shoe|converse|jordans/i.test(combined)) return 'Sneakers';
  if (/heel|stiletto|pump|wedge/i.test(combined)) return 'Heels';
  if (/boot|chelsea|combat/i.test(combined)) return 'Boots';
  if (/sandal|slide|gladiator|flip\s*flop/i.test(combined)) return 'Sandals';
  if (/jutti|mojari|nagra|kolhapuri/i.test(combined)) return 'Juttis';
  if (/oxford|derby|brogue|monk\s*strap/i.test(combined)) return 'Dress Shoes';
  if (/flat|loafer|mule|ballerina|ballet\s*flat|espadrille/i.test(combined)) return 'Flats';

  // Accessories
  if (/bag|handbag|tote|purse|clutch|crossbody|shoulder\s*bag|backpack|satchel|hobo|duffel/i.test(combined)) return 'Bags';
  if (/wallet|cardholder|card\s*holder|coin\s*purse/i.test(combined)) return 'Wallets';
  if (/jewelry|jewellery|necklace|choker|earring|jhumka|bracelet|bangle|\bring\b|pendant|brooch|anklet/i.test(combined)) return 'Jewelry';
  if (/watch|timepiece|chronograph/i.test(combined)) return 'Watches';
  if (/eyewear|sunglass|sunglasses|glasses|shades|frames|spectacles/i.test(combined)) return 'Eyewear';
  if (/belt/i.test(combined)) return 'Belts';
  if (/hat|cap|beanie|beret|fedora|bucket\s*hat/i.test(combined)) return 'Hats';
  if (/scarf|scarves|muffler|bandana/i.test(combined)) return 'Scarves';
  if (/tie|bowtie|necktie|cravat/i.test(combined)) return 'Ties';
  if (/hair|scrunchie|headband|hair\s*clip|hairpin/i.test(combined)) return 'Hair Accessories';

  // Apparel
  if (/skirt/i.test(combined)) return 'Skirts';
  if (/gown|ballgown|evening\s*gown/i.test(combined)) return 'Gowns';
  if (/dress|frock|sundress|bodycon|(?:maxi|midi|mini)\s*dress/i.test(combined)) return 'Dresses';
  if (/co-ord|coord|matching\s*set|two\s*piece/i.test(combined)) return 'Co-ords';
  if (/jumpsuit|romper|playsuit|dungaree/i.test(combined)) return 'Jumpsuits';
  if (/blazer|tuxedo|suit\s*jacket|sport\s*coat/i.test(combined)) return 'Blazers';
  if (/coat|trench|overcoat|parka|peacoat/i.test(combined)) return 'Coats';
  if (/jacket|bomber|leather\s*jacket|windbreaker|puffer/i.test(combined)) return 'Jackets';
  if (/knitwear|sweater|cardigan|pullover|jumper|turtleneck|knit/i.test(combined)) return 'Knitwear';
  if (/hoodie|sweatshirt|crop\s*top|tank|cami|tee|\btop\b|blouse|\btops\b|t-shirt|tshirt/i.test(combined)) return 'Tops';
  if (/\bshirt\b|\bshirts\b|button\s*down|flannel|button-up/i.test(combined)) return 'Shirts';
  if (/jeans|denim/i.test(combined)) return 'Denims';
  if (/pant|trouser|chino|cargo|slacks|culottes/i.test(combined)) return 'Pants';
  if (/shorts|leggings|joggers|sweatpants|bottoms/i.test(combined)) return 'Bottoms';

  // Secondary fallbacks
  if (/shoe|footwear/i.test(combined)) return 'Flats';
  if (/apparel|clothing/i.test(combined)) return 'Dresses';

  return 'Tops';
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
