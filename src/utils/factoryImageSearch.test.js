const {
  scoreImageCandidate,
  buildSearchQueries,
  pickBestImageCandidate,
  hasMeshyTrap,
} = require('../../scripts/lib/factoryImageSearch');

describe('factoryImageSearch', () => {
  test('buildSearchQueries leads with packshot / cutout and includes a neutral query', () => {
    const q = buildSearchQueries({ brand: 'Boss', name: 'DS-1 Distortion' });
    expect(q[0]).toMatch(/packshot white background cutout/i);
    expect(q.some((s) => /unlit|pads off|screen off/i.test(s))).toBe(true);
  });

  test('prefers retailer product shots over pinterest lifestyle', () => {
    const good = scoreImageCandidate({
      url: 'https://static.sweetwater.com/images/items/750/BossDS1-large.jpg',
      title: 'Boss DS-1 Distortion product',
      width: 1200,
      height: 800,
    });
    const bad = scoreImageCandidate({
      url: 'https://i.pinimg.com/originals/xx/unboxing-live-gig.jpg',
      title: 'my pedalboard at the concert',
      width: 400,
      height: 900,
    });
    expect(good.score).toBeGreaterThan(bad.score);
    expect(good.score).toBeGreaterThan(30);
  });

  test('penalizes square image for wide gear', () => {
    const wide = scoreImageCandidate(
      {
        url: 'https://cdn.example.com/product.jpg',
        title: 'Pioneer DDJ-FLX4 product',
        width: 600,
        height: 600,
      },
      { width_mm: 482, depth_mm: 273, height_mm: 59 }
    );
    const landscape = scoreImageCandidate(
      {
        url: 'https://cdn.example.com/product-angle.jpg',
        title: 'Pioneer DDJ-FLX4 product studio',
        width: 1200,
        height: 700,
      },
      { width_mm: 482, depth_mm: 273, height_mm: 59 }
    );
    expect(landscape.score).toBeGreaterThan(wide.score);
  });

  test('penalizes Meshy trap titles (rainbow / lit pads) vs packshot', () => {
    const trap = scoreImageCandidate({
      url: 'https://cdn.novationmusic.com/launchpad-rainbow-demo.jpg',
      title: 'Launchpad X rainbow LED demo mode lit pads',
      width: 1200,
      height: 800,
    });
    const packshot = scoreImageCandidate({
      url: 'https://static.sweetwater.com/images/items/750/LaunchpadX-large.jpg',
      title: 'Novation Launchpad X packshot white background cutout',
      width: 1200,
      height: 800,
    });
    expect(trap.hasMeshyTrap).toBe(true);
    expect(packshot.hasMeshyTrap).toBe(false);
    expect(packshot.score).toBeGreaterThan(trap.score);
  });

  test('boosts neutral geometry cues over lit demos on same host', () => {
    const lit = scoreImageCandidate({
      url: 'https://cdn.example.com/a.jpg',
      title: 'Controller RGB glowing illuminated pads',
      width: 1000,
      height: 700,
    });
    const neutral = scoreImageCandidate({
      url: 'https://cdn.example.com/b.jpg',
      title: 'Controller packshot cutout unlit pads off',
      width: 1000,
      height: 700,
    });
    expect(neutral.score).toBeGreaterThan(lit.score);
    expect(neutral.hasNeutralGeometry).toBe(true);
  });

  test('pickBestImageCandidate prefers nearby non-trap over trap top score', () => {
    const ranked = [
      {
        url: 'https://cdn.example.com/trap.jpg',
        title: 'rainbow LED demo',
        score: 50,
        hasMeshyTrap: true,
      },
      {
        url: 'https://cdn.example.com/pack.jpg',
        title: 'packshot white background',
        score: 42,
        hasMeshyTrap: false,
      },
    ];
    const pick = pickBestImageCandidate(ranked, { minScore: 15, window: 15 });
    expect(pick.url).toBe('https://cdn.example.com/pack.jpg');
  });

  test('pickBestImageCandidate keeps trap when no safer alternative in window', () => {
    const ranked = [
      {
        url: 'https://cdn.example.com/trap.jpg',
        title: 'glowing neon',
        score: 55,
        hasMeshyTrap: true,
      },
      {
        url: 'https://cdn.example.com/weak.jpg',
        title: 'product',
        score: 20,
        hasMeshyTrap: false,
      },
    ];
    const pick = pickBestImageCandidate(ranked, { minScore: 15, window: 15 });
    expect(pick.url).toBe('https://cdn.example.com/trap.jpg');
  });

  test('hasMeshyTrap detects title cues', () => {
    expect(hasMeshyTrap({ title: 'pads lit rainbow', url: 'https://x.com/a.jpg' })).toBe(true);
    expect(hasMeshyTrap({ title: 'packshot cutout', url: 'https://x.com/a.jpg' })).toBe(false);
  });
});
