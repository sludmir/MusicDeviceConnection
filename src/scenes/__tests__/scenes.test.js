import * as THREE from 'three';
import { buildEnvironment } from '../index';
import { VARIANTS_BY_SETUP } from '../../utils/sceneVariants';

describe('scene builders', () => {
  const allKeys = Object.values(VARIANTS_BY_SETUP).flat().map((v) => v.key);

  test.each(allKeys)('builds and disposes variant "%s"', (key) => {
    const scene = new THREE.Scene();
    const ctx = { djTableRef: { current: null } };
    const handle = buildEnvironment(scene, key, ctx);

    const envCount = scene.children.filter((c) => c.userData?.type === 'environment').length;
    expect(envCount).toBeGreaterThan(0);
    expect(ctx.djTableRef.current).not.toBeNull();

    handle.dispose();
    const after = scene.children.filter((c) => c.userData?.type === 'environment').length;
    expect(after).toBe(0);
  });

  test('unknown variant returns no-op handle', () => {
    const scene = new THREE.Scene();
    const handle = buildEnvironment(scene, 'not-a-key', {});
    expect(scene.children.filter((c) => c.userData?.type === 'environment').length).toBe(0);
    expect(() => handle.dispose()).not.toThrow();
  });
});
