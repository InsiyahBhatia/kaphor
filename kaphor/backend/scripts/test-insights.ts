import db from '../src/lib/prisma';
import { InsightService } from '../src/services/insight.service';
import { EventType } from '@prisma/client';

async function main() {
  console.log('🧪 Starting Seller Listing Insights Test...');

  // 1. Find or create a seller
  let seller = await db.user.findFirst({
    where: { email: 'seller-test@kaphor.test' },
  });
  if (!seller) {
    seller = await db.user.create({
      data: {
        email: 'seller-test@kaphor.test',
        username: 'sellertest_' + Date.now(),
        displayName: 'Atelier Test Seller',
      },
    });
  }

  // 2. Find or create a buyer
  let buyer = await db.user.findFirst({
    where: { email: 'buyer-test@kaphor.test' },
  });
  if (!buyer) {
    buyer = await db.user.create({
      data: {
        email: 'buyer-test@kaphor.test',
        username: 'buyertest_' + Date.now(),
        displayName: 'Haute Shopper',
      },
    });
  }

  // 3. Create a test garment
  const garment = await db.garment.create({
    data: {
      sellerId: seller.id,
      title: 'Silk Velvet Smoking Robe',
      description: 'Archival silk velvet smoking robe with satin lapels and sash belt.',
      brand: 'Haider Ackermann',
      category: 'Outerwear',
      size: 'L',
      condition: 'PRISTINE',
      price: 34000,
      rentalPriceDay: 2500,
      images: ['https://kaphor.test/robe1.jpg'],
      color: ['Burgundy', 'Black'],
      material: ['Silk', 'Velvet'],
      viewCount: 14,
      lifecycleState: 'LISTED',
      isActive: true,
    },
  });

  console.log(`✅ Created test garment: ${garment.title} (ID: ${garment.id})`);

  // 4. Simulate buyer telemetry interactions
  await db.behaviourEvent.createMany({
    data: [
      { userId: buyer.id, garmentId: garment.id, eventType: EventType.VIEW },
      { userId: buyer.id, garmentId: garment.id, eventType: EventType.ADD_TO_CART },
      { userId: buyer.id, garmentId: garment.id, eventType: EventType.WISHLIST },
      { userId: buyer.id, garmentId: garment.id, eventType: EventType.PURCHASE_INTENT },
    ],
  });

  // 5. Add active cart item
  await db.cartItem.upsert({
    where: { userId_garmentId: { userId: buyer.id, garmentId: garment.id } },
    update: {},
    create: { userId: buyer.id, garmentId: garment.id },
  });

  // 6. Test getGarmentDetailedInsights
  const detailedInsights = await InsightService.getGarmentDetailedInsights(garment.id, seller.id);
  if (!detailedInsights) {
    throw new Error('Detailed insights returned null for valid seller garment!');
  }

  console.log('\n📊 Detailed Insights Result:');
  console.log(`- Garment: ${detailedInsights.title} (${detailedInsights.brand})`);
  console.log(`- Views: ${detailedInsights.views} (Unique: ${detailedInsights.uniqueViewers})`);
  console.log(`- Active In Cart: ${detailedInsights.activeInCart}`);
  console.log(`- Saves/Wishlists: ${detailedInsights.saves}`);
  console.log(`- Demand Tier: ${detailedInsights.demandTier} (Score: ${detailedInsights.demandScore})`);
  console.log(`- Funnel Rates:`, detailedInsights.funnel);
  console.log(`- 7-Day Trend Days Count: ${detailedInsights.dailyTrend.length}`);
  console.log(`- AI Advisor Tips Count: ${detailedInsights.advisorTips.length}`);
  detailedInsights.advisorTips.forEach((tip, idx) => {
    console.log(`  Tip #${idx + 1} [${tip.category}] [${tip.impact}]: ${tip.headline} - ${tip.description}`);
  });

  if (detailedInsights.views < 14) throw new Error(`Expected at least 14 views, got ${detailedInsights.views}`);
  if (detailedInsights.activeInCart !== 1) throw new Error(`Expected 1 active cart, got ${detailedInsights.activeInCart}`);
  if (detailedInsights.saves < 1) throw new Error(`Expected at least 1 save, got ${detailedInsights.saves}`);

  // 7. Test Security: Unauthorized user access
  const unauthorizedInsights = await InsightService.getGarmentDetailedInsights(garment.id, buyer.id);
  if (unauthorizedInsights !== null) {
    throw new Error('Security violation: non-seller was able to view listing insights!');
  }
  console.log('✅ Security check passed: Non-seller access correctly blocked (returned null)');

  // 8. Test getBatchListingsSummary
  const batchSummary = await InsightService.getBatchListingsSummary([garment.id]);
  console.log('\n📦 Batch Summary Result:', batchSummary);
  if (!batchSummary[garment.id] || batchSummary[garment.id].inCart !== 1 || batchSummary[garment.id].saves !== 1) {
    throw new Error('Batch summary aggregation failed verification!');
  }
  console.log('✅ Batch summary verified successfully');

  // Clean up test data
  await db.cartItem.deleteMany({ where: { garmentId: garment.id } });
  await db.behaviourEvent.deleteMany({ where: { garmentId: garment.id } });
  await db.garment.delete({ where: { id: garment.id } });
  console.log('🧹 Cleaned up test garment and events');

  console.log('\n🎉 ALL SELLER LISTING INSIGHTS TESTS PASSED!\n');
}

main().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
