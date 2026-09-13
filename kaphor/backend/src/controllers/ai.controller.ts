import { Request, Response } from 'express';
import db from '../lib/prisma';
import { redisGet, redisSet, redisDel } from '../lib/redis';
import { logger } from '../lib/logger';
import axios from 'axios';
import sharp from 'sharp';
import { removeBackgroundWithPhotoroom } from '../services/photoroom.service';
import { uploadToS3 } from '../lib/s3';
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

function getAestheticDetails(aesthetic: string) {
    const allAesthetics = Object.keys(AESTHETIC_VECTORS);
    const safeAesthetic = allAesthetics.includes(aesthetic) ? aesthetic : 'LUXURY';

    const metadata: Record<string, any> = {
        MINIMALIST: {
            recommendedBrands: ["The Row", "Jil Sander", "Lemaire", "Auralee", "COS Archive"],
            topCategories: ["Structured Blazers", "Fine Knitwear", "Wide-leg Trousers", "Tonal Coats"],
            dnaTags: ["ARCHITECTURAL", "MONOCHROME", "TIMELESS", "PRECISE"],
            colorPalette: ["#1A1A1A", "#FFFFFF", "#E8E8E4", "#C8C4BB"],
            aestheticVibe: "The Editor"
        },
        STREETWEAR: {
            recommendedBrands: ["Off-White", "Stone Island", "Stüssy", "Fear of God", "Palace"],
            topCategories: ["Graphic Tees", "Technical Outerwear", "Vintage Denim", "Statement Sneakers"],
            dnaTags: ["URBAN", "GRAPHIC", "CULTURAL", "FUNCTIONAL"],
            colorPalette: ["#000000", "#FFFFFF", "#FF0000", "#4A4AFF"],
            aestheticVibe: "The Archivist"
        },
        VINTAGE: {
            recommendedBrands: ["Levi's Big E", "Vintage Dior", "Missoni", "European Deadstock"],
            topCategories: ["Heritage Denim", "Silk Scarves", "Leather Bombers", "Deadstock Tees"],
            dnaTags: ["SOULFUL", "HISTORIC", "CURATED", "UNIQUE"],
            colorPalette: ["#8B7355", "#C4A882", "#6B4C3B", "#D4C4A0"],
            aestheticVibe: "The Collector"
        },
        CULTURAL: {
            recommendedBrands: ["FabIndia", "Raw Mango", "Sabyasachi Archive", "Handloom House"],
            topCategories: ["Hand-printed Sarees", "Linen Kurtas", "Block-print Tops", "Artisan Dupattas"],
            dnaTags: ["HERITAGE", "VIBRANT", "HANDCRAFTED", "EARTHY"],
            colorPalette: ["#8B2500", "#D4891A", "#2D6A4F", "#E9C46A"],
            aestheticVibe: "The Heritage Keeper"
        },
        BOLD: {
            recommendedBrands: ["Comme des Garçons", "Rick Owens", "Maison Margiela", "JW Anderson"],
            topCategories: ["Sculptural Coats", "Experimental Knits", "Statement Boots", "Avant-garde Dresses"],
            dnaTags: ["AVANT-GARDE", "EXPRESSIVE", "DISRUPTIVE", "FEARLESS"],
            colorPalette: ["#FF0000", "#000000", "#FFFF00", "#7B2D8B"],
            aestheticVibe: "The Disruptor"
        },
        LUXURY: {
            recommendedBrands: ["Hermès", "Brunello Cucinelli", "Loro Piana", "Chanel Vintage"],
            topCategories: ["Cashmere Overcoats", "Structured Bags", "Silk Blouses", "Tailored Trousers"],
            dnaTags: ["IMPECCABLE", "INVESTMENT", "POLISHED", "ELEVATED"],
            colorPalette: ["#1A1A1A", "#F5F0E8", "#8B7E6A", "#D4AF37"],
            aestheticVibe: "The Connoisseur"
        },
        DARK: {
            recommendedBrands: ["Rick Owens", "Ann Demeulemeester", "Yohji Yamamoto", "Julius"],
            topCategories: ["Leather Jackets", "Draped Coats", "Heavy Knitwear", "Wide-leg Black Trousers"],
            dnaTags: ["NOCTURNAL", "DRAMATIC", "ARCHITECTURAL", "DELIBERATE"],
            colorPalette: ["#0A0A0A", "#1C1C1C", "#2C2C2C", "#4A4040"],
            aestheticVibe: "The Architect of Darkness"
        },
        BOHO: {
            recommendedBrands: ["Isabel Marant", "Free People Archive", "Antik Batik", "Tigmi Trading"],
            topCategories: ["Flowing Midi Dresses", "Embroidered Blouses", "Linen Trousers", "Artisan Jewelry"],
            dnaTags: ["FREE-SPIRITED", "LAYERED", "ORGANIC", "INTUITIVE"],
            colorPalette: ["#C8956C", "#D4A76A", "#6B8F71", "#E8D5B7"],
            aestheticVibe: "The Free Spirit"
        },
        ARTISANAL: {
            recommendedBrands: ["Studio by Bhumi", "Arjuna Natural", "The Loom Art", "Usha Silks"],
            topCategories: ["Hand-block Prints", "Natural Indigo Textiles", "Handloom Sarees", "Craft Accessories"],
            dnaTags: ["SLOW FASHION", "HANDMADE", "ETHICAL", "MEANINGFUL"],
            colorPalette: ["#5C4033", "#7A9E7E", "#C9B99A", "#4A6741"],
            aestheticVibe: "The Craft Guardian"
        },
        PREPPY: {
            recommendedBrands: ["Ralph Lauren Vintage", "Brooks Brothers Archive", "Lacoste", "Barbour"],
            topCategories: ["Blazers & Tailoring", "Oxford Shirts", "Chinos & Trousers", "Heritage Outerwear"],
            dnaTags: ["CLASSIC", "STRUCTURED", "COLLEGIATE", "RELIABLE"],
            colorPalette: ["#1B3A6B", "#C8102E", "#F5F0EB", "#2E5902"],
            aestheticVibe: "The Classic"
        },
    };

    const extra = metadata[safeAesthetic] || metadata.LUXURY;
    return {
        styleVector: AESTHETIC_VECTORS[safeAesthetic],
        styleAesthetic: safeAesthetic,
        summary: AESTHETIC_SUMMARIES[safeAesthetic],
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
            await db.user.update({
                where: { id: req.user.id },
                data: {
                    styleVector: profile.styleVector,
                    styleAesthetic: profile.styleAesthetic,
                    onboardingDone: true
                }
            });
            res.json({ data: { ...profile, message: 'Style profile updated (cached)' } });
            return;
        }

        // Logic-based generation (Determinstic)
        logger.info('Processing style quiz via Logic Engine');
        const profile = generateHeuristicProfile(answers);

        // Validate aesthetic
        const validAesthetics = ['MINIMALIST', 'VINTAGE', 'BOLD', 'ETHNIC', 'STREETWEAR', 'LUXURY'];
        if (!validAesthetics.includes(profile.styleAesthetic)) {
            profile.styleAesthetic = 'LUXURY';
        }

        // Persist to user
        await db.user.update({
            where: { id: req.user.id },
            data: {
                styleVector: profile.styleVector,
                styleAesthetic: profile.styleAesthetic as any,
                onboardingDone: true
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
        const aesthetic = user?.styleAesthetic || profile.dominantAesthetic || (user?.onboardingDone ? 'LUXURY' : null);

        if (!aesthetic && !user?.onboardingDone && !profile.totalInteractions) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'No style profile generated yet' });
            return;
        }

        const details = getAestheticDetails(aesthetic || 'LUXURY');

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
                    { text: 'Analyze this fashion item image. Identify: 1. Category (e.g. Saree, Bag, Denim, Blazer) 2. Main color & pattern 3. Style aesthetic 4. Materials. Provide a concise 2-sentence summary.' }
                ], { temperature: 0.2 });
                visualAnalysisSummary = visionAnalysis;
                userPromptText = userPromptText 
                    ? `${userPromptText}\n[User uploaded image analysis: ${visualAnalysisSummary}]`
                    : `Please recommend matching pieces for this item: ${visualAnalysisSummary}`;
            } catch (vErr) {
                logger.warn('Chat vision analysis fallback', { error: vErr });
                if (!userPromptText) userPromptText = 'Can you find matching pieces for this uploaded outfit?';
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
            conversation = await db.chatConversation.create({
                data: {
                    userId: req.user.id,
                    garmentId: garmentId ? String(garmentId) : null,
                    title: (message || 'Stylist Agent').substring(0, 40)
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
1. "category" MUST be matched to one of these exact values:
- ETHNIC: Sarees, Lehengas, Anarkalis, Sherwanis, Suits, Kurtas, Dupattas, Kaftans, Pashminas, Shawls, Indo-Western
- APPAREL: Skirts, Dresses, Gowns, Co-ords, Jumpsuits, Tops, Shirts, Bottoms, Pants, Denims, Jackets, Coats, Blazers, Knitwear
- ACCESSORIES: Bags, Jewelry, Watches, Eyewear, Belts, Hats, Scarves, Wallets, Ties, Hair Accessories
- FOOTWEAR: Sneakers, Heels, Boots, Dress Shoes, Sandals, Flats, Traditionals, Juttis

2. "condition" MUST be one of:
- "PRISTINE" (Brand new / unworn heritage piece, perfect condition)
- "MINOR_WEAR" (Gently loved with faint signs of life, high quality)
- "UPCYCLE" (Reconstructed artistry or modified archival garment)
- "RECYCLE_ONLY" (Heavily worn or damaged, fiber recovery only)

3. "size" MUST be one of:
- "FREE SIZE" (Always use "FREE SIZE" for all Accessories, Footwear, Sarees, Shawls, Dupattas, Scarves, Hats, Bags, Eyewear, Jewelry, Watches, Belts)
- Otherwise: "XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"

4. Circular Listing Guidance:
- "isAccessory": boolean (true if the item is in ACCESSORIES or FOOTWEAR, false for APPAREL or ETHNIC)
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
- If the item is an accessory or footwear, classify "category" to ACCESSORIES or FOOTWEAR, set "size" to "FREE SIZE", and highlight craftsmanship, hardware, and exchange appeal in the "description".
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
  "category": "Exact category from above list",
  "subCategory": "Specific type (e.g. Vintage Leather Tote, Embroidered Silk Lehenga, Distressed Denim)",
  "description": "Professional 2-3 sentence description emphasizing craftsmanship, fabric, and styling",
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

// ── 8. Google Wardrobe AI: Multi-Item Outfit Extractor & Studio Cutout ────────
export async function extractOutfitItems(req: Request, res: Response): Promise<void> {
    try {
        const { image } = req.body;
        if (!image) {
            res.status(400).json({ error: 'IMAGE_REQUIRED', message: 'Please provide an outfit image (base64 or URL).' });
            return;
        }

        let buffer: Buffer;
        let base64Data = image;

        if (image.startsWith('data:')) {
            const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
            if (match) {
                base64Data = match[2];
                buffer = Buffer.from(base64Data, 'base64');
            } else {
                buffer = Buffer.from(image.split(',')[1], 'base64');
            }
        } else if (image.startsWith('http://') || image.startsWith('https://')) {
            const imgRes = await axios.get(image, { responseType: 'arraybuffer' });
            buffer = Buffer.from(imgRes.data);
            base64Data = buffer.toString('base64');
        } else {
            buffer = Buffer.from(image, 'base64');
        }

        // Read image dimensions for pixel translation
        const meta = await sharp(buffer).metadata();
        const width = meta.width || 1000;
        const height = meta.height || 1000;

        const prompt = `You are an elite luxury AI fashion archivist, personal stylist, and computer vision garment detector.
Analyze this outfit photo (which may be a full-body shot, mirror selfie, street style ensemble, or flat lay).
Detect every distinct wearable garment, footwear item, and fashion accessory present in the outfit (e.g. Jacket, Coat, Blazer, Shirt, Knit Top, T-Shirt, Trousers, Jeans, Skirt, Dress, Handbag, Backpack, Shoes, Boots, Sneakers, Hat, Scarf, Belt).

Return a strict JSON object with an "items" array:
{
  "items": [
    {
      "title": "Short descriptive title (3-5 words, e.g. 'Oversized Camel Wool Trench Coat')",
      "category": "Tops" | "Outerwear" | "Bottoms" | "Dresses" | "Accessories" | "Footwear" | "Bags",
      "subCategory": "Specific garment type",
      "brand": "Likely brand, designer label, or aesthetic lineage (e.g. Totême, Zara, Vintage)",
      "color": ["Primary color", "Secondary color"],
      "material": ["Primary fabric (e.g. Wool, Silk, Denim, Cotton, Leather)"],
      "condition": "PRISTINE" | "MINOR_WEAR",
      "size": "Estimated size (XS/S/M/L/XL or FREE SIZE)",
      "estimatedPrice": 2500,
      "suggestedRentalPriceDay": 299,
      "suggestedRentalPriceWeek": 1199,
      "box_2d": [ymin, xmin, ymax, xmax]
    }
  ]
}
Note: "box_2d" must be an array of 4 integers normalized between 0 and 1000 [ymin, xmin, ymax, xmax] precisely bounding this individual piece in the image.`;

        let rawVisionText = '';
        try {
            rawVisionText = await generateVisionWithFallback([
                { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
                { text: prompt }
            ], { responseMimeType: 'application/json', temperature: 0.1 });
        } catch (err: any) {
            logger.warn('Gemini outfit extraction vision call failed, falling back', { error: err?.message });
        }

        let parsed: any = null;
        try {
            parsed = rawVisionText ? safeJson(rawVisionText) : null;
        } catch {
            parsed = null;
        }

        const detectedItems: any[] = Array.isArray(parsed?.items) && parsed.items.length > 0
            ? parsed.items
            : [
                {
                    title: 'Curated Outfit Garment',
                    category: 'Tops',
                    subCategory: 'Contemporary Piece',
                    brand: 'Unknown Brand',
                    color: ['Neutral'],
                    material: ['Cotton Blend'],
                    condition: 'PRISTINE',
                    size: 'M',
                    estimatedPrice: 1999,
                    suggestedRentalPriceDay: 249,
                    suggestedRentalPriceWeek: 999,
                    box_2d: [100, 100, 900, 900]
                }
            ];

        // Crop each detected garment and run through Photoroom
        const extractedGarments = [];

        for (let i = 0; i < detectedItems.length; i++) {
            const item = detectedItems[i];
            let croppedBuffer = buffer;

            if (Array.isArray(item.box_2d) && item.box_2d.length === 4) {
                const [ymin, xmin, ymax, xmax] = item.box_2d;
                // Add 3% safety margin padding
                const padY = (ymax - ymin) * 0.03;
                const padX = (xmax - xmin) * 0.03;

                const normTop = Math.max(0, ymin - padY);
                const normLeft = Math.max(0, xmin - padX);
                const normBottom = Math.min(1000, ymax + padY);
                const normRight = Math.min(1000, xmax + padX);

                const top = Math.max(0, Math.floor((normTop / 1000) * height));
                const left = Math.max(0, Math.floor((normLeft / 1000) * width));
                const cropHeight = Math.min(height - top, Math.ceil(((normBottom - normTop) / 1000) * height));
                const cropWidth = Math.min(width - left, Math.ceil(((normRight - normLeft) / 1000) * width));

                if (cropWidth > 30 && cropHeight > 30) {
                    try {
                        croppedBuffer = await sharp(buffer)
                            .extract({ left, top, width: cropWidth, height: cropHeight })
                            .jpeg({ quality: 95 })
                            .toBuffer();
                    } catch (cropErr: any) {
                        logger.warn(`Failed to crop item ${i} (${item.title}): ${cropErr.message}`);
                        croppedBuffer = buffer;
                    }
                }
            }

            // Studio cutout via Photoroom
            const cutout = await removeBackgroundWithPhotoroom(croppedBuffer, {
                backgroundColor: '#FFFFFF',
                padding: 0.06,
                outputFormat: 'png',
            });

            // Upload studio cutout to S3
            let imageUrl = '';
            try {
                const uploadResult = await uploadToS3(cutout.buffer, 'wardrobe-extracts', cutout.mimeType);
                imageUrl = uploadResult.url;
            } catch (uploadErr: any) {
                logger.warn(`Failed to upload cutout to S3: ${uploadErr.message}`);
                imageUrl = `data:${cutout.mimeType};base64,${cutout.buffer.toString('base64')}`;
            }

            extractedGarments.push({
                id: `extract_${Date.now()}_${i}`,
                title: item.title || 'Curated Garment',
                brand: item.brand || 'Contemporary',
                category: item.category || 'Tops',
                subCategory: item.subCategory || item.category || 'Garment',
                description: item.description || `Pre-loved ${item.title || 'garment'} digitized into your luxury wardrobe.`,
                size: item.size || 'M',
                condition: item.condition || 'PRISTINE',
                color: Array.isArray(item.color) ? item.color : [item.color || 'Neutral'],
                material: Array.isArray(item.material) ? item.material : [item.material || 'Cotton'],
                estimatedPrice: Math.round(Number(item.estimatedPrice) || 1500),
                suggestedRentalPriceDay: Math.round(Number(item.suggestedRentalPriceDay) || 199),
                suggestedRentalPriceWeek: Math.round(Number(item.suggestedRentalPriceWeek) || 799),
                imageUrl,
                isCutout: cutout.isCutout,
            });
        }

        res.json({
            success: true,
            count: extractedGarments.length,
            data: extractedGarments,
        });
    } catch (error: any) {
        logger.error('extractOutfitItems failed', { error: error.message });
        res.status(500).json({ error: 'EXTRACTION_FAILED', message: error.message });
    }
}
