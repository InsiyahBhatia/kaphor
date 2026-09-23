/**
 * Unit tests for the market price recommendation used in the sell flow.
 * Guards the pricing behaviour: MRP anchoring, AI-estimate preservation,
 * and condition-aware scaling (never a flat thrift/899 guess).
 */
import { computeT3PriceRecommendation } from './ai.controller';

describe('computeT3PriceRecommendation', () => {
  it('anchors on original MRP scaled by resale ratio + condition', () => {
    const rec = computeT3PriceRecommendation(
      'Sarees', 'Ethnic', 'Banarasi Saree', 'PRISTINE', 'Unknown',
      { originalPrice: 15000 },
    );
    expect(rec.recommendedPrice).toBeGreaterThan(1500);
    expect(rec.suggestedOriginalPrice).toBe(15000);
    expect(rec.suggestedRentalPriceDay).toBeGreaterThan(199);
  });

  it('keeps the AI estimate when it sits within the market ceiling', () => {
    const rec = computeT3PriceRecommendation(
      'Sarees', undefined, 'Designer Saree', 'MINOR_WEAR', 'Sabyasachi',
      { hintPrice: 1500 },
    );
    expect(rec.recommendedPrice).toBe(1500);
  });

  it('caps an AI estimate that overprices the market', () => {
    const generic = computeT3PriceRecommendation(
      'Sarees', undefined, 'Silk Saree', 'MINOR_WEAR', 'Unknown',
      { hintPrice: 5000 },
    );
    // Designer tier gets headroom; generic gets reined in to the market band.
    const designer = computeT3PriceRecommendation(
      'Sarees', undefined, 'Silk Saree', 'MINOR_WEAR', 'Sabyasachi',
      { hintPrice: 5000 },
    );
    expect(generic.recommendedPrice).toBeLessThan(5000);
    expect(generic.recommendedPrice).toBeGreaterThanOrEqual(150);
    expect(designer.recommendedPrice).toBeGreaterThan(generic.recommendedPrice);
    expect(designer.recommendedPrice).toBeLessThanOrEqual(5000);
  });

  it('floors a low AI estimate to the category market floor', () => {
    const rec = computeT3PriceRecommendation(
      'Jeans', undefined, 'Denim Jeans', 'MINOR_WEAR', 'Unknown',
      { hintPrice: 25 },
    );
    expect(rec.recommendedPrice).toBeGreaterThanOrEqual(100);
    expect(rec.recommendedPrice).not.toBe(899);
  });

  it('scales by condition: pristine above recycle-only', () => {
    const pristine = computeT3PriceRecommendation('Dresses', undefined, 'Cotton Dress', 'PRISTINE', 'Unknown');
    const recycle = computeT3PriceRecommendation('Dresses', undefined, 'Cotton Dress', 'RECYCLE_ONLY', 'Unknown');
    expect(pristine.recommendedPrice).toBeGreaterThan(recycle.recommendedPrice);
  });

  it('applies a luxury brand multiplier to the market baseline', () => {
    const generic = computeT3PriceRecommendation('Dresses', undefined, 'Silk Dress', 'MINOR_WEAR', 'Unknown');
    const luxury = computeT3PriceRecommendation('Dresses', undefined, 'Silk Dress', 'MINOR_WEAR', 'Gucci');
    expect(luxury.recommendedPrice).toBeGreaterThan(generic.recommendedPrice);
  });
});