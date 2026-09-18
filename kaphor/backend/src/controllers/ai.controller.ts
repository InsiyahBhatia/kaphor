import { Request, Response } from 'express';
import db from '../lib/prisma';
import { redisGet, redisSet, redisDel } from '../lib/redis';
import { logger } from '../lib/logger';
import { runFashionAgent } from '../services/fashionAgent.service';
import { generateWithGroq } from '../services/groq.service';
import { generateWithGemini } from '../services/gemini.service';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Helper: Gemini text generation with multi-key + multi-model rotation */
async function generateWithFallback(prompt: string, config: any = { responseMimeType: 'application/json' }) {
    return generateWithGemini(prompt, {
        temperature: config.temperature,
        maxOutputTokens: config.maxOutputTokens,
        responseMimeType: config.responseMimeType,
    });
}

/** Helper: Gemini Vision with multi-key + multi-model rotation */
async function generateVisionWithFallback(parts: any[], config: any = { responseMimeType: 'application/json', temperature: 0.2 }) {
    return generateWithGemini(parts, {
        temperature: config.temperature,
        maxOutputTokens: config.maxOutputTokens,
        responseMimeType: config.responseMimeType,
    });
}


/** Dot-product cosine similarity between two equal-length float arrays */
function cosineSimilarity(a: number[], b: number[]): number {
    if (!a.length || a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
}

export const AESTHETIC_VECTORS: Record<string, number[]> = {
    MINIMALIST:   [0.1, 0.1, 0.1, 0.9, 0.9, 0.1, 0.1, 0.1, 0.1, 0.1, 0.9, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.9, 0.8],
    STREETWEAR:   [0.9, 0.8, 0.1, 0.1, 0.2, 0.9, 0.1, 0.1, 0.7, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.8, 0.1, 0.2, 0.1],
    VINTAGE:      [0.2, 0.1, 0.9, 0.1, 0.1, 0.1, 0.1, 0.8, 0.1, 0.9, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.9, 0.1, 0.1],
    CULTURAL:     [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.9, 0.1, 0.1, 0.1, 0.1, 0.9, 0.8, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.2],
    BOLD:         [0.8, 0.9, 0.1, 0.1, 0.1, 0.5, 0.1, 0.1, 0.2, 0.1, 0.1, 0.1, 0.1, 0.9, 0.9, 0.1, 0.3, 0.1, 0.1, 0.1],
    LUXURY:       [0.1, 0.1, 0.1, 0.5, 0.5, 0.1, 0.1, 0.1, 0.1, 0.1, 0.5, 0.1, 0.1, 0.1, 0.1, 0.9, 0.1, 0.1, 0.7, 0.9],
    DARK:         [0.7, 0.3, 0.2, 0.6, 0.1, 0.4, 0.1, 0.1, 0.1, 0.1, 0.7, 0.1, 0.1, 0.1, 0.3, 0.2, 0.9, 0.1, 0.4, 0.1],
    BOHO:         [0.1, 0.1, 0.6, 0.1, 0.1, 0.1, 0.5, 0.5, 0.1, 0.4, 0.1, 0.1, 0.9, 0.1, 0.1, 0.1, 0.1, 0.6, 0.1, 0.1],
    ARTISANAL:    [0.1, 0.1, 0.8, 0.3, 0.1, 0.1, 0.9, 0.6, 0.1, 0.7, 0.1, 0.8, 0.3, 0.1, 0.1, 0.3, 0.1, 0.7, 0.1, 0.1],
    PREPPY:       [0.1, 0.2, 0.3, 0.7, 0.4, 0.1, 0.1, 0.1, 0.4, 0.2, 0.5, 0.1, 0.1, 0.1, 0.1, 0.5, 0.1, 0.1, 0.6, 0.5],
};

export const AESTHETIC_SUMMARIES: Record<string, string> = {
    MINIMALIST:  "Your archive is built on restraint and precision. You believe in 'less but better'—investing in architectural silhouettes, high-quality neutral basics, and impeccably made essentials that endure beyond trend cycles. Your wardrobe is a master equation: every piece is intentional, every combination effortlessly calibrated. The quality of a single well-made shirt matters more to you than a closet full of novelty.",
    STREETWEAR:  "Your style is a living document of urban culture. Rooted in subculture, movement, and community, you gravitate toward oversized silhouettes, bold graphics, and limited-edition archival pieces that tell the story of city life. Technical fabrics, functional hardware, and loud branding are your language—you dress like you belong to the future.",
    VINTAGE:     "You are an archivist of fashion history. Every piece you own is a curated find—a story told through aged silk, perfectly faded denim, and silhouettes that outlived their era. You favor the soul of 'one-of-a-kind' over the algorithm of new arrivals, and you know the thrill of finding a forgotten gem that nobody else has.",
    CULTURAL:    "Your wardrobe is a love letter to heritage and craft. You are drawn to the rich materiality of handloom weaves, embroidery traditions, and artisanal techniques passed down across generations. Vibrant patterns, natural textiles, and flowing silhouettes carry stories that fast fashion can never replicate. You dress with cultural pride and depth.",
    BOLD:        "You dress like you have something to say. Experimental cuts, clashing textures, unexpected proportions, and colors that stop traffic—your style is an act of radical self-expression. You are not afraid of volume or tension in an outfit. Convention bores you. You are drawn to the avant-garde edge of fashion where art and clothing merge.",
    LUXURY:      "Your standard is impeccable. You seek out garments where the quality of the craft is its own statement—cashmere that drapes like water, leather that softens with time, tailoring that holds its form for decades. You invest in pieces that appreciate in rarity and resonance. Your look is a quiet authority; you have nothing to prove.",
    DARK:        "Your palette is nocturnal and your silhouettes are deliberate. You are drawn to the dramatic—dark fabrics, architectural edges, heavy textures like matte leather and structured wool. Your style is a mood: introspective, considered, and powerfully understated. You dress with intention, not for attention.",
    BOHO:        "You move through the world in beautiful, flowing layers. Your style is deeply intuitive—mixing textures, prints, and global finds in a way that feels effortlessly composed. You are drawn to earthy tones, natural fibers, artisan jewelry, and pieces that feel as alive as the outdoors. Freedom of expression is your north star.",
    ARTISANAL:   "You are a connoisseur of making. Your wardrobe is built around handcrafted pieces—hand-block prints, hand-stitched embroidery, natural indigo dyes, and ethically made garments where the maker's identity is as important as the material. You support slow fashion at its most genuine expression.",
    PREPPY:      "Your style is rooted in a refined academic tradition. Clean silhouettes, structured outerwear, classic patterns like plaid and herringbone, and a palette that signals understated confidence. You appreciate the discipline of a well-executed classic look—polished, reliable, and subtly prestigious.",
};

const AESTHETIC_COMPAT_MAP: Record<string, keyof typeof AESTHETIC_VECTORS> = {
    'Y2K': 'STREETWEAR',
    'OFFICE SIREN': 'LUXURY',
    'ROCKSTAR GIRLFRIEND': 'BOLD',
    'SADE GIRL': 'LUXURY',
    'VINTAGE': 'VINTAGE',
    'ACUBI': 'MINIMALIST',
    'BUSINESS COMFORT': 'LUXURY',
    'COTTAGECORE': 'BOHO',
    'DARK ACADEMIA': 'DARK',
    'DARK COQUETTE': 'DARK',
    'FLEUR NOIRE': 'DARK',
    'GRUNGE': 'STREETWEAR',
    'MERMAID CORE': 'BOLD',
    'MINIMAL DESI': 'CULTURAL',
    'MAXIMAL DESI': 'BOLD',
    'SOFT GIRL': 'BOHO',
};

function toPersistedStyleAesthetic(aesthetic: string): 'MINIMALIST' | 'VINTAGE' | 'BOLD' | 'ETHNIC' | 'STREETWEAR' | 'LUXURY' {
    const key = (aesthetic || '').toUpperCase().trim();
    const mapped = AESTHETIC_COMPAT_MAP[key] || key;
    if (mapped === 'CULTURAL' || mapped === 'ARTISANAL' || mapped === 'BOHO') return 'ETHNIC';
    if (mapped === 'DARK' || mapped === 'PREPPY') return 'LUXURY';
    if (mapped === 'MINIMALIST' || mapped === 'VINTAGE' || mapped === 'BOLD' || mapped === 'STREETWEAR' || mapped === 'LUXURY') {
        return mapped;
    }
    return 'LUXURY';
}

function getAestheticDetails(aesthetic: string) {
    const rawKey = (aesthetic || '').toUpperCase().trim();
    const vectorKey = AESTHETIC_COMPAT_MAP[rawKey] || rawKey;
    const metadata: Record<string, any> = {
        'Y2K': {
            recommendedBrands: ["Blumarine", "Diesel", "Von Dutch", "Juicy Couture", "Coperni"],
            topCategories: ["Low-rise Jeans", "Baby Tees", "Cargo Pants", "Velour Tracksuits", "Platform Sneakers"],
            dnaTags: ["Y2K", "NOSTALGIA", "FUTURISTIC", "PLAYFUL"],
            colorPalette: ["#FF69B4", "#00FFFF", "#C0C0C0", "#FF1493"],
            aestheticVibe: "The 2000s Visionary",
            tagline: "Futuristic pop maximalism inspired by the late 90s & early 2000s"
        },
        'OFFICE SIREN': {
            recommendedBrands: ["Prada", "Saint Laurent", "The Row", "Miu Miu", "Alexander McQueen"],
            topCategories: ["Fitted Blazers", "Pencil Skirts", "Tailored Trousers", "Pointed Heels"],
            dnaTags: ["OFFICE SIREN", "TAILORED", "SULTRY", "CONFIDENT"],
            colorPalette: ["#1A1A1A", "#FFFFFF", "#8B0000", "#708090"],
            aestheticVibe: "The Powerhouse",
            tagline: "Sleek, confident tailoring with bold and sultry details"
        },
        'ROCKSTAR GIRLFRIEND': {
            recommendedBrands: ["Saint Laurent", "Zadig & Voltaire", "R13", "The Kooples", "Balenciaga"],
            topCategories: ["Leather Jackets", "Moto Vests", "Ripped Denim", "Knee-High Boots"],
            dnaTags: ["ROCKSTAR", "EDGY", "GLAMOUR", "RAW"],
            colorPalette: ["#0D0D0D", "#8B0000", "#4A0E17", "#D4AF37"],
            aestheticVibe: "The Rock Muse",
            tagline: "Bold, edgy glamour inspired by rock-and-roll culture"
        },
        'SADE GIRL': {
            recommendedBrands: ["Khaite", "Toteme", "Lemaire", "Alaïa", "Bottega Veneta"],
            topCategories: ["Biker Coats", "Sleek Basics", "Relaxed Trousers", "Chunky Belts"],
            dnaTags: ["SADE GIRL", "SULTRY", "MINIMAL", "MOODY"],
            colorPalette: ["#1A1A1A", "#8B4513", "#D2B48C", "#4A3B32"],
            aestheticVibe: "The Minimalist Icon",
            tagline: "Moody, understated streetwear meets sultry minimalism"
        },
        'DARK ACADEMIA': {
            recommendedBrands: ["Ralph Lauren", "Burberry", "Margaret Howell", "Brooks Brothers", "Dries Van Noten"],
            topCategories: ["Tweed Blazers", "Plaid Skirts", "Wool Sweaters", "Oxford Shoes"],
            dnaTags: ["SCHOLARLY", "TWEED", "INTELLECTUAL", "GOTHIC"],
            colorPalette: ["#3D2314", "#2B3A28", "#1C1C1C", "#8B6508"],
            aestheticVibe: "The Scholar",
            tagline: "Moody, scholarly tailoring inspired by classical literature & tweed"
        },
        'DARK COQUETTE': {
            recommendedBrands: ["Simone Rocha", "Vivienne Westwood", "Shushu/Tong", "Miu Miu", "Alexander McQueen"],
            topCategories: ["Lace Dresses", "Corset Tops", "Fitted Skirts", "Heeled Boots"],
            dnaTags: ["DARK COQUETTE", "ROMANTIC", "CORSETRY", "MYSTERIOUS"],
            colorPalette: ["#1A1A1A", "#5B0E2D", "#3B1828", "#E6D7D2"],
            aestheticVibe: "The Dark Romantic",
            tagline: "Sultry, romantic elegance with a mysterious, edgy mood"
        },
        'FLEUR NOIRE': {
            recommendedBrands: ["Ann Demeulemeester", "Erdem", "Rodarte", "Yohji Yamamoto", "Alexander McQueen"],
            topCategories: ["Moody Floral Gowns", "Puff-Sleeve Blouses", "Flowing Skirts", "Chokers"],
            dnaTags: ["FLEUR NOIRE", "DRAMATIC", "DARK FLORAL", "GOTHIC CHIC"],
            colorPalette: ["#121212", "#4A154B", "#6B2D5C", "#2D3748"],
            aestheticVibe: "The Midnight Bloom",
            tagline: "Dark romantic gothic elegance with moody dramatic florals"
        },
        'GRUNGE': {
            recommendedBrands: ["R13", "Maison Margiela", "Acne Studios", "Undercover", "Rick Owens"],
            topCategories: ["Flannel Shirts", "Oversized Sweaters", "Distressed Denim", "Combat Boots"],
            dnaTags: ["GRUNGE", "REBELLIOUS", "OVERSIZED", "DISTRESSED"],
            colorPalette: ["#242424", "#4A3B32", "#6B1D2F", "#556B2F"],
            aestheticVibe: "The Alt Rebel",
            tagline: "Rebellious 90s alternative rock culture with distressed finishes"
        },
        'MERMAID CORE': {
            recommendedBrands: ["Coperni", "Area", "Blumarine", "Paco Rabanne", "Cult Gaia"],
            topCategories: ["Iridescent Tops", "Flowing Layered Skirts", "Fluid Dresses", "Pearl Jewelry"],
            dnaTags: ["MERMAID CORE", "IRIDESCENT", "OCEANIC", "WHIMSICAL"],
            colorPalette: ["#20B2AA", "#7FFFD4", "#E6E6FA", "#008B8B"],
            aestheticVibe: "The Siren of the Sea",
            tagline: "Whimsical, iridescent sea-inspired fluid drapery and sheen"
        },
        'MINIMAL DESI': {
            recommendedBrands: ["Raw Mango", "Payal Khandwala", "Torani", "Anavila", "Eka"],
            topCategories: ["Straight-cut Kurtas", "Structured Sarees", "Linen Palazzos", "Fine Mojaris"],
            dnaTags: ["MINIMAL DESI", "REFINED HERITAGE", "HANDLOOM", "CONTEMPORARY"],
            colorPalette: ["#F5F5DC", "#D2B48C", "#708090", "#C8AD7F"],
            aestheticVibe: "The Modern Heritage Purist",
            tagline: "Refined, understated Indian silhouettes with modern clean lines"
        },
        'MAXIMAL DESI': {
            recommendedBrands: ["Sabyasachi", "Tarun Tahiliani", "Manish Malhotra", "Anita Dongre", "Abu Jani Sandeep Khosla"],
            topCategories: ["Embroidered Lehengas", "Zari Anarkalis", "Brocade Kurtas", "Polki Chokers"],
            dnaTags: ["MAXIMAL DESI", "OPULENT", "ROYAL", "EMBELLISHED"],
            colorPalette: ["#800020", "#0047AB", "#50C878", "#FFD700"],
            aestheticVibe: "The Royal Couturier",
            tagline: "Opulent celebration of Indian craftsmanship, brocades & royal colors"
        },
        'SOFT GIRL': {
            recommendedBrands: ["Miu Miu", "Sandy Liang", "Cecilie Bahnsen", "For Love & Lemons", "Brandy Melville"],
            topCategories: ["Cropped Cardigans", "Fuzzy Sweaters", "Plaid Skirts", "Mary Janes"],
            dnaTags: ["SOFT GIRL", "PASTEL", "FEMININE", "DELICATE"],
            colorPalette: ["#FFB6C1", "#E6E6FA", "#B0E0E6", "#FFF8DC"],
            aestheticVibe: "The Sweet Dreamer",
            tagline: "Sweet, pastel femininity with delicate knits and playful charm"
        },
        'ACUBI': {
            recommendedBrands: ["Thug Club", "ADER error", "Andersson Bell", "Post Archive Faction", "Oakley"],
            topCategories: ["Baggy Jeans", "Baby Tees", "Layered Belts", "Chunky Sneakers"],
            dnaTags: ["ACUBI", "SUBVERSIVE", "CYBER-MINIMAL", "KOREAN STREETWEAR"],
            colorPalette: ["#333333", "#5C5449", "#8B8682", "#2B2B2B"],
            aestheticVibe: "The Cyber Minimalist",
            tagline: "Subversive Korean streetwear, muted earth tones & cyber-minimalism"
        },
        'BUSINESS COMFORT': {
            recommendedBrands: ["Loro Piana", "Brunello Cucinelli", "Theory", "Vince", "Eileen Fisher"],
            topCategories: ["Relaxed Blazers", "Elastic-waist Trousers", "Knit Tops", "Smart Loafers"],
            dnaTags: ["BUSINESS COMFORT", "WORKLEISURE", "EFFORTLESS", "PREMIUM"],
            colorPalette: ["#4A5568", "#718096", "#E2E8F0", "#A0AEC0"],
            aestheticVibe: "The Relaxed Executive",
            tagline: "Modern workleisure balancing corporate structure with ease"
        },
        'COTTAGECORE': {
            recommendedBrands: ["Dôen", "Christy Dawn", "Batsheva", "Horror Vacui", "Sezane"],
            topCategories: ["Floral Midi Dresses", "Puff-sleeve Blouses", "Tiered Skirts", "Ballet Flats"],
            dnaTags: ["COTTAGECORE", "PASTORAL", "ROMANTIC", "ORGANIC"],
            colorPalette: ["#8FBC8F", "#F5DEB3", "#FFDAB9", "#D8BFD8"],
            aestheticVibe: "The Meadow Muse",
            tagline: "Romantic, nature-inspired pastoral charm and soft femininity"
        },
        'VINTAGE': {
            recommendedBrands: ["Levi's Big E", "Vintage Dior", "Missoni", "European Deadstock"],
            topCategories: ["Heritage Denim", "Silk Scarves", "Leather Bombers", "Deadstock Tees"],
            dnaTags: ["SOULFUL", "HISTORIC", "CURATED", "UNIQUE"],
            colorPalette: ["#8B7355", "#C4A882", "#6B4C3B", "#D4C4A0"],
            aestheticVibe: "The Collector",
            tagline: "Timeless archive elegance inspired by historic decades"
        },
        'MINIMALIST': {
            recommendedBrands: ["The Row", "Jil Sander", "Lemaire", "Auralee", "COS Archive"],
            topCategories: ["Structured Blazers", "Fine Knitwear", "Wide-leg Trousers", "Tonal Coats"],
            dnaTags: ["ARCHITECTURAL", "MONOCHROME", "TIMELESS", "PRECISE"],
            colorPalette: ["#1A1A1A", "#FFFFFF", "#E8E8E4", "#C8C4BB"],
            aestheticVibe: "The Editor",
            tagline: "Restraint and precision with high-quality neutral architectural basics"
        },
        'LUXURY': {
            recommendedBrands: ["Hermès", "Brunello Cucinelli", "Loro Piana", "Chanel Vintage"],
            topCategories: ["Cashmere Overcoats", "Structured Bags", "Silk Blouses", "Tailored Trousers"],
            dnaTags: ["IMPECCABLE", "INVESTMENT", "POLISHED", "ELEVATED"],
            colorPalette: ["#1A1A1A", "#F5F0E8", "#8B7E6A", "#D4AF37"],
            aestheticVibe: "The Connoisseur",
            tagline: "Impeccable craft and quiet authority that holds form for decades"
        }
    };

    const matchedKey = Object.keys(metadata).find(k => k === rawKey) || 'LUXURY';
    const extra = metadata[matchedKey] || metadata.LUXURY;

    return {
        styleVector: AESTHETIC_VECTORS[vectorKey] || AESTHETIC_VECTORS.LUXURY,
        styleAesthetic: matchedKey,
        selectedAesthetic: matchedKey,
        summary: extra.tagline || extra.aestheticVibe || 'Curated luxury archetype',
        ...extra,
    };
}

/** Sophisticated scoring logic — maps all quiz signals to deep aesthetic scores */
function generateHeuristicProfile(answers: string[]) {
    const text = answers.join(' ').toUpperCase();

    const scores: Record<string, number> = {
        MINIMALIST: 0, STREETWEAR: 0, VINTAGE: 0, CULTURAL: 0, BOLD: 0,
        LUXURY: 0, DARK: 0, BOHO: 0, ARTISANAL: 0, PREPPY: 0,
    };

    answers.forEach(ans => {
        const a = ans.toUpperCase();

        // ── MINIMALIST signals
        if (a.match(/MINIMAL|NEUTRAL|CLEAN|SIMPLE|TIMELESS|SOLID|QUIET|UNIFORM|PARED.DOWN|ARCHITECTURAL|PRECISE|RESTRAINED/)) scores.MINIMALIST += 2;
        if (a.match(/LESS IS MORE|NO PRINT|TONAL|MONOCHROME|UNIFORM|JAPANESE/)) scores.MINIMALIST += 3;

        // ── STREETWEAR signals
        if (a.match(/STREETWEAR|OVERSIZED|GRAPHIC|DENIM|EDGY|RELAXED|LOOSE|URBAN|HYPE|DROP|LOGOMANIA/)) scores.STREETWEAR += 2;
        if (a.match(/SKATE|HIP.HOP|TRACK|HOODIE|SNEAKER|BOXY|UTILITY/)) scores.STREETWEAR += 3;

        // ── VINTAGE signals
        if (a.match(/VINTAGE|RETRO|HERITAGE|DEADSTOCK|FLORAL|SILK|LINEN|ARCHIVE|1970|1980|1990/)) scores.VINTAGE += 2;
        if (a.match(/THRIFT|COLLECTOR|ANTIQUE|SECOND.?HAND|CURATED|RARE FIND/)) scores.VINTAGE += 3;

        // ── CULTURAL signals
        if (a.match(/CULTURAL|TRADITIONAL|ETHNIC|HERITAGE|INDIAN|HANDLOOM|COTTON|SAREE|KURTA|BLOCK.?PRINT/)) scores.CULTURAL += 2;
        if (a.match(/KHADI|WEAVE|CRAFT|ARTISAN|EMBROIDERY|ZARDOSI|IKAT|KALAMKARI/)) scores.CULTURAL += 3;

        // ── BOLD signals
        if (a.match(/BOLD|BRIGHT|EXPERIMENTAL|STATEMENT|AVANT.?GARDE|MAX|EXTREME|CLASH|UNEXPECTED|VOLUME/)) scores.BOLD += 2;
        if (a.match(/SCULPTURAL|DEVIANT|DISRUPTIVE|SURREAL|PERFORMATIVE|EXTREME SILHOUETTE/)) scores.BOLD += 3;

        // ── LUXURY signals
        if (a.match(/LUXURY|ELEGANT|REFINED|POLISHED|TAILORED|CLASSY|INVESTMENT|PREMIUM|COUTURE|PRESTIGE/)) scores.LUXURY += 2;
        if (a.match(/CASHMERE|SILK CREPE|IMPECCABLE|HERM|LORO PIANA|BRUNELLO|QUIET LUXURY/)) scores.LUXURY += 3;

        // ── DARK signals
        if (a.match(/DARK|GOTHIC|MOODY|NOIR|BLACK|DRAMATIC|HEAVY|SHADOW|NOCTURNAL|MATTE/)) scores.DARK += 2;
        if (a.match(/ARCHITECTURAL BLACK|AUSTERE|DECONSTRUCTED|STARK|YOHJI|RICK OWENS|ANN D/)) scores.DARK += 3;

        // ── BOHO signals
        if (a.match(/BOHO|BOHEMIAN|FLOWING|EARTHY|NATURAL|FREE|LAYERED|GLOBAL|WANDERLUST|FLOWY/)) scores.BOHO += 2;
        if (a.match(/FESTIVAL|ORGANIC|MACRAME|CROCHET|FRINGE|PATCHWORK|WRAP|NOMADIC|SPIRITUAL/)) scores.BOHO += 3;

        // ── ARTISANAL signals
        if (a.match(/ARTISAN|HANDMADE|HAND.?CRAFTED|SLOW FASHION|NATURAL DYE|BLOCK PRINT|HANDWOVEN|ETHICAL/)) scores.ARTISANAL += 2;
        if (a.match(/KHADI|INDIGO|SUSTAINABLE CRAFT|MAKER|HANDLOOM|SUPPORT ARTISAN|ZERO WASTE/)) scores.ARTISANAL += 3;

        // ── PREPPY signals
        if (a.match(/PREPPY|CLASSIC|COLLEGIATE|CLEAN.?CUT|STRUCTURED|POLO|BLAZER|PLAID|HERRINGBONE/)) scores.PREPPY += 2;
        if (a.match(/NAVY|STRIPE|OXFORD|CHINO|LOAFER|HERITAGE|ACADEMIC|OLD MONEY|NAUTICAL/)) scores.PREPPY += 3;
    });

    const aesthetic = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
    return getAestheticDetails(aesthetic);
}

function safeJson(text: string): any {
    // Extract JSON object/array even if Claude wraps it in markdown
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    return JSON.parse(match ? match[1].trim() : text.trim());
}

// ── 1. Style Quiz ─────────────────────────────────────────────────────────────
export async function processStyleQuiz(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

        const { answers } = req.body;
        const quizHash = `quiz:v3:${Buffer.from(JSON.stringify(answers)).toString('base64').substring(0, 32)}`;
        const cached = await redisGet(quizHash);
        if (cached) {
            const profile = JSON.parse(cached);
            const persistedAesthetic = toPersistedStyleAesthetic(profile.selectedAesthetic || profile.styleAesthetic);
            await db.user.update({
                where: { id: req.user.id },
                data: {
                    styleVector: profile.styleVector,
                    styleAesthetic: persistedAesthetic,
                    onboardingDone: true,
                    preferenceProfile: {
                        ...profile,
                        dominantAesthetic: persistedAesthetic,
                    } as any,
                }
            });
            res.json({ data: { ...profile, message: 'Style profile updated (cached)' } });
            return;
        }

        // All 16 official aesthetic profiles
        const all16Aesthetics = [
            'Y2K', 'Office Siren', 'Rockstar Girlfriend', 'Sade Girl', 'Vintage',
            'Acubi', 'Business Comfort', 'Cottagecore', 'Dark Academia', 'Dark Coquette',
            'Fleur Noire', 'Grunge', 'Mermaid Core', 'Minimal Desi', 'Maximal Desi', 'Soft Girl'
        ];

        const directMatch = all16Aesthetics.find(a => a.toLowerCase() === (answers?.[0] || '').toLowerCase());
        const selectedAesthetic = directMatch || all16Aesthetics.find(a => a.toLowerCase() === (answers?.[1] || '').toLowerCase()) || 'Sade Girl';

        logger.info(`Processing style quiz -> selected archetype: ${selectedAesthetic}`);
        const profile = getAestheticDetails(selectedAesthetic);
        const persistedAesthetic = toPersistedStyleAesthetic(selectedAesthetic);
        profile.styleAesthetic = persistedAesthetic;
        profile.selectedAesthetic = selectedAesthetic;

        // Persist to user
        await db.user.update({
            where: { id: req.user.id },
            data: {
                styleVector: profile.styleVector,
                styleAesthetic: persistedAesthetic,
                onboardingDone: true,
                preferenceProfile: {
                    ...(profile as any),
                    selectedAesthetic,
                    dominantAesthetic: persistedAesthetic,
                } as any,
            }
        });

        // Store in cache for 24 hours
        await redisSet(quizHash, JSON.stringify(profile), 60 * 60 * 24);

        res.json({
            data: {
                ...profile,
                message: 'Style profile generated via Logic Engine'
            }
        });
    } catch (error) {
        logger.error('Style quiz failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

export async function skipStyleQuiz(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

        await db.user.update({
            where: { id: req.user.id },
            data: {
                onboardingDone: true
            }
        });

        res.json({ data: { message: 'Style quiz skipped' } });
    } catch (error) {
        logger.error('Style quiz skip failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

export async function getStyleProfile(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

        const user = await db.user.findUnique({
            where: { id: req.user.id },
            select: { styleAesthetic: true, onboardingDone: true, preferenceProfile: true }
        });

        const profile = (user?.preferenceProfile as any) || {};
        const rawAesthetic = user?.styleAesthetic || profile.dominantAesthetic;

        if (!rawAesthetic && !user?.onboardingDone && !profile.totalInteractions) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'No style profile generated yet' });
            return;
        }

        const all16Aesthetics = [
            'Y2K', 'Office Siren', 'Rockstar Girlfriend', 'Sade Girl', 'Vintage',
            'Acubi', 'Business Comfort', 'Cottagecore', 'Dark Academia', 'Dark Coquette',
            'Fleur Noire', 'Grunge', 'Mermaid Core', 'Minimal Desi', 'Maximal Desi', 'Soft Girl'
        ];
        const legacyMap: Record<string, string> = {
            'LUXURY': 'Sade Girl',
            'MINIMALIST': 'Business Comfort',
            'STREETWEAR': 'Acubi',
            'CULTURAL': 'Minimal Desi',
            'ETHNIC': 'Maximal Desi',
            'BOLD': 'Rockstar Girlfriend',
            'DARK': 'Dark Academia',
            'BOHO': 'Cottagecore',
            'PREPPY': 'Office Siren',
            'ARTISANAL': 'Vintage',
        };

        const resolvedAesthetic = all16Aesthetics.find(a => a.toLowerCase() === String(rawAesthetic || '').trim().toLowerCase())
            || legacyMap[String(rawAesthetic || '').toUpperCase().trim()]
            || 'Sade Girl';

        const details = getAestheticDetails(resolvedAesthetic);

        // Blend in user's dynamically learned top categories and brands
        if (profile.topCategories && Object.keys(profile.topCategories).length > 0) {
            const learnedCats = Object.entries(profile.topCategories)
                .sort(([, a]: any, [, b]: any) => b - a)
                .slice(0, 4)
                .map(([name]) => name);
            if (learnedCats.length > 0) details.topCategories = learnedCats;
        }
        if (profile.topBrands && Object.keys(profile.topBrands).length > 0) {
            const learnedBrands = Object.entries(profile.topBrands)
                .sort(([, a]: any, [, b]: any) => b - a)
                .slice(0, 4)
                .map(([name]) => name);
            if (learnedBrands.length > 0) details.recommendedBrands = learnedBrands;
        }

        res.status(200).json({ data: details });
    } catch (error) {
        logger.error('Fetch style profile failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

// ── 2. Recommendations ────────────────────────────────────────────────────────
export async function getRecommendations(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

        const cacheKey = `recs:${req.user.id}`;
        const cached = await redisGet(cacheKey);
        if (cached) {
            res.json({ data: JSON.parse(cached), cached: true });
            return;
        }

        const user = await db.user.findUnique({
            where: { id: req.user.id },
            select: { styleVector: true }
        });

        const garments = await db.garment.findMany({
            where: { isActive: true, lifecycleState: 'LISTED' },
            take: 200,
            select: {
                id: true, title: true, brand: true, category: true,
                condition: true, price: true, images: true,
                garmentVector: true, recyclableFiber: true,
                seller: { select: { username: true } }
            }
        });

        const userVec = user?.styleVector ?? [];

        const scored = garments
            .map((g: any) => {
                const score = userVec.length && g.garmentVector.length
                    ? cosineSimilarity(userVec, g.garmentVector)
                    : Math.random() * 0.3 + 0.6; // fallback for no vector
                return { ...g, fitScore: Math.round(score * 100) };
            })
            .sort((a: any, b: any) => b.fitScore - a.fitScore)
            .slice(0, 20);

        await redisSet(cacheKey, JSON.stringify(scored), 30 * 60);
        res.json({ data: scored, cached: false });
    } catch (error) {
        logger.error('Recommendations failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

// ── 3. Fit Score ──────────────────────────────────────────────────────────────
export async function getFitScore(req: Request, res: Response): Promise<void> {
    try {
        const { userId, garmentId } = req.params;

        const [user, garment] = await Promise.all([
            db.user.findUnique({ where: { id: userId }, select: { styleVector: true, styleAesthetic: true } }),
            db.garment.findUnique({ where: { id: garmentId }, select: { garmentVector: true, styleTags: true, material: true, color: true } })
        ]);

        if (!user || !garment) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

        const overall = cosineSimilarity(user.styleVector, garment.garmentVector);

        // Simulated sub-dimension scores derived from the overall + noise
        const base = overall * 100;
        const colorMatch = Math.min(100, Math.round(base * 0.95 + Math.random() * 8));
        const styleMatch = Math.min(100, Math.round(base * 1.05 + Math.random() * 5));
        const sizeCompat = Math.min(100, Math.round(80 + Math.random() * 20));
        const occasionFit = Math.min(100, Math.round(base * 0.90 + Math.random() * 10));
        const overallScore = Math.min(100, Math.round((colorMatch + styleMatch + sizeCompat + occasionFit) / 4));

        res.json({
            data: {
                colorMatch,
                styleMatch,
                sizeCompatibility: sizeCompat,
                occasionFit,
                overallScore,
                label: `${overallScore}% FIT`
            }
        });
    } catch (error) {
        logger.error('Fit score failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

// ── 4. Chat (AI Shopping Agent & Stylist) ──────────────────────────────────
export async function chat(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

        const { message, garmentId, conversationId, image, stream = false } = req.body;
        if (!message && !image) { res.status(400).json({ error: 'message or image required' }); return; }

        let userPromptText = (message || '').trim();
        let visualAnalysisSummary = '';

        if (image) {
            let base64Data = image;
            let mimeType = 'image/jpeg';
            if (image.startsWith('data:')) {
                const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
                if (match) {
                    mimeType = match[1];
                    base64Data = match[2];
                }
            }

            try {
                const visionAnalysis = await generateVisionWithFallback([
                    { inlineData: { mimeType, data: base64Data } },
                    { text: 'Analyze this uploaded garment/fashion item photo in detail. Identify: 1. Exact item type (e.g. Y2K graphic halter crop top, distressed denim jacket, flared midi skirt, silk saree). 2. Colors, graphics/prints, neckline, straps, hardware, and key visual features. 3. Aesthetic classification (e.g. Y2K, Streetwear, Vintage, Minimalist, Ethnic, Coquette). Be specific and concise (2-3 sentences).' }
                ], { temperature: 0.2 });
                visualAnalysisSummary = visionAnalysis;
                userPromptText = userPromptText 
                    ? `${userPromptText}\n[Uploaded Garment Photo Analysis: ${visualAnalysisSummary}]`
                    : `How do I style this item? [Uploaded Garment Photo Analysis: ${visualAnalysisSummary}]`;
            } catch (vErr) {
                logger.warn('Chat vision analysis fallback', { error: vErr });
                if (!userPromptText) userPromptText = 'How do I style this uploaded garment?';
            }
        }

        // Find or create conversation
        let conversation;
        if (conversationId) {
            conversation = await db.chatConversation.findUnique({
                where: { id: conversationId },
                include: { messages: { orderBy: { createdAt: 'asc' }, take: 20 } }
            });
        }

        if (!conversation) {
            // Reuse active stylist conversation for this user so chat history is unified
            conversation = await db.chatConversation.findFirst({
                where: { userId: req.user.id },
                orderBy: { updatedAt: 'desc' },
                include: { messages: { orderBy: { createdAt: 'asc' }, take: 20 } }
            });
        }

        if (!conversation) {
            conversation = await db.chatConversation.create({
                data: {
                    userId: req.user.id,
                    garmentId: garmentId ? String(garmentId) : null,
                    title: (message || 'KaPhor Stylist Agent').substring(0, 40)
                },
                include: { messages: true }
            });
        }

        // Save incoming user message to DB
        await db.chatMessage.create({
            data: { conversationId: conversation.id, role: 'user', content: message || '📷 Uploaded photo for styling advice' }
        });

        // Execute Autonomous Fashion Stylist Agent Pipeline
        const agentResult = await runFashionAgent({
            userId: req.user.id,
            message: userPromptText || message,
            imageUrl: image,
            visualAnalysisSummary,
        });

        // Save assistant response to DB
        await db.chatMessage.create({
            data: { conversationId: conversation.id, role: 'assistant', content: agentResult.reply }
        });

        const responsePayload = {
            reply: agentResult.reply,
            text: agentResult.reply,
            message: agentResult.reply,
            actionsExecuted: agentResult.actionsExecuted,
            cards: agentResult.cards,
            products: agentResult.cards,
            outfitLook: agentResult.outfitLook,
            suggestedFollowUps: agentResult.suggestedFollowUps,
            conversationId: conversation.id,
        };

        if (stream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders();

            res.write(`data: ${JSON.stringify(responsePayload)}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
        } else {
            res.json({
                data: responsePayload,
                ...responsePayload,
            });
        }
    } catch (error: any) {
        logger.error('Chat failed with fatal error', { error: error.message });
        if (!res.headersSent) {
            res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
        } else {
            res.write('data: [ERROR]\n\n');
            res.end();
        }
    }
}

const VALID_LISTING_CATEGORIES = [
    'Sarees', 'Lehengas', 'Anarkalis', 'Sherwanis', 'Suits', 'Kurtas', 'Dupattas', 'Kaftans', 'Pashminas', 'Shawls', 'Indo-Western',
    'Skirts', 'Dresses', 'Gowns', 'Co-ords', 'Jumpsuits', 'Tops', 'Shirts', 'Bottoms', 'Pants', 'Denims', 'Jackets', 'Coats', 'Blazers', 'Knitwear',
    'Bags', 'Jewelry', 'Watches', 'Eyewear', 'Belts', 'Hats', 'Scarves', 'Wallets', 'Ties', 'Hair Accessories',
    'Sneakers', 'Heels', 'Boots', 'Dress Shoes', 'Sandals', 'Flats', 'Traditionals', 'Juttis'
];

function resolveListingCategory(rawCategory?: string, subCategory?: string, title?: string): string {
    const genericTokens = new Set([
        'apparel', 'clothing', 'ethnic', 'ethnicwear', 'accessory', 'accessories',
        'footwear', 'shoes', 'fashion', 'garment', 'wear', 'outfit', 'item', 'piece',
        'womenswear', 'menswear', 'women', 'men', "women's apparel", "men's apparel"
    ]);

    const candidates = [rawCategory, subCategory, title]
        .filter(Boolean)
        .map(s => String(s).trim());

    for (const c of candidates) {
        const exact = VALID_LISTING_CATEGORIES.find(item => item.toLowerCase() === c.toLowerCase());
        if (exact) return exact;
    }

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

    if (/shoe|footwear/i.test(combined)) return 'Flats';
    if (/apparel|clothing/i.test(combined)) return 'Dresses';

    return 'Tops';
}

// ── 6. AI Vision: Analyze Listing Image ───────────────────────────────────
export async function analyzeListingImage(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

        const { image, listingType } = req.body;
        if (!image) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Provide an image (base64)' });
            return;
        }

        const prompt = `You are an expert luxury circular fashion archivist and valuation specialist for KaPhor.
Analyze the provided item image and extract all relevant details for a marketplace listing.

Taxonomy Guidelines:
1. "category" MUST be one of these exact values:
Sarees, Lehengas, Anarkalis, Sherwanis, Suits, Kurtas, Dupattas, Kaftans, Pashminas, Shawls, Indo-Western, Skirts, Dresses, Gowns, Co-ords, Jumpsuits, Tops, Shirts, Bottoms, Pants, Denims, Jackets, Coats, Blazers, Knitwear, Bags, Jewelry, Watches, Eyewear, Belts, Hats, Scarves, Wallets, Ties, Hair Accessories, Sneakers, Heels, Boots, Dress Shoes, Sandals, Flats, Traditionals, Juttis.

CRITICAL INSTRUCTION FOR CATEGORY:
Never output a group name like "APPAREL", "ETHNIC", "ACCESSORIES", "FOOTWEAR", or "CLOTHING" as the category.
Select the exact specific category:
- If it is a skirt -> "Skirts"
- If it is a dress -> "Dresses"
- If it is a saree -> "Sarees"
- If it is a lehenga -> "Lehengas"
- If it is an anarkali -> "Anarkalis"
- If it is a suit/salwar/pant suit -> "Suits"
- If it is a kurta/kurti -> "Kurtas"
- If it is a bag/handbag/tote -> "Bags"
- If it is sneakers -> "Sneakers"
- If it is heels -> "Heels"
- If it is boots -> "Boots"
- If it is a jacket -> "Jackets"
- If it is a blazer -> "Blazers"
- If it is denim/jeans -> "Denims"
- If it is trousers/pants -> "Pants"
- If it is a shirt -> "Shirts"
- If it is a top/t-shirt/blouse -> "Tops"

2. "condition" MUST be one of:
- "PRISTINE" (Brand new / unworn heritage piece, perfect condition)
- "MINOR_WEAR" (Gently loved with faint signs of life, high quality)
- "UPCYCLE" (Reconstructed artistry or modified archival garment)
- "RECYCLE_ONLY" (Heavily worn or damaged, fiber recovery only)

3. "size" MUST be one of:
- "FREE SIZE" (Always use "FREE SIZE" for all Accessories, Footwear, Sarees, Shawls, Dupattas, Scarves, Hats, Bags, Eyewear, Jewelry, Watches, Belts)
- Otherwise: "XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"

4. Circular Listing Guidance:
- "isAccessory": boolean (true if the item is in Bags, Jewelry, Watches, Eyewear, Belts, Hats, Scarves, Wallets, Ties, Hair Accessories, or any Footwear)
- "recommendedListingType":
  * "ACCESSORY_SWAP" if isAccessory is true
  * "RENTAL" if it is high-end bridal ethnic wear (Lehenga, Sherwani, Anarkali), luxury evening gown, or heavy designer couture
  * "SALE" for general garments, denim, tops, skirts, etc.
- "estimatedPrice": Realistic pre-loved resale valuation in INR (number, e.g. 1500).
- "suggestedRentalPriceDay": Daily rental rate in INR (typically 10-15% of estimatedPrice, minimum 199).
- "suggestedRentalPriceWeek": Weekly rental rate in INR (typically 4-5x daily rate).
${listingType === 'RENTAL' ? `IMPORTANT LISTING CONTEXT: The seller has selected "RENTAL" mode.
- Calculate suggested rental pricing: "suggestedRentalPriceDay" (peer hire daily rate in INR, 10-15% of garment retail value, min 199), and "suggestedRentalPriceWeek" (4-5x daily rate).
- Emphasize rental hire appeal, occasion suitability (weddings, galas, shoots, festivals), and styling adaptability in the "description".
- Set "recommendedListingType" to "RENTAL".` : ''}
${listingType === 'ACCESSORY_SWAP' ? `IMPORTANT LISTING CONTEXT: The seller has selected "ACCESSORY_SWAP" mode (peer-to-peer exchange).
- Swapping on KaPhor is exclusively for accessories and footwear.
- If the item is an accessory or footwear, set "size" to "FREE SIZE", and highlight craftsmanship, hardware, and exchange appeal in the "description".
- If the item is clearly apparel (e.g. shirt, dress, jacket), accurately identify its apparel category so the application can guide the user accordingly.
- Set "recommendedListingType" to "ACCESSORY_SWAP".` : ''}
${listingType === 'SALE' ? `IMPORTANT LISTING CONTEXT: The seller has selected outright resale ("SALE") mode.
- Calculate an authentic, realistic pre-loved resale "estimatedPrice" in INR based on brand, silhouette, and textile quality.
- Highlight archival value, craftsmanship, and silhouette in the "description".
- Set "recommendedListingType" to "SALE".` : ''}

Return ONLY valid JSON with this exact structure:
{
  "title": "Short descriptive title (3-5 words)",
  "brand": "Detected brand or 'Unknown Brand'",
  "category": "Exact category from above list (e.g. Skirts, Sarees, Bags, etc.)",
  "subCategory": "Specific type (e.g. Vintage Leather Tote, Embroidered Silk Lehenga, Distressed Denim)",
  "description": "Simple, clean 2-sentence description emphasizing fabric and fit",
  "size": "FREE SIZE or clothing size",
  "condition": "PRISTINE|MINOR_WEAR|UPCYCLE|RECYCLE_ONLY",
  "color": ["Main colors"],
  "material": ["Main fabrics"],
  "isAccessory": false,
  "recommendedListingType": "SALE|RENTAL|ACCESSORY_SWAP",
  "estimatedPrice": 1500,
  "suggestedRentalPriceDay": 299,
  "suggestedRentalPriceWeek": 1199,
  "styleAttributes": {
    "fabric": "Specific fabric detail",
    "style": "Aesthetic style (e.g. Minimalist, Streetwear, Ethnic, Luxury)",
    "sleeve": "Sleeve type or null",
    "shape": "Fit/Shape type",
    "pattern": "Pattern type",
    "weight": "Light/Medium/Heavy"
  }
}
Be precise. If the brand or hardware logo is visible, identify it.`;

        let base64Data = image;
        let mimeType = 'image/jpeg';
        if (image.startsWith('data:')) {
            const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
            if (match) {
                mimeType = match[1];
                base64Data = match[2];
            }
        }

        let raw = '';
        try {
            raw = await generateVisionWithFallback([
                { inlineData: { mimeType, data: base64Data } },
                { text: prompt }
            ]);
        } catch (visionErr: any) {
            logger.warn('AI Vision generation failed or timed out, using fallback attributes', { error: visionErr?.message });
        }

        let data: any;
        try {
            data = raw ? safeJson(raw) : null;
        } catch {
            data = null;
        }

        const isSwapMode = listingType === 'ACCESSORY_SWAP';
        const isRentalMode = listingType === 'RENTAL';

        if (!data || !data.title) {
            data = {
                title: isSwapMode ? 'Archival Leather Bag' : isRentalMode ? 'Curated Designer Evening Piece' : 'Curated Designer Item',
                brand: 'Unknown Brand',
                category: isSwapMode ? 'Bags' : isRentalMode ? 'Dresses' : 'Tops',
                subCategory: isSwapMode ? 'Leather Accessory' : isRentalMode ? 'Evening Wear' : 'Contemporary Top',
                description: 'Pre-loved authentic piece curated for KaPhor circular fashion and conscious style.',
                size: isSwapMode ? 'FREE SIZE' : 'M',
                condition: 'PRISTINE',
                color: ['Black'],
                material: ['Cotton'],
                isAccessory: isSwapMode,
                recommendedListingType: isSwapMode ? 'ACCESSORY_SWAP' : isRentalMode ? 'RENTAL' : 'SALE',
                estimatedPrice: isRentalMode ? 4500 : 1299,
                suggestedRentalPriceDay: isRentalMode ? 499 : 249,
                suggestedRentalPriceWeek: isRentalMode ? 1999 : 999,
                styleAttributes: {
                    fabric: 'Cotton Blend',
                    style: 'Contemporary',
                    sleeve: null,
                    shape: 'Regular Fit',
                    pattern: 'Solid',
                    weight: 'Medium'
                }
            };
        } else {
            // Normalize category to exact valid catalog category
            data.category = resolveListingCategory(data.category, data.subCategory, data.title);

            // Normalize conditions
            const validConditions = ['PRISTINE', 'MINOR_WEAR', 'UPCYCLE', 'RECYCLE_ONLY'];
            if (!validConditions.includes(data.condition)) {
                const c = String(data.condition || '').toUpperCase();
                if (c.includes('EXCELLENT') || c.includes('NEW') || c.includes('MINT')) data.condition = 'PRISTINE';
                else if (c.includes('GOOD') || c.includes('GENTLE')) data.condition = 'MINOR_WEAR';
                else if (c.includes('UPCYCLE') || c.includes('REWORK')) data.condition = 'UPCYCLE';
                else data.condition = 'MINOR_WEAR';
            }

            // Ensure numeric rates
            data.estimatedPrice = Math.round(Number(data.estimatedPrice) || 1200);
            if (!data.suggestedRentalPriceDay) {
                data.suggestedRentalPriceDay = Math.max(199, Math.round(data.estimatedPrice * 0.12));
            } else {
                data.suggestedRentalPriceDay = Math.round(Number(data.suggestedRentalPriceDay));
            }
            if (!data.suggestedRentalPriceWeek) {
                data.suggestedRentalPriceWeek = Math.round(data.suggestedRentalPriceDay * 4.5);
            } else {
                data.suggestedRentalPriceWeek = Math.round(Number(data.suggestedRentalPriceWeek));
            }
        }
        res.json({ data });
    } catch (error) {
        logger.error('Analyze listing failed', { error });
        res.json({
            data: {
                title: 'Curated Garment',
                brand: 'Unknown',
                category: 'Tops',
                subCategory: 'Tops',
                description: 'Ready to list on KaPhor.',
                size: 'M',
                condition: 'PRISTINE',
                color: [],
                material: [],
                isAccessory: false,
                recommendedListingType: 'SALE',
                estimatedPrice: 999,
                suggestedRentalPriceDay: 199,
                suggestedRentalPriceWeek: 799,
                styleAttributes: {
                    fabric: '',
                    style: '',
                    sleeve: null,
                    shape: '',
                    pattern: '',
                    weight: ''
                }
            }
        });
    }
}

// ── 7. AI Vision: Condition Assessment + Upcycle ─────────────────────────────
export async function assessCondition(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

        const { image, description, garmentId } = req.body;
        if (!image && !description) {
            res.status(400).json({ error: 'BAD_REQUEST', message: 'Provide an image (base64) and/or a description' });
            return;
        }

        // Optionally enrich with garment data from DB
        let garmentContext = '';
        if (garmentId) {
            const garment = await db.garment.findUnique({
                where: { id: garmentId },
                select: { title: true, brand: true, material: true, color: true, category: true, condition: true }
            });
            if (garment) {
                garmentContext = `\nKnown garment details:\n- Name: ${garment.title}\n- Brand: ${garment.brand}\n- Material: ${(garment.material as string[]).join(', ')}\n- Color: ${(garment.color as string[]).join(', ')}\n- Category: ${garment.category}\n- Listed condition: ${garment.condition}`;
            }
        }

        const prompt = `You are KaPhor AI, a luxury sustainable fashion condition expert.
Analyze the provided garment image and description, then return ONLY valid JSON with this exact structure:
{
  "condition": {
    "grade": "EXCELLENT|GOOD|FAIR|POOR|WORN",
    "score": /* integer 0-100 */,
    "fiberHealth": "EXCELLENT|GOOD|FAIR|DEGRADED",
    "wearAnalysis": "2-3 sentence description of visible wear, stains, damage, or pristine condition",
    "colorFading": "NONE|MINIMAL|MODERATE|SIGNIFICANT",
    "structuralIntegrity": "INTACT|MINOR_ISSUES|NEEDS_REPAIR"
  },
  "circularRecommendation": {
    "action": "RESELL|RENT|UPCYCLE|RECYCLE|DONATE",
    "reasoning": "1-2 sentence explanation of why this action is best",
    "estimatedValue": "HIGH|MEDIUM|LOW",
    "sustainabilityScore": /* integer 0-100, how eco-friendly this path is */
  },
  "upcycleSuggestions": [
    {
      "title": "Creative name for the idea",
      "description": "2-3 sentence description of the transformation",
      "difficulty": "Easy|Intermediate|Advanced",
      "materialsNeeded": ["material1", "material2"],
      "estimatedTime": "e.g. 2-3 hours",
      "sustainabilityImpact": "1 sentence on environmental benefit"
    }
    /* exactly 3 suggestions */
  ]
}
${garmentContext}
${description ? `User description: ${description}` : ''}
Analyze the garment carefully. Be specific about visible defects or quality indicators.`;

        // Build multimodal parts
        const parts: any[] = [];

        if (image) {
            // image is expected as a base64 data URI or raw base64
            let base64Data = image;
            let mimeType = 'image/jpeg';

            if (image.startsWith('data:')) {
                // Extract mime type and base64 from data URI
                const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
                if (match) {
                    mimeType = match[1];
                    base64Data = match[2];
                }
            }

            parts.push({
                inlineData: { mimeType, data: base64Data }
            });
        }

        parts.push({ text: prompt });

        const rawResult = await generateWithGemini(parts, { responseMimeType: 'application/json' });
        const assessment = safeJson(rawResult);

        res.json({ data: assessment });
    } catch (error) {
        logger.error('Condition assessment failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

// ── 6. Upcycle Suggestions (text-only legacy) ────────────────────────────────
export async function getUpcycleSuggestions(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

        const { garmentId, condition, targetCategory } = req.body;
        if (!garmentId) { res.status(400).json({ error: 'garmentId required' }); return; }

        const garment = await db.garment.findUnique({
            where: { id: garmentId },
            select: { title: true, brand: true, material: true, color: true, category: true, condition: true }
        });

        if (!garment) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

        const prompt = `You are a sustainable fashion upcycling expert for KaPhor.
Given this garment, return ONLY valid JSON (no markdown) with exactly 3 upcycle transformation ideas.
Each idea must have: { "title": string, "description": string, "difficulty": "Easy|Intermediate|Advanced", "materialsNeeded": string[], "estimatedTime": string, "sustainabilityImpact": string }

Garment details:
- Name: ${garment.title}
- Brand: ${garment.brand}
- Material: ${garment.material.join(', ')}
- Color: ${garment.color.join(', ')}
- Category: ${garment.category}
- Condition: ${condition || garment.condition}
- Target category: ${targetCategory || 'any'}

Return: { "suggestions": [ ...3 ideas... ] }`;

        let raw: string;
        try {
            raw = await generateWithGroq(prompt, { responseFormat: 'json' });
        } catch (groqErr) {
            logger.warn('Groq upcycle suggestions failed, falling back to Gemini', { error: (groqErr as Error).message });
            raw = await generateWithFallback(prompt);
        }
        const resJson = safeJson(raw);

        res.json({ data: resJson.suggestions });
    } catch (error) {
        logger.error('Upcycle suggestions failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}

// ── 6. Chat History ───────────────────────────────────────────────────────────
export async function getChatHistory(req: Request, res: Response): Promise<void> {
    try {
        if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }

        const { conversationId } = req.params;
        if (conversationId) {
            const messages = await db.chatMessage.findMany({
                where: { conversationId },
                orderBy: { createdAt: 'asc' }
            });
            res.json({ data: messages });
        } else {
            const convs = await db.chatConversation.findMany({
                where: { userId: req.user.id },
                include: { garment: { select: { title: true, images: true } } },
                orderBy: { updatedAt: 'desc' }
            });
            res.json({ data: convs });
        }
    } catch (error) {
        logger.error('getChatHistory failed', { error });
        res.status(500).json({ error: 'INTERNAL_ERROR' });
    }
}
