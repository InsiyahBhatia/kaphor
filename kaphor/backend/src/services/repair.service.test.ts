/**
 * Unit tests for Repair & Refresh service
 */
import { buildYouTubeQuery, rankYouTubeResults } from './repair.service';
import type { YouTubeVideo } from './repair.service';

function stub(title: string, videoId: string): YouTubeVideo {
  return {
    videoId,
    title,
    channelTitle: 'Test Channel',
    thumbnail: '',
    publishedAt: '',
  };
}

describe('buildYouTubeQuery', () => {
  it('builds repair-oriented query with garment, fiber and damage', () => {
    const q = buildYouTubeQuery('shirt', 'cotton', ['tear', 'stain'], 'RESELL');
    expect(q).toContain('repair');
    expect(q).toContain('cotton');
    expect(q).toContain('shirt');
    expect(q).toContain('tear');
    expect(q).toContain('stain');
  });

  it('builds upcycle-oriented query without mending terms', () => {
    const q = buildYouTubeQuery('saree', 'silk', ['fading'], 'UPCYCLE');
    expect(q).toContain('upcycle');
    expect(q).toContain('saree');
    expect(q).toContain('silk');
    expect(q).not.toContain('fading');
    expect(q).not.toContain('repair');
    expect(q).not.toContain('mend');
  });

  it('builds recycle-oriented query with fiber context', () => {
    const q = buildYouTubeQuery('jeans', 'denim', ['hole', 'tear'], 'RECYCLE');
    expect(q).toContain('textile recycling');
    expect(q).toContain('jeans');
    expect(q).toContain('denim');
    expect(q).not.toContain('hole');
    expect(q).not.toContain('tear');
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

  it('skips damage types for upcycle to avoid mending videos', () => {
    const q = buildYouTubeQuery('jacket', 'wool', ['tear', 'stain', 'hole', 'fading'], 'UPCYCLE');
    expect(q).toContain('jacket');
    expect(q).toContain('wool');
    ['tear', 'stain', 'hole', 'fading'].forEach((d) => expect(q).not.toContain(d));
  });
});

describe('rankYouTubeResults', () => {
  it('puts the on-topic tutorial first and drops irrelevant content', () => {
    const videos = [
      stub('How to Repair a Torn Cotton Shirt at Home', 'id-1'),
      stub('5 Cool DIY Ideas for Old Fabric', 'id-2'),
      stub('Morning Lofi Beats for Studying', 'id-3'),
    ];
    const out = rankYouTubeResults(videos, 'how to repair fix mend cotton shirt tear stain tutorial', 6);
    expect(out[0].videoId).toBe('id-1');
    expect(out.map((v) => v.videoId)).not.toContain('id-3');
  });

  it('drops content flagged as clearly irrelevant even in fallback', () => {
    const videos = [
      stub('How to Repair Your Jeans (Official Music Video)', 'id-bad'),
      stub('Repairing Denim Step by Step for Beginners', 'id-good'),
    ];
    const out = rankYouTubeResults(videos, 'how to repair fix mend denim jeans hole tear tutorial', 6);
    expect(out[0].videoId).toBe('id-good');
    expect(out.map((v) => v.videoId)).not.toContain('id-bad');
  });

  it('dedupes by videoId and caps at maxResults', () => {
    const videos = [
      stub('Repair Cotton Shirt Tutorial', 'same'),
      stub('Repair Cotton Shirt Tutorial (2)', 'same'),
      stub('Repair Cotton Shirt Tutorial (3)', 'other'),
    ];
    const out = rankYouTubeResults(videos, 'how to repair fix mend cotton shirt tear stain tutorial', 1);
    expect(out.length).toBe(1);
    expect(out[0].videoId).toBe('same');
  });
});