/**
 * Unit tests for Repair & Refresh service
 */
import { buildYouTubeQuery } from './repair.service';

describe('buildYouTubeQuery', () => {
  it('builds resell-oriented query', () => {
    const q = buildYouTubeQuery('shirt', 'cotton', ['tear', 'stain'], 'RESELL');
    expect(q).toContain('clothing repair');
    expect(q).toContain('shirt');
    expect(q).toContain('cotton');
    expect(q).toContain('tear');
    expect(q).toContain('stain');
  });

  it('builds upcycle-oriented query', () => {
    const q = buildYouTubeQuery('saree', 'silk', ['fading'], 'UPCYCLE');
    expect(q).toContain('upcycle');
    expect(q).toContain('saree');
    expect(q).toContain('silk');
    expect(q).toContain('fading');
  });

  it('builds recycle-oriented query', () => {
    const q = buildYouTubeQuery('jeans', 'denim', ['hole', 'tear'], 'RECYCLE');
    expect(q).toContain('recycling');
    expect(q).toContain('diy');
  });

  it('handles missing damage types gracefully', () => {
    const q = buildYouTubeQuery('kurta', 'cotton', [], 'UPCYCLE');
    expect(q).toContain('upcycle');
    expect(q).toContain('kurta');
    expect(q).toContain('cotton');
  });

  it('filters out "none" damage type', () => {
    const q = buildYouTubeQuery('dress', 'polyester', ['none'], 'RESELL');
    expect(q).not.toContain('none');
  });

  it('limits damage types to top 2', () => {
    const q = buildYouTubeQuery('jacket', 'wool', ['tear', 'stain', 'hole', 'fading'], 'UPCYCLE');
    // Should only include first 2 damage types
    expect(q).toContain('tear');
    expect(q).toContain('stain');
    expect(q).not.toContain('hole');
    expect(q).not.toContain('fading');
  });
});
