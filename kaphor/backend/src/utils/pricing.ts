/**
 * Intelligent archival valuation estimator for garments and accessories.
 * Used for swap parity calculations, fallback trade values, and instant pricing recommendations.
 */
export function getEstimatedGarmentValue(category?: string | null, brand?: string | null): number {
  const cat = (category || '').toLowerCase();
  const b = (brand || '').toLowerCase();

  let base = 2499;

  // Category specific baselines (INR)
  if (cat.includes('watch') || cat.includes('timepiece')) {
    base = 5999;
  } else if (cat.includes('bag') || cat.includes('handbag') || cat.includes('clutch') || cat.includes('tote')) {
    base = 4999;
  } else if (cat.includes('shoe') || cat.includes('sneaker') || cat.includes('heel') || cat.includes('boot')) {
    base = 3999;
  } else if (cat.includes('jewel') || cat.includes('necklace') || cat.includes('earring') || cat.includes('ring') || cat.includes('bracelet')) {
    base = 3499;
  } else if (cat.includes('eyewear') || cat.includes('sunglass') || cat.includes('glasses')) {
    base = 2999;
  } else if (cat.includes('belt') || cat.includes('wallet') || cat.includes('cardholder')) {
    base = 1999;
  } else if (cat.includes('scarf') || cat.includes('hat') || cat.includes('tie')) {
    base = 1499;
  } else if (cat.includes('dress') || cat.includes('gown') || cat.includes('lehenga') || cat.includes('saree') || cat.includes('sherwani')) {
    base = 6999;
  } else if (cat.includes('jacket') || cat.includes('coat') || cat.includes('blazer')) {
    base = 4499;
  }

  // Tier 1 Luxury multiplier
  const ultraLuxury = [
    'gucci', 'prada', 'chanel', 'louis vuitton', 'dior', 'rolex',
    'hermes', 'balenciaga', 'fendi', 'saint laurent', 'versace',
    'burberry', 'cartier', 'omega'
  ];
  // Premium designer multiplier
  const premium = [
    'coach', 'michael kors', 'tory burch', 'kate spade', 'sabyasachi',
    'manish malhotra', 'tarun tahiliani', 'ralph lauren', 'hugo boss', 'armani'
  ];

  if (ultraLuxury.some((l) => b.includes(l))) {
    base = Math.round(base * 2.8);
  } else if (premium.some((p) => b.includes(p))) {
    base = Math.round(base * 1.6);
  }

  return Math.round(base);
}
