# LiquidLens

A vanilla HTML/CSS/JavaScript playground with ten interactive glass experiments.

## Run

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173`. There is no build step or npm dependency.

## Refraction

`optics.js` exposes `LiquidGlass(element, scene, options)`. It generates a rounded-rectangle normal map for each lens size and corner radius, then displaces a synchronized replica of the decorative scene. The scene is filtered before clipping, so the bevel can sample pixels beyond its edge. Labels and controls remain outside the displacement layer.

- `strength`: displacement in CSS pixels.
- `blur`: frosting, separate from refraction.
- `dispersion`: red/blue separation.
- `enabled`: an exact scene comparison when false.
- `set(options)`, `refreshScene()`, `destroy()`.
- `LiquidGlass.invalidate(milliseconds)`: synchronize after position changes and transitions.

The engine samples an **explicit decorative scene**, not arbitrary page DOM or live video. Keep inputs and controls outside that scene; call `refreshScene()` after changing its content. Use translation for moving lenses. This avoids relying on SVG filters inside `backdrop-filter`. A filter map cache and intersection observers avoid regenerating maps on every pointer move or updating offscreen demos.

`examples/integration.html` is the working example assembled from the site's three code tabs. The previous `optical-map.png` is retained but is no longer required.

## Verification

Validated in the Codex in-app browser at 320, 390, 768, 1024 and 1440 CSS pixels, with no horizontal page overflow. Verified shape presets, refraction on/off, scene changes, keyboard movement, gallery filters, media simulation, capsule states, dispersion, toolbar selection, notifications, weather, map destinations, dialog dismissal/focus return, layer toggles and code tabs. JavaScript syntax, exported JavaScript syntax, unique IDs and internal anchors are checked separately.

The player and weather are explicitly labeled simulations. This verification does not claim a separate Safari/Firefox test run.
