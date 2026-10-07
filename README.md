# LiquidLens

A vanilla HTML/CSS/JavaScript playground with ten interactive glass experiments.

## Run

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173`. There is no build step or npm dependency.

## Material and refraction

`optics.js` exposes `LiquidGlass(element, scene, options)`. Canvas generates a rounded-rectangle normal map; SVG displaces a synchronized decorative scene replica. A narrow curved bevel decays into a nearly flat center. Frosting precedes displacement, and the final rounded clip follows the filter so edge samples can reach outside the lens. Foreground labels and controls remain sharp.

- `material`: `regular` (neutral tint and reduced saturation) or `clear` (minimal tint). Default `regular`.
- `strength`: rim displacement in CSS pixels; default 16.
- `blur`: source frosting in CSS pixels; default 3.2.
- `dispersion`: optional red/blue separation; default 0. Nonzero values add two displacement passes.
- `enabled`: false bypasses the filter and material tint for a scene comparison.
- `set(options)`, `refreshScene()`, `destroy()`.
- `glass.invalidate(milliseconds)`: synchronize this lens after position changes or during a transition.
- `LiquidGlass.invalidate(milliseconds)`: synchronize every visible lens when a shared layout changes.

The lab's material selector sets balanced initial strength and frosting; both sliders remain independently adjustable. Reduced transparency or increased contrast preferences use an opaque material and bypass refraction. Reduced motion suppresses decorative movement.

The engine samples an **explicit decorative scene**, not arbitrary page DOM or live video. Keep inputs and controls outside that scene, and call `refreshScene()` after changing its content. Move lenses with translation; rotation, perspective, nonuniform scale, and elliptical/asymmetric corners are outside this engine's scope. It does not rely on SVG filters inside `backdrop-filter` and has no WebGL or framework dependency.

The visual profile was calibrated against the supplied macOS screenshots and Apple's descriptions of [Liquid Glass materials](https://developer.apple.com/design/human-interface-guidelines/materials) and [lensing](https://developer.apple.com/videos/play/wwdc2025/219/). This is an approximation: screenshots cannot establish native optical equations, temporal behavior, or the OS compositor's adaptive color/lighting response. The site's header uses backdrop blur; actual displacement is applied to the explicit experiment scenes.

`examples/integration.html` is assembled from the site's three code tabs. The previous `optical-map.png` is retained but no longer required.

## Performance

The normal path uses one displacement pass. Maps share a bounded LRU cache (48 entries / 6 MiB of encoded strings), a reusable CPU-backed canvas, and a resolution budget of 49,152 pixels. During small geometry changes, map encoding is limited to roughly 30 Hz while positioning continues on each frame; large changes and final geometry are refreshed. Resize/intersection observers are shared, invisible replicas are hidden, and layout measurements are batched before writes. Drag input is coalesced, drag replicas stay aligned in the same paint, and paused/offscreen simulations have no playback timer or animation loop.

## Verification

Open `tests/performance.html` for a repeatable 414 or 1280 CSS pixel benchmark. It measures requestAnimationFrame intervals, scene measurements, map encodes, and SVG writes. These are local workload/cadence measurements, **not GPU raster time or a guarantee of device FPS**. Open `tests/regression.html` to exercise presets, alignment, gallery filters, playback, morphology, controls, notifications, weather, maps, dialogs, and exports at selected viewport sizes.

Reports and screenshots are saved in `tests/artifacts/`. Browser verification uses the Codex in-app browser; it does not claim separate Safari, Chrome, or Firefox runs. The player and weather are labeled simulations.
