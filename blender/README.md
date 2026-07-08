# Blender scene sources

Source `.blend` files for the GLB scene environments in `public/scenes/`.
Canonical copies live here (originals came from `~/Desktop/blender scenes/`).

| .blend | exports to | app setting |
|---|---|---|
| `DJ_Dojo.blend` | `public/scenes/dj-dojo.glb` | DJ → Dojo |
| `DJ_Rooftop.blend` | `public/scenes/dj-rooftop.glb` (draco) | DJ → Rooftop |
| `Musician_Guitar.blend` | `public/scenes/musician-guitar-room.glb` | Musician → Guitar Room |

Club Booth, Studio, and Stage have no .blend — they are procedural three.js
(`ThreeScene.createClubEnvironment`).

## Export

Headless, from repo root:

```
/Applications/Blender.app/Contents/MacOS/Blender --background blender/<file>.blend \
  --python-expr "import bpy; bpy.ops.export_scene.gltf(filepath='public/scenes/<name>.glb', export_format='GLB')"
```

Add `export_draco_mesh_compression_enable=True` for the rooftop (settings.js
declares `draco: true` for it).

## Rules learned the hard way (three.js/glTF compatibility)

- **No transmission glass.** `Transmission Weight > 0` exports
  `KHR_materials_transmission`, which three.js renders as an opaque white
  refraction pass. Use plain alpha-blend glass (Alpha ≈ 0.08, Transmission 0).
- **No procedural emission.** Node-driven Emission Color (Brick/Voronoi/etc.)
  is dropped by the exporter, leaving the whole mesh glowing flat white ×
  strength. Bake to a UV texture first (Cycles bake type EMIT with Emission
  Strength temporarily at 1.0, then rewire the image into Emission Color).
  The dojo `RTower_*` towers use baked 512px window textures; the original
  procedural material `Residential_Tower` is kept with a fake user for rebakes.
- **No mirror chrome.** metallic 1.0 + roughness ≤ 0.2 reflects the app's
  RoomEnvironment IBL as solid white. Keep roughness ≥ ~0.35 (brushed metal).
- **Emissive strengths get ACES-tonemapped** in the app; values ≳ 3 clip to
  white. Keep decorative emission ≤ ~1, deliberate glow (lit windows, lamp
  LEDs) ~2.4–8 depending on size.
- App-side lighting (per-scene day/night blocks, exposure, env intensity)
  lives in `src/data/settings.js` — GLB lights are not exported/used.
