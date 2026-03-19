import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const STYLE_VECTOR_LENGTH = 16;
const defaultVector = () => Array.from({ length: STYLE_VECTOR_LENGTH }, () => Math.random() * 0.4 - 0.2);

// ── Style quiz questions (10: aesthetic, fit, color, occasion)
export const STYLE_QUIZ_QUESTIONS = [
  { id: 'aesthetic_1', category: 'aesthetic', text: 'Which best describes your style?' },
  { id: 'aesthetic_2', category: 'aesthetic', text: 'Your ideal wardrobe vibe?' },
  { id: 'fit_1', category: 'fit', text: 'Preferred silhouette?' },
  { id: 'fit_2', category: 'fit', text: 'How do you like clothes to sit on your body?' },
  { id: 'color_1', category: 'color', text: 'Go-to color palette?' },
  { id: 'color_2', category: 'color', text: 'Statement color preference?' },
  { id: 'occasion_1', category: 'occasion', text: 'Where do you wear most of your pieces?' },
  { id: 'occasion_2', category: 'occasion', text: 'Most important occasion to dress for?' },
  { id: 'occasion_3', category: 'occasion', text: 'Rental vs buy preference for one-off events?' },
  { id: 'aesthetic_3', category: 'aesthetic', text: 'Designer brands you’re drawn to?' },
];

