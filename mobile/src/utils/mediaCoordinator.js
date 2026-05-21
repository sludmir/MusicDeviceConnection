// MediaCoordinator
//
// Single source of truth for "what is currently playing" across the app.
// Cards (clip, set) register a pause function on mount, deregister on
// unmount, and call `play(id)` when they want focus. The coordinator pauses
// the previously-active media synchronously.
//
// Used to guarantee no audio bleeds across feed-mode swaps or navigation
// transitions: callers can `stopAll()` before tearing down a tree.
//
// Implementation note: this is a plain JS singleton, not a React context.
// We need synchronous `stopAll()` from places that aren't components
// (effects, navigation listeners) and we don't want a re-render to be a
// precondition for stopping audio.

const registry = new Map(); // id -> pauseFn
let activeId = null;

export const MediaCoordinator = {
  register(id, pauseFn) {
    registry.set(id, pauseFn);
  },

  unregister(id) {
    registry.delete(id);
    if (activeId === id) activeId = null;
  },

  play(id) {
    if (activeId && activeId !== id) {
      const prev = registry.get(activeId);
      if (prev) {
        try { prev(); } catch (e) { /* ignore */ }
      }
    }
    activeId = id;
  },

  stopAll() {
    for (const pauseFn of registry.values()) {
      try { pauseFn(); } catch (e) { /* ignore */ }
    }
    activeId = null;
  },

  getActiveId() {
    return activeId;
  },
};
