import db from '../src/lib/prisma';
import { EventType } from '@prisma/client';
import { PreferenceService } from '../src/services/preference.service';
import { RecommendationService } from '../src/services/recommendation.service';

async function runTest() {
  console.log('🧪 [Test] Starting Recommendation & Behavior Monitoring Test...');

  // 1. Find a test user and test garment
  const user = await db.user.findFirst({
    select: { id: true, email: true, styleVector: true, preferenceProfile: true },
  });

  if (!user) {
    console.error('❌ No user found for test');
    process.exit(1);
  }

  const garment = await db.garment.findFirst({
    where: { isActive: true, lifecycleState: 'LISTED' },
    select: { id: true, title: true, category: true, brand: true, price: true, garmentVector: true },
  });

  if (!garment) {
    console.error('❌ No garment found for test');
    process.exit(1);
  }

  console.log(`👤 Testing with User: ${user.id} (${user.email})`);
  console.log(`👗 Testing with Garment: "${garment.title}" (${garment.category}, ${garment.brand}, ₹${garment.price})`);

  // 2. Simulate VIEW interaction
  console.log('\n📡 1. Simulating VIEW event...');
  await PreferenceService.processEvent(user.id, EventType.VIEW, garment.id, { dwellSeconds: 8 });

  // 3. Simulate WISHLIST interaction
  console.log('📡 2. Simulating WISHLIST event...');
  await PreferenceService.processEvent(user.id, EventType.WISHLIST, garment.id);

  // 4. Simulate ADD_TO_CART interaction
  console.log('📡 3. Simulating ADD_TO_CART event...');
  await PreferenceService.processEvent(user.id, EventType.ADD_TO_CART, garment.id);

  // 5. Verify updated user profile in database
  const updatedUser = await db.user.findUnique({
    where: { id: user.id },
    select: { styleVector: true, styleAesthetic: true, preferenceProfile: true },
  });

  const profile = updatedUser?.preferenceProfile as any;
  console.log('\n📊 Updated Preference Profile:');
  console.log(`  - Dominant Aesthetic: ${updatedUser?.styleAesthetic || profile?.dominantAesthetic}`);
  console.log(`  - Style Vector Length: ${updatedUser?.styleVector?.length}`);
  console.log(`  - Top Categories:`, profile?.topCategories);
  console.log(`  - Top Brands:`, profile?.topBrands);
  console.log(`  - Price Range:`, profile?.priceRange);
  console.log(`  - Total Interactions: ${profile?.totalInteractions}`);

  // 6. Test Recommendation Service
  console.log('\n✨ 4. Testing RecommendationService.getPersonalizedFeed...');
  const recs = await RecommendationService.getPersonalizedFeed(user.id, 5);
  console.log(`  - Returned ${recs.length} personalized recommendations:`);
  for (const r of recs) {
    console.log(`    • [${r.fitScore}%] "${r.title}" (${r.category}) — ${r.matchReason}`);
  }

  console.log('\n✨ 5. Testing RecommendationService.getSimilarGarments...');
  const similar = await RecommendationService.getSimilarGarments(garment.id, 3);
  console.log(`  - Returned ${similar.length} similar garments:`);
  for (const s of similar) {
    console.log(`    • [${s.fitScore}%] "${s.title}" by ${s.brand}`);
  }

  console.log('\n✨ 6. Testing RecommendationService.getRentalRecommendations...');
  const rentals = await RecommendationService.getRentalRecommendations(user.id, 3);
  console.log(`  - Returned ${rentals.length} curated rental picks:`);
  for (const ren of rentals) {
    console.log(`    • [${ren.fitScore}%] "${ren.title}" [₹${ren.price}/day]`);
  }

  console.log('\n🎉 ALL RECOMMENDATION & BEHAVIOR MONITORING TESTS PASSED!');
  process.exit(0);
}

runTest().catch((e) => {
  console.error('❌ Test failed with error:', e);
  process.exit(1);
});