async function main() {
  await prisma.styleQuizAnswer.deleteMany();
  await prisma.like.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.review.deleteMany();
  await prisma.impactRecord.deleteMany();
  await prisma.post.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.rental.deleteMany();
  await prisma.behaviourEvent.deleteMany();
  await prisma.behaviourSignal.deleteMany();
  await prisma.circulationSchedule.deleteMany();
  await prisma.swap.deleteMany();
  await prisma.garment.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.address.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('KaphorDemo123!', 12);

  const [buyer, seller, admin] = await Promise.all([
    prisma.user.create({
      data: {
        email: 'buyer@kaphor.com',
        username: 'luxe_buyer',
        passwordHash,
        displayName: 'Elena Chen',
        bio: 'Circular fashion enthusiast. Minimalist with a soft spot for Lemaire.',
        location: 'New York, NY',
        role: 'BUYER',
        tier: 'GOLD',
        isVerified: true,
        styleVector: defaultVector(),
        styleAesthetic: 'MINIMALIST',
        onboardingDone: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'seller@kaphor.com',
        username: 'curated_seller',
        passwordHash,
        displayName: 'Sofia Laurent',
        bio: 'Selling pre-loved luxury. Maison Margiela, Totême, The Row.',
        location: 'Paris, France',
        role: 'SELLER',
        tier: 'PLATINUM',
        isVerified: true,
        styleVector: defaultVector(),
        styleAesthetic: 'LUXURY',
        onboardingDone: true,
      },
    }),
    prisma.user.create({
      data: {
        email: 'admin@kaphor.com',
        username: 'kaphor_admin',
        passwordHash,
        displayName: 'Kaphor Admin',
        bio: 'Platform administrator.',
        role: 'ADMIN',
        tier: 'ELITE',
        isVerified: true,
        styleVector: defaultVector(),
        onboardingDone: true,
      },
    }),
  ]);

  const garments = await Promise.all([
    prisma.garment.create({
      data: {
        sellerId: seller.id,
        title: 'Maison Margiela Replica Silk Saree-Style Wrap',
        description: 'Pristine silk wrap dress inspired by traditional drape. Ivory with subtle gold thread. Worn once for editorial.',
        brand: 'Maison Margiela',
        category: 'sarees',
        subCategory: 'contemporary',
        size: 'OS',
        color: ['ivory', 'gold'],
        material: ['silk'],
        condition: 'PRISTINE',
        images: ['https://res.cloudinary.com/demo/image/upload/sample_saree_1.jpg'],
        tags: ['silk', 'wrap', 'editorial', 'luxury'],
        styleTags: ['minimalist', 'luxury', 'ethnic'],
        garmentVector: defaultVector(),
        listingType: 'SALE',
        price: 420,
      },
    }),
    prisma.garment.create({
      data: {
        sellerId: seller.id,
        title: 'Lemaire Oversized Wool-Blend Jacket',
        description: 'Signature Lemaire cut. Camel wool-blend, single button. Perfect for layered minimal looks.',
        brand: 'Lemaire',
        category: 'jackets',
        subCategory: 'oversized',
        size: 'M',
        color: ['camel'],
        material: ['wool', 'blend'],
        condition: 'PRISTINE',
        images: ['https://res.cloudinary.com/demo/image/upload/sample_jacket_1.jpg'],
        tags: ['oversized', 'wool', 'minimal', 'lemaire'],
        styleTags: ['minimalist', 'luxury'],
        garmentVector: defaultVector(),
        listingType: 'SALE',
        price: 380,
        rentalPriceDay: 55,
        rentalPriceWeek: 140,
      },
    }),
    prisma.garment.create({
      data: {
        sellerId: seller.id,
        title: 'Totême Cashmere Blend Coat',
        description: 'Clean lines, grey cashmere blend. Scandinavian luxury. Excellent condition.',
        brand: 'Totême',
        category: 'jackets',
        subCategory: 'coat',
        size: 'S',
        color: ['grey'],
        material: ['cashmere', 'wool'],
        condition: 'PRISTINE',
        images: ['https://res.cloudinary.com/demo/image/upload/sample_coat_1.jpg'],
        tags: ['cashmere', 'coat', 'scandinavian', 'toteme'],
        styleTags: ['minimalist', 'luxury'],
        garmentVector: defaultVector(),
        listingType: 'RENTAL',
        rentalPriceDay: 65,
        rentalPriceWeek: 165,
      },
    }),
    prisma.garment.create({
      data: {
        sellerId: seller.id,
        title: 'The Row Silk Midi Dress',
        description: 'Slip-style midi in black silk. Timeless, understated luxury.',
        brand: 'The Row',
        category: 'dresses',
        subCategory: 'midi',
        size: 'S',
        color: ['black'],
        material: ['silk'],
        condition: 'PRISTINE',
        images: ['https://res.cloudinary.com/demo/image/upload/sample_dress_1.jpg'],
        tags: ['silk', 'midi', 'slip', 'the row'],
        styleTags: ['minimalist', 'luxury'],
        garmentVector: defaultVector(),
        listingType: 'SALE',
        price: 520,
        rentalPriceDay: 85,
        rentalPriceWeek: 200,
      },
    }),
    prisma.garment.create({
      data: {
        sellerId: seller.id,
        title: 'Margiela Tabi Ankle Boots',
        description: 'Iconic Tabi in black leather. Size 38. Light wear on sole.',
        brand: 'Maison Margiela',
        category: 'accessories',
        subCategory: 'shoes',
        size: '38',
        color: ['black'],
        material: ['leather'],
        condition: 'MINOR_WEAR',
        images: ['https://res.cloudinary.com/demo/image/upload/sample_tabi_1.jpg'],
        tags: ['tabi', 'boots', 'margiela', 'statement'],
        styleTags: ['bold', 'luxury'],
        garmentVector: defaultVector(),
        listingType: 'SALE',
        price: 340,
      },
    }),
    prisma.garment.create({
      data: {
        sellerId: seller.id,
        title: 'Lemaire Leather Belt Bag',
        description: 'Compact crossbody in smooth black leather. Minimal hardware.',
        brand: 'Lemaire',
        category: 'accessories',
        subCategory: 'bags',
        size: 'OS',
        color: ['black'],
        material: ['leather'],
        condition: 'PRISTINE',
        images: ['https://res.cloudinary.com/demo/image/upload/sample_bag_1.jpg'],
        tags: ['belt bag', 'leather', 'lemaire', 'minimal'],
        styleTags: ['minimalist', 'luxury'],
        garmentVector: defaultVector(),
        listingType: 'SALE',
        price: 285,
      },
    }),
    prisma.garment.create({
      data: {
        sellerId: seller.id,
        title: 'Totême Linen Blend Shirt Dress',
        description: 'Relaxed shirt dress in sand linen blend. Perfect summer layer.',
        brand: 'Totême',
        category: 'dresses',
        subCategory: 'shirt dress',
        size: 'M',
        color: ['sand', 'beige'],
        material: ['linen', 'cotton'],
        condition: 'PRISTINE',
        images: ['https://res.cloudinary.com/demo/image/upload/sample_shirtdress_1.jpg'],
        tags: ['linen', 'shirt dress', 'summer', 'toteme'],
        styleTags: ['minimalist', 'luxury'],
        garmentVector: defaultVector(),
        listingType: 'SALE',
        price: 195,
        rentalPriceDay: 40,
        rentalPriceWeek: 95,
      },
    }),
    prisma.garment.create({
      data: {
        sellerId: seller.id,
        title: 'Vintage-Inspired Silk Saree (Replica Aesthetic)',
        description: 'Deep crimson silk with gold border. Modern drape, occasion-ready.',
        brand: 'Maison Margiela',
        category: 'sarees',
        subCategory: 'occasion',
        size: 'OS',
        color: ['red', 'gold'],
        material: ['silk'],
        condition: 'PRISTINE',
        images: ['https://res.cloudinary.com/demo/image/upload/sample_saree_2.jpg'],
        tags: ['silk', 'saree', 'occasion', 'vintage'],
        styleTags: ['ethnic', 'luxury'],
        garmentVector: defaultVector(),
        listingType: 'SALE',
        price: 460,
        rentalPriceDay: 75,
        rentalPriceWeek: 180,
      },
    }),
    prisma.garment.create({
      data: {
        sellerId: seller.id,
        title: 'Structured Blazer – Minimalist Cut',
        description: 'Grey wool blazer, sharp shoulders. Works with trousers or jeans.',
        brand: 'Totême',
        category: 'jackets',
        subCategory: 'blazer',
        size: 'M',
        color: ['grey'],
        material: ['wool'],
        condition: 'PRISTINE',
        images: ['https://res.cloudinary.com/demo/image/upload/sample_blazer_1.jpg'],
        tags: ['blazer', 'wool', 'structured', 'toteme'],
        styleTags: ['minimalist', 'luxury'],
        garmentVector: defaultVector(),
        listingType: 'SALE',
        price: 320,
        rentalPriceDay: 50,
        rentalPriceWeek: 120,
      },
    }),
    prisma.garment.create({
      data: {
        sellerId: seller.id,
        title: 'Gold Hoop Earrings – Statement',
        description: 'Large gold hoops, vermeil. Statement jewellery for evening or editorial.',
        brand: 'Lemaire',
        category: 'accessories',
        subCategory: 'jewellery',
        size: 'OS',
        color: ['gold'],
        material: ['vermeil', 'gold'],
        condition: 'PRISTINE',
        images: ['https://res.cloudinary.com/demo/image/upload/sample_hoops_1.jpg'],
        tags: ['hoops', 'gold', 'statement', 'lemaire'],
        styleTags: ['luxury', 'minimalist'],
        garmentVector: defaultVector(),
        listingType: 'SALE',
        price: 145,
      },
    }),
  ]);

  const garmentIds = garments.map((g) => g.id);

  const posts = await Promise.all([
    prisma.post.create({
      data: {
        userId: seller.id,
        type: 'OUTFIT',
        caption: 'Lemaire jacket + The Row slip. Minimal layers for the city.',
        images: ['https://res.cloudinary.com/demo/image/upload/post_1.jpg'],
        garmentIds: [garmentIds[1], garmentIds[3]],
        tags: ['minimal', 'lemaire', 'the row', 'outfit'],
      },
    }),
    prisma.post.create({
      data: {
        userId: buyer.id,
        type: 'CIRCULAR_STORY',
        caption: 'First rental on Kaphor – Totême coat for a week. Seamless experience.',
        images: ['https://res.cloudinary.com/demo/image/upload/post_2.jpg'],
        garmentIds: [garmentIds[2]],
        tags: ['rental', 'toteme', 'circular'],
      },
    }),
    prisma.post.create({
      data: {
        userId: seller.id,
        type: 'TRANSFORMATION',
        caption: 'Before/after: Margiela silk wrap styled two ways – day and evening.',
        images: ['https://res.cloudinary.com/demo/image/upload/post_3a.jpg', 'https://res.cloudinary.com/demo/image/upload/post_3b.jpg'],
        garmentIds: [garmentIds[0]],
        tags: ['margiela', 'silk', 'styling', 'transformation'],
      },
    }),
  ]);

  await Promise.all([
    prisma.like.create({ data: { userId: buyer.id, postId: posts[0].id } }),
    prisma.like.create({ data: { userId: admin.id, postId: posts[0].id } }),
    prisma.like.create({ data: { userId: admin.id, postId: posts[1].id } }),
    prisma.like.create({ data: { userId: seller.id, postId: posts[1].id } }),
    prisma.like.create({ data: { userId: buyer.id, postId: posts[2].id } }),
  ]);

  await Promise.all([
    prisma.impactRecord.create({
      data: {
        userId: buyer.id,
        carbonSavedKg: 24,
        waterSavedL: 8100,
        itemsCirculated: 2,
        itemsUpcycled: 0,
        itemsRecycled: 1,
      },
    }),
    prisma.impactRecord.create({
      data: {
        userId: seller.id,
        carbonSavedKg: 48,
        waterSavedL: 16200,
        itemsCirculated: 6,
        itemsUpcycled: 1,
        itemsRecycled: 0,
      },
    }),
    prisma.impactRecord.create({
      data: {
        userId: admin.id,
        carbonSavedKg: 12,
        waterSavedL: 4050,
        itemsCirculated: 1,
        itemsUpcycled: 0,
        itemsRecycled: 0,
      },
    }),
  ]);

  const quizAnswersBuyer = [
    { questionId: 'aesthetic_1', answer: 'Minimal with interesting cuts' },
    { questionId: 'aesthetic_2', answer: 'Quiet luxury, understated' },
    { questionId: 'fit_1', answer: 'Relaxed, not tight' },
    { questionId: 'fit_2', answer: 'Structured but comfortable' },
    { questionId: 'color_1', answer: 'Neutrals, black, camel' },
    { questionId: 'color_2', answer: 'One statement piece per look' },
    { questionId: 'occasion_1', answer: 'Work and weekend' },
    { questionId: 'occasion_2', answer: 'Dinner and events' },
    { questionId: 'occasion_3', answer: 'Rent for one-off, buy for repeat' },
    { questionId: 'aesthetic_3', answer: 'Lemaire, Totême, The Row' },
  ];
  const quizAnswersSeller = [
    { questionId: 'aesthetic_1', answer: 'Luxury and heritage' },
    { questionId: 'aesthetic_2', answer: 'Editorial, timeless' },
    { questionId: 'fit_1', answer: 'Oversized and tailored mix' },
    { questionId: 'fit_2', answer: 'Clean lines, good drape' },
    { questionId: 'color_1', answer: 'Black, ivory, camel' },
    { questionId: 'color_2', answer: 'Gold or red accent' },
    { questionId: 'occasion_1', answer: 'Selling and styling' },
    { questionId: 'occasion_2', answer: 'Editorial and events' },
    { questionId: 'occasion_3', answer: 'Prefer buying, then circulating' },
    { questionId: 'aesthetic_3', answer: 'Maison Margiela, Lemaire' },
  ];
  const quizAnswersAdmin = [
    { questionId: 'aesthetic_1', answer: 'Mix of minimal and bold' },
    { questionId: 'aesthetic_2', answer: 'Functional luxury' },
    { questionId: 'fit_1', answer: 'True to size' },
    { questionId: 'fit_2', answer: 'Comfort first' },
    { questionId: 'color_1', answer: 'Neutrals' },
    { questionId: 'color_2', answer: 'Muted tones' },
    { questionId: 'occasion_1', answer: 'Everyday' },
    { questionId: 'occasion_2', answer: 'All occasions' },
    { questionId: 'occasion_3', answer: 'Both rent and buy' },
    { questionId: 'aesthetic_3', answer: 'Totême, Lemaire' },
  ];

  for (const a of quizAnswersBuyer) {
    await prisma.styleQuizAnswer.create({
      data: { userId: buyer.id, questionId: a.questionId, answer: a.answer },
    });
  }
  for (const a of quizAnswersSeller) {
    await prisma.styleQuizAnswer.create({
      data: { userId: seller.id, questionId: a.questionId, answer: a.answer },
    });
  }
  for (const a of quizAnswersAdmin) {
    await prisma.styleQuizAnswer.create({
      data: { userId: admin.id, questionId: a.questionId, answer: a.answer },
    });
  }

  console.log('Seed complete: 3 users, 10 garments, 3 posts, 5 likes, 3 impact records, 30 style quiz answers.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
