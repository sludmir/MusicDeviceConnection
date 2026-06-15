import { midpoint, panOffsetFromMidpointDelta } from './cameraPan';

describe('midpoint', () => {
  test('averages two points', () => {
    expect(midpoint({ clientX: 0, clientY: 0 }, { clientX: 10, clientY: 20 })).toEqual({ x: 5, y: 10 });
  });
});

describe('panOffsetFromMidpointDelta', () => {
  const base = { cameraDistance: 10, viewportHeight: 800, fovRad: Math.PI / 3 }; // 60° fov

  test('zero finger movement produces zero pan', () => {
    const { rightUnits, upUnits } = panOffsetFromMidpointDelta({ dxScreen: 0, dyScreen: 0, ...base });
    expect(rightUnits).toBeCloseTo(0, 10); // tolerant of signed zero
    expect(upUnits).toBeCloseTo(0, 10);
  });

  test('dragging fingers right moves camera left along its right axis (negative rightUnits)', () => {
    const { rightUnits } = panOffsetFromMidpointDelta({ dxScreen: 40, dyScreen: 0, ...base });
    expect(rightUnits).toBeLessThan(0);
  });

  test('dragging fingers down produces positive upUnits (scene follows fingers)', () => {
    const { upUnits } = panOffsetFromMidpointDelta({ dxScreen: 0, dyScreen: 40, ...base });
    expect(upUnits).toBeGreaterThan(0);
  });

  test('farther camera distance pans more world units for the same drag', () => {
    const near = panOffsetFromMidpointDelta({ dxScreen: 40, dyScreen: 0, ...base, cameraDistance: 5 });
    const far = panOffsetFromMidpointDelta({ dxScreen: 40, dyScreen: 0, ...base, cameraDistance: 20 });
    expect(Math.abs(far.rightUnits)).toBeGreaterThan(Math.abs(near.rightUnits));
  });

  test('matches the OrbitControls world-per-pixel formula', () => {
    // worldPerPixel = 2 * dist * tan(fov/2) / viewportHeight
    const wpp = (2 * 10 * Math.tan((Math.PI / 3) / 2)) / 800;
    const { rightUnits, upUnits } = panOffsetFromMidpointDelta({ dxScreen: 40, dyScreen: -25, ...base });
    expect(rightUnits).toBeCloseTo(-40 * wpp, 6);
    expect(upUnits).toBeCloseTo(-25 * wpp, 6);
  });
});
