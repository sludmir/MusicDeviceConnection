import { stableDeviceUniqueId, normalizeSetupDevices } from './hydrateSetupDevices';
import { inferConnections } from './inferConnections';

describe('hydrateSetupDevices helpers', () => {
  test('stableDeviceUniqueId uses saved position when uniqueId is missing', () => {
    const id = stableDeviceUniqueId({
      id: 'cdj-1',
      position: { x: 1.2, y: 0, z: -0.5 },
    }, 0);
    expect(id).toBe('cdj-1-1.2-0--0.5');
  });

  test('normalizeSetupDevices fills missing port metadata from knowledge base', () => {
    const [device] = normalizeSetupDevices([
      { id: 'x', name: 'Pioneer CDJ-3000', position: { x: 0, y: 0, z: 0 }, inputs: [], outputs: [] },
    ]);
    expect(device.outputs?.length).toBeGreaterThan(0);
    expect(device.uniqueId).toBe('x-0-0-0');
  });

  test('normalized devices produce wired connections', () => {
    const devices = normalizeSetupDevices([
      { id: 'cdj', name: 'Pioneer CDJ-3000', position: { x: -1, y: 0, z: 0 }, inputs: [], outputs: [] },
      { id: 'cdj2', name: 'Pioneer CDJ-3000', position: { x: 1, y: 0, z: 0 }, inputs: [], outputs: [] },
      { id: 'mix', name: 'Pioneer DJM-900NXS2', position: { x: 0, y: 0, z: 0 }, inputs: [], outputs: [] },
    ]);
    const connections = inferConnections(devices, 'DJ');
    expect(connections.length).toBeGreaterThan(0);
    expect(connections.every((c) => c.fromUniqueId && c.toUniqueId)).toBe(true);
  });
});
