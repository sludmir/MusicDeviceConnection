import { registerScenePreviewCapture, captureScenePreview } from './scenePreviewCapture';

describe('scenePreviewCapture registry', () => {
  test('returns null when no scene is mounted', async () => {
    expect(await captureScenePreview()).toBeNull();
  });

  test('delegates to the registered capture fn and unregisters cleanly', async () => {
    const blob = { fake: 'blob' };
    const fn = jest.fn(() => blob);
    const unregister = registerScenePreviewCapture(fn);
    expect(await captureScenePreview({ maxWidth: 400 })).toBe(blob);
    expect(fn).toHaveBeenCalledWith({ maxWidth: 400 });
    unregister();
    expect(await captureScenePreview()).toBeNull();
  });

  test('a throwing capture fn degrades to null (save must never fail on preview)', async () => {
    const unregister = registerScenePreviewCapture(() => { throw new Error('boom'); });
    expect(await captureScenePreview()).toBeNull();
    unregister();
  });
});
