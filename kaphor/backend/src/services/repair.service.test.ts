/**
 * Unit tests for Repair & Refresh service
 */
import {
  buildYouTubeQuery,
  rankYouTubeResults,
  categoryGroup,
  damageTags,
  getVerifiedVideos,
  getVerifiedBlogs,
  youtubeSearchUrl,
} from './repair.service';
import { VERIFIED_VIDEOS, VERIFIED_BLOGS } from '../data/repair-resources';
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
describe('verified resources', () => {
  it('has well-formed, unique entries', () => {
    const ids = VERIFIED_VIDEOS.map((v) => v.videoId);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^[A-Za-z0-9_-]{11}$/));
    const urls = VERIFIED_BLOGS.map((b) => b.url);
    expect(new Set(urls).size).toBe(urls.length);
    VERIFIED_BLOGS.forEach((b) => {
      expect(b.url).toMatch(/^https:\/\//);
      expect(b.title.length).toBeGreaterThan(0);
      expect(b.time_minutes).toBeGreaterThan(0);
    });
  });

  it('maps garment categories to groups', () => {
    expect(categoryGroup('tshirt')).toBe('shirt');
    expect(categoryGroup('trousers')).toBe('jeans');
    expect(categoryGroup('kurti')).toBe('kurta');
    expect(categoryGroup('other')).toBe('general');
  });

  it('turns damage text into tags', () => {
    expect(damageTags(['torn seam', 'missing button'])).toEqual(expect.arrayContaining(['tear', 'seam', 'button']));
  });

  it('returns only upcycle items for upcycle mode and only repair items for repair mode', () => {
    const up = getVerifiedBlogs('upcycle', 'jeans', ['hole']);
    expect(up.length).toBeGreaterThan(0);
    const upUrls = new Set(VERIFIED_BLOGS.filter((b) => b.mode === 'upcycle').map((b) => b.url));
    up.forEach((b) => expect(upUrls.has(b.url)).toBe(true));
    const rep = getVerifiedVideos('repair', 'sweater', ['snag']);
    expect(rep.length).toBeGreaterThan(0);
    const repIds = new Set(VERIFIED_VIDEOS.filter((v) => v.mode === 'repair').map((v) => v.videoId));
    rep.forEach((v) => expect(repIds.has(v.videoId)).toBe(true));
  });

  it('ranks damage matches first', () => {
    const vids = getVerifiedVideos('repair', 'dress', ['zipper']);
    expect(vids[0].title.toLowerCase()).toContain('zipper');
  });

  it('builds an encoded YouTube search link', () => {
    expect(youtubeSearchUrl('fix shirt')).toBe('https://www.youtube.com/results?search_query=fix%20shirt');
  });
});
