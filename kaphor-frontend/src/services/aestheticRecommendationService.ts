// ══════════════════════════════════════════════════════════════════════════════
// KAPHOR — AESTHETIC-MATCH RECOMMENDATION SYSTEM ENGINE
// Implementation of the official 16-profile algorithm & scoring pipeline
// ══════════════════════════════════════════════════════════════════════════════

export type AestheticId =
  | 'Y2K'
  | 'Office Siren'
  | 'Rockstar Girlfriend'
  | 'Sade Girl'
  | 'Vintage'
  | 'Acubi'
  | 'Business Comfort'
  | 'Cottagecore'
  | 'Dark Academia'
  | 'Dark Coquette'
  | 'Fleur Noire'
  | 'Grunge'
  | 'Mermaid Core'
  | 'Minimal Desi'
  | 'Maximal Desi'
  | 'Soft Girl';

export interface AestheticProfile {
  id: AestheticId;
  name: string;
  tagline: string;
  description: string;
  essentials: string[];
}

export const AESTHETIC_PROFILES: Record<AestheticId, AestheticProfile> = {
  'Y2K': {
    id: 'Y2K',
    name: 'Y2K',
    tagline: 'Futuristic pop maximalism inspired by the late 90s & early 2000s',
    description: 'Fashion inspired by the late 1990s and early 2000s, combining futuristic technology, pop culture, and playful maximalism.',
    essentials: [
      'Low-rise jeans and mini skirts',
      'Baby tees and crop tops',
      'Baggy cargo pants',
      'Velour tracksuits',
      'Platform sneakers and chunky shoes',
      'Butterfly clips and colorful accessories',
      'Tinted sunglasses',
    ],
  },
  'Office Siren': {
    id: 'Office Siren',
    name: 'Office Siren',
    tagline: 'Sleek, confident tailoring with bold and sultry details',
    description: 'A sleek, confident aesthetic that combines professional clothing with bold and sultry details.',
    essentials: [
      'Fitted blazers, pencil skirts, and tailored trousers',
      'Button-down blouses, silk tops, or corset-inspired shirts',
      'Pointed-toe heels, stilettos, or sleek ankle boots',
      'Structured handbags and minimalist jewellery',
      'Black, white, grey, and deep red color palettes',
    ],
  },
  'Rockstar Girlfriend': {
    id: 'Rockstar Girlfriend',
    name: 'Rockstar Girlfriend',
    tagline: 'Bold, edgy glamour inspired by rock-and-roll culture',
    description: 'A bold, edgy style influenced by glamor and rock-and-roll culture.',
    essentials: [
      'Leather jackets, moto vests, and oversized band tees',
      'Mini skirts, ripped jeans, and fishnet tights',
      'Knee-high boots and chunky platforms',
      'Chokers, chains, and oversized sunglasses',
      'Smokey makeup and tousled hair',
    ],
  },
  'Sade Girl': {
    id: 'Sade Girl',
    name: 'Sade Girl',
    tagline: 'Moody, understated streetwear meets sultry minimalism',
    description: 'A moody and edgy aesthetic combining streetwear with sultry minimalism.',
    essentials: [
      'Leather jackets and oversized biker coats',
      'Crop tops, fitted tanks, and sleek basics',
      'Low-rise jeans, cargos, and relaxed trousers',
      'Chunky belts, chokers, sunglasses, and hoop earrings',
      'Bold makeup and sleek or messy hairstyles',
    ],
  },
  'Vintage': {
    id: 'Vintage',
    name: 'Vintage',
    tagline: 'Timeless archive elegance inspired by historic decades',
    description: 'A timeless aesthetic inspired by fashion and accessories from previous decades.',
    essentials: [
      'Tea dresses, midi skirts, and ruffled gowns',
      'High-waisted trousers and skirts',
      'Pearls, brooches, hats, and lace gloves',
      'Structured handbags and retro clutches',
      'Mary Janes, kitten heels, and saddle shoes',
    ],
  },
  'Acubi': {
    id: 'Acubi',
    name: 'Acubi',
    tagline: 'Subversive Korean streetwear, muted earth tones & cyber-minimalism',
    description: 'A Korean streetwear-inspired aesthetic combining oversized silhouettes with fitted basics, generally using neutral or muted tones.',
    essentials: [
      'Oversized baggy jeans and wide-leg pants',
      'Fitted crop tops and baby tees',
      'Layered belts and visible waistbands',
      'Chunky sneakers and platform shoes',
      'Chains, arm warmers, and glasses',
    ],
  },
  'Business Comfort': {
    id: 'Business Comfort',
    name: 'Business Comfort',
    tagline: 'Modern workleisure balancing corporate structure with ease',
    description: 'Modern workwear that balances professional structure with relaxed and wearable clothing.',
    essentials: [
      'Relaxed-fit blazers and unstructured jackets',
      'Tailored trousers with stretch or elastic waistbands',
      'Knit tops',
      'Smart loafers and block heels',
      'Leather totes and simple watches',
    ],
  },
  'Cottagecore': {
    id: 'Cottagecore',
    name: 'Cottagecore',
    tagline: 'Romantic, nature-inspired pastoral charm and soft femininity',
    description: 'A romantic, nature-inspired aesthetic celebrating rural living, soft femininity, and vintage charm.',
    essentials: [
      'Floral or gingham midi and maxi dresses',
      'Puff-sleeve blouses and lace-trim tops',
      'Aprons, pinafores, and layered skirts',
      'Headscarves and ribboned hair accessories',
      'Mary Janes, ballet flats, and simple leather boots',
    ],
  },
  'Dark Academia': {
    id: 'Dark Academia',
    name: 'Dark Academia',
    tagline: 'Moody, scholarly tailoring inspired by classical literature & tweed',
    description: 'A moody and intellectual aesthetic inspired by classic literature, gothic architecture, and scholarly life.',
    essentials: [
      'Tweed blazers, plaid skirts, and tailored trousers',
      'Wool sweaters, cardigans, and layered outfits',
      'Oxford shoes, loafers, and leather boots',
      'Leather satchels, vintage watches, and glasses',
    ],
  },
  'Dark Coquette': {
    id: 'Dark Coquette',
    name: 'Dark Coquette',
    tagline: 'Sultry, romantic elegance with a mysterious, edgy mood',
    description: 'A sultry and feminine aesthetic combining romantic elegance with a mysterious, edgy mood.',
    essentials: [
      'Lace-trim dresses, corset tops, and fitted skirts',
      'Black, deep red, and plum colors',
      'Ribbons, chokers, and delicate jewellery',
      'Heeled boots, Mary Janes, and elegant pumps',
      'Romantic hairstyles with waves, curls, or accessories',
    ],
  },
  'Fleur Noire': {
    id: 'Fleur Noire',
    name: 'Fleur Noire',
    tagline: 'Dark romantic gothic elegance with moody dramatic florals',
    description: 'A dark romantic aesthetic that combines gothic elegance with feminine elements.',
    essentials: [
      'Black or deep-colored dresses with lace details',
      'Flowing skirts, puff sleeves, and ruffled blouses',
      'Chokers, veils, and ornate jewellery',
      'Boots, heels, and vintage-inspired footwear',
      'Moody makeup with romantic details',
    ],
  },
  'Grunge': {
    id: 'Grunge',
    name: 'Grunge',
    tagline: 'Rebellious 90s alternative rock culture with distressed finishes',
    description: 'A rebellious fashion aesthetic influenced by 1990s alternative rock culture.',
    essentials: [
      'Flannel shirts, oversized sweaters, and band tees',
      'Ripped jeans, distressed denim, and cargo pants',
      'Combat boots, platform boots, and worn sneakers',
      'Leather jackets and oversized coats',
      'Dark makeup and messy hairstyles',
    ],
  },
  'Mermaid Core': {
    id: 'Mermaid Core',
    name: 'Mermaid Core',
    tagline: 'Whimsical, iridescent sea-inspired fluid drapery and sheen',
    description: 'A whimsical and ocean-inspired aesthetic based on the beauty and mystery of the sea.',
    essentials: [
      'Shimmery and iridescent tops, dresses, and skirts',
      'Flowing layered skirts and wave-inspired silhouettes',
      'Seashell, pearl, floral, and starfish-inspired jewellery',
      'Teal, turquoise, lavender, and seafoam colors',
      'Glitter makeup and wavy hairstyles',
    ],
  },
  'Minimal Desi': {
    id: 'Minimal Desi',
    name: 'Minimal Desi',
    tagline: 'Refined, understated Indian silhouettes with modern clean lines',
    description: 'A refined and understated aesthetic that reimagines traditional Indian clothing through a modern, minimal approach.',
    essentials: [
      'Straight-cut kurtas and simple co-ord sets',
      'Structured sarees with plain blouses',
      'Palazzos, straight pants, and dhoti pants',
      'Ivory, beige, sage, dusty rose, and charcoal',
      'Thin chains, small jhumkas, and delicate bangles',
      'Mojaris, block heels, and simple juttis',
    ],
  },
  'Maximal Desi': {
    id: 'Maximal Desi',
    name: 'Maximal Desi',
    tagline: 'Opulent celebration of Indian craftsmanship, brocades & royal colors',
    description: 'A rich and opulent aesthetic celebrating Indian craftsmanship, bold colors, embellishments, and statement styling.',
    essentials: [
      'Embroidered lehengas, anarkalis, and sharara sets',
      'Zari, gota-patti, sequins, and mirror work',
      'Silk, velvet, brocade, and Banarasi fabrics',
      'Jhumkas, chokers, and maang tikka',
      'Royal blue, magenta, emerald, gold, and deep red',
      'Embellished juttis and statement footwear',
    ],
  },
  'Soft Girl': {
    id: 'Soft Girl',
    name: 'Soft Girl',
    tagline: 'Sweet, pastel femininity with delicate knits and playful charm',
    description: 'A sweet and feminine aesthetic built around pastel colors, delicate details, and youthful softness.',
    essentials: [
      'Cropped cardigans, fuzzy sweaters, and ribbed tops',
      'Plaid mini skirts and high-waisted mom jeans',
      'Mary Janes, platform sneakers, and knee-high socks',
      'Baby pink, lavender, pale blue, and cream',
      'Hair clips, bows, scrunchies, and dainty jewellery',
      'Dewy, blush-focused makeup',
    ],
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// ATTRIBUTE TO AESTHETIC MAPPINGS
// ══════════════════════════════════════════════════════════════════════════════

export const COLOUR_MAPPING: Record<string, AestheticId[]> = {
  'neutrals': ['Office Siren', 'Rockstar Girlfriend', 'Sade Girl', 'Acubi', 'Business Comfort', 'Dark Academia', 'Dark Coquette', 'Fleur Noire', 'Grunge', 'Minimal Desi'],
  'earthy': ['Sade Girl', 'Vintage', 'Dark Academia', 'Cottagecore', 'Minimal Desi'],
  'pastels': ['Y2K', 'Vintage', 'Cottagecore', 'Mermaid Core', 'Minimal Desi', 'Soft Girl'],
  'jewel': ['Office Siren', 'Sade Girl', 'Vintage', 'Dark Coquette', 'Mermaid Core', 'Maximal Desi'],
  'bold': ['Y2K', 'Rockstar Girlfriend', 'Mermaid Core', 'Maximal Desi'],
  'monochrome': ['Office Siren', 'Acubi', 'Dark Academia', 'Minimal Desi'],
  'metallics': ['Y2K', 'Rockstar Girlfriend', 'Maximal Desi'],
};

export const SHADE_MAPPING: Record<string, AestheticId[]> = {
  'light': ['Soft Girl', 'Cottagecore', 'Mermaid Core', 'Minimal Desi'],
  'medium': ['Vintage', 'Business Comfort', 'Acubi'],
  'dark': ['Dark Academia', 'Dark Coquette', 'Fleur Noire', 'Grunge', 'Rockstar Girlfriend', 'Sade Girl'],
  'mix': ['Y2K', 'Maximal Desi', 'Office Siren'],
  'depends': ['Office Siren', 'Business Comfort', 'Minimal Desi', 'Vintage'],
};

export const SILHOUETTE_MAPPING: Record<string, AestheticId[]> = {
  'fitted': ['Y2K', 'Office Siren', 'Rockstar Girlfriend', 'Sade Girl', 'Dark Coquette', 'Mermaid Core', 'Soft Girl'],
  'a_line': ['Vintage', 'Cottagecore', 'Dark Coquette', 'Minimal Desi', 'Maximal Desi'],
  'straight_cut': ['Y2K', 'Acubi', 'Business Comfort', 'Dark Academia', 'Grunge', 'Minimal Desi'],
  'wrap': ['Vintage', 'Mermaid Core', 'Cottagecore'],
  'structured': ['Office Siren', 'Vintage', 'Business Comfort', 'Dark Academia', 'Fleur Noire', 'Minimal Desi', 'Maximal Desi'],
  'flowy': ['Vintage', 'Cottagecore', 'Fleur Noire', 'Mermaid Core', 'Maximal Desi'],
  'relaxed': ['Y2K', 'Rockstar Girlfriend', 'Acubi', 'Business Comfort', 'Grunge', 'Soft Girl'],
};

export const FIT_MAPPING: Record<string, AestheticId[]> = {
  'body_con': ['Office Siren', 'Dark Coquette', 'Y2K', 'Rockstar Girlfriend'],
  'fitted_comfortable': ['Office Siren', 'Vintage', 'Business Comfort', 'Minimal Desi', 'Dark Academia', 'Soft Girl'],
  'regular': ['Business Comfort', 'Minimal Desi', 'Vintage', 'Cottagecore'],
  'relaxed': ['Acubi', 'Grunge', 'Sade Girl', 'Business Comfort', 'Cottagecore'],
  'oversized': ['Grunge', 'Acubi', 'Y2K', 'Dark Academia', 'Rockstar Girlfriend'],
  'depends': ['Office Siren', 'Maximal Desi', 'Business Comfort', 'Minimal Desi'],
};

export const FABRIC_MAPPING: Record<string, AestheticId[]> = {
  'cotton': ['Cottagecore', 'Minimal Desi', 'Business Comfort', 'Soft Girl', 'Acubi'],
  'linen': ['Minimal Desi', 'Cottagecore', 'Business Comfort', 'Vintage'],
  'denim': ['Grunge', 'Y2K', 'Rockstar Girlfriend', 'Acubi', 'Sade Girl'],
  'silk': ['Office Siren', 'Vintage', 'Dark Coquette', 'Mermaid Core', 'Minimal Desi', 'Maximal Desi', 'Fleur Noire'],
  'wool': ['Dark Academia', 'Business Comfort', 'Vintage'],
  'knits': ['Soft Girl', 'Dark Academia', 'Business Comfort', 'Acubi'],
  'rayon': ['Vintage', 'Cottagecore', 'Minimal Desi'],
  'leather': ['Rockstar Girlfriend', 'Sade Girl', 'Grunge', 'Office Siren', 'Dark Academia'],
  'polyester': ['Y2K', 'Office Siren', 'Mermaid Core'],
  'no_preference': ['Minimal Desi', 'Business Comfort', 'Vintage'],
};

export const PRINT_MAPPING: Record<string, AestheticId[]> = {
  'solids': ['Office Siren', 'Acubi', 'Minimal Desi', 'Sade Girl', 'Business Comfort'],
  'florals': ['Cottagecore', 'Vintage', 'Dark Coquette', 'Fleur Noire', 'Soft Girl', 'Maximal Desi'],
  'stripes': ['Office Siren', 'Dark Academia', 'Business Comfort', 'Soft Girl'],
  'checks': ['Dark Academia', 'Grunge', 'Soft Girl', 'Vintage'],
  'polka_dots': ['Vintage', 'Soft Girl', 'Dark Coquette'],
  'animal': ['Rockstar Girlfriend', 'Y2K', 'Office Siren'],
  'abstract': ['Y2K', 'Mermaid Core', 'Maximal Desi'],
  'ethnic': ['Minimal Desi', 'Maximal Desi'],
  'typography': ['Grunge', 'Y2K', 'Acubi', 'Rockstar Girlfriend'],
  'not_prints': ['Office Siren', 'Acubi', 'Minimal Desi', 'Sade Girl'],
};

// ══════════════════════════════════════════════════════════════════════════════
// SCORING ENGINE
// ══════════════════════════════════════════════════════════════════════════════

export interface AestheticAnswers {
  q1_colours: string[];
  q2_shades: string;
  q3_silhouettes: string[];
  q4_body_shape?: string; // Stored separately, excluded from aesthetic scoring
  q5_fitting: string;
  q6_fabrics: string[];
  q7_prints: string[];
  q8_vibe_ranked: AestheticId[]; // Ranked picks: [rank1, rank2, rank3]
}

export interface AestheticMatchResult {
  primary: {
    aesthetic: AestheticProfile;
    score: number;
    matchPercent: number;
  };
  closeSecond?: {
    aesthetic: AestheticProfile;
    score: number;
    matchPercent: number;
  };
  allRanked: {
    aesthetic: AestheticProfile;
    score: number;
    matchPercent: number;
  }[];
  userStyleVector: Record<string, any>;
}

export function calculateAestheticMatch(answers: AestheticAnswers): AestheticMatchResult {
  const allAesthetics = Object.keys(AESTHETIC_PROFILES) as AestheticId[];
  const scores: Record<AestheticId, number> = {} as any;

  // Helper to compute subscore
  const computeSubscore = (selectedKeys: string[], mapping: Record<string, AestheticId[]>, aesthetic: AestheticId): number => {
    if (!selectedKeys || selectedKeys.length === 0) return 0;
    let matchedCount = 0;
    for (const key of selectedKeys) {
      const tagged = mapping[key.toLowerCase()] || [];
      if (tagged.includes(aesthetic)) {
        matchedCount++;
      }
    }
    return matchedCount / selectedKeys.length;
  };

  for (const a of allAesthetics) {
    // 1. Vibe Score (40% weight)
    let vibeScore = 0;
    const rankedIndex = answers.q8_vibe_ranked?.indexOf(a);
    if (rankedIndex === 0) vibeScore = 1.0;
    else if (rankedIndex === 1) vibeScore = 0.6;
    else if (rankedIndex === 2) vibeScore = 0.3;

    // 2. Silhouette Score (15% weight)
    const silhouetteScore = computeSubscore(answers.q3_silhouettes, SILHOUETTE_MAPPING, a);

    // 3. Colour Score (12% weight)
    const colourScore = computeSubscore(answers.q1_colours, COLOUR_MAPPING, a);

    // 4. Fit Score (10% weight)
    const fitScore = computeSubscore(answers.q5_fitting ? [answers.q5_fitting] : [], FIT_MAPPING, a);

    // 5. Shade Score (8% weight)
    const shadeScore = computeSubscore(answers.q2_shades ? [answers.q2_shades] : [], SHADE_MAPPING, a);

    // 6. Fabric Score (8% weight)
    const fabricScore = computeSubscore(answers.q6_fabrics, FABRIC_MAPPING, a);

    // 7. Print Score (7% weight)
    const printScore = computeSubscore(answers.q7_prints, PRINT_MAPPING, a);

    // Final Formula:
    // MatchScore(A) = 0.40 * Vibe + 0.15 * Silhouette + 0.12 * Colour + 0.10 * Fit + 0.08 * Shade + 0.08 * Fabric + 0.07 * Print
    // If user chose IDK / no vibe ranked, normalize remaining 60% weights to 100%
    const validVibes = (answers.q8_vibe_ranked || []).filter((x) => (x as string) !== 'IDK');
    const hasVibes = validVibes.length > 0;

    const rawTotal =
      (hasVibes ? 0.40 * vibeScore : 0) +
      0.15 * silhouetteScore +
      0.12 * colourScore +
      0.10 * fitScore +
      0.08 * shadeScore +
      0.08 * fabricScore +
      0.07 * printScore;

    const total = hasVibes ? rawTotal : rawTotal / 0.60;

    scores[a] = total;
  }

  // Rank in descending order
  const ranked = allAesthetics
    .map((id) => ({
      aesthetic: AESTHETIC_PROFILES[id],
      score: scores[id],
      matchPercent: Math.min(99, Math.max(50, Math.round(scores[id] * 100))),
    }))
    .sort((a, b) => b.score - a.score);

  const primary = ranked[0];
  const runnerUp = ranked[1];

  let closeSecond: typeof runnerUp | undefined = undefined;
  if (runnerUp && primary.score - runnerUp.score < 0.05) {
    closeSecond = runnerUp;
  }

  // Construct structured User Style Vector
  const userStyleVector = {
    dominantAesthetic: primary.aesthetic.name,
    primaryScore: primary.score,
    closeSecond: closeSecond ? closeSecond.aesthetic.name : null,
    bodyShape: answers.q4_body_shape || null,
    styles: ranked.slice(0, 5).reduce((acc, r) => {
      acc[r.aesthetic.id] = Number(r.score.toFixed(3));
      return acc;
    }, {} as Record<string, number>),
    colours: answers.q1_colours,
    shades: answers.q2_shades,
    silhouettes: answers.q3_silhouettes,
    fitting: answers.q5_fitting,
    fabrics: answers.q6_fabrics,
    prints: answers.q7_prints,
  };

  return {
    primary,
    closeSecond,
    allRanked: ranked,
    userStyleVector,
  };
}
