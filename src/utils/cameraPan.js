// Pure pan math for the set builder's two-finger touch gesture. Returns how far
// to translate the camera + target along the camera's own right/up axes so the
// scene tracks the fingers 1:1 (same world-per-pixel formula OrbitControls uses
// for perspective pan). ThreeScene multiplies these scalars by the live camera
// basis vectors — keeping this file WebGL-free and unit-testable.

export function midpoint(a, b) {
  return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
}

export function panOffsetFromMidpointDelta({ dxScreen, dyScreen, cameraDistance, viewportHeight, fovRad }) {
  if (!viewportHeight) return { rightUnits: 0, upUnits: 0 };
  const worldPerPixel = (2 * cameraDistance * Math.tan(fovRad / 2)) / viewportHeight;
  // Drag right (dxScreen > 0): camera shifts left along its right axis → negative.
  // Drag down (dyScreen > 0, screen-y points down): camera shifts up in world → positive.
  return {
    rightUnits: -dxScreen * worldPerPixel,
    upUnits: dyScreen * worldPerPixel,
  };
}
