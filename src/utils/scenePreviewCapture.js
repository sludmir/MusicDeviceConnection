// Bridge between the 3D builder and non-3D UI: ThreeScene registers a
// capture function while mounted; SaveSetupButton asks for a JPEG snapshot
// of the current viewport at save time. Null when no scene is mounted or
// capture fails — a save must never fail because of its preview.
let captureFn = null;

export function registerScenePreviewCapture(fn) {
  captureFn = fn;
  return () => { if (captureFn === fn) captureFn = null; };
}

export async function captureScenePreview(opts = {}) {
  if (!captureFn) return null;
  try {
    return (await captureFn(opts)) || null;
  } catch {
    return null;
  }
}
