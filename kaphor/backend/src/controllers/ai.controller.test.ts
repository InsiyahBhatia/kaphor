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

  it('preserves the AI estimate instead of regressing to the thrift average', () => {
    const rec = computeT3PriceRecommendation(
      'Sarees', undefined, 'Designer Saree', 'MINOR_WEAR', 'Sabyasachi',
      { hintPrice: 5000 },
    );
    expect(rec.recommendedPrice).toBe(5000);
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