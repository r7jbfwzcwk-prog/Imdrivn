# IMDRIVN burnout celebration

Web-ready assets and a reusable vanilla JS module for the Post ad button celebration.

Approved choreography: 3.5 seconds, plays once. Lane colours: Daily `#2F7BFF`, 4x4 forest `#1F5A32`, Performance `#E5242B`, Supercar `#D9A441`.

This branch only stages `assets/burnout/`. It is not wired into the live page and must not be merged to `main` until the site hook-up is reviewed.

## Usage

```html
<script src="assets/burnout/burnout.js"></script>
```

```js
playBurnout(lane, postButtonEl, function () {
  // Overlay is gone; the button already reads "You're live!".
  // Continue the post / navigate here.
});
```

Or as a CommonJS module:

```js
const { playBurnout } = require('./assets/burnout/burnout.js');
```

### `playBurnout(lane, buttonEl, onDone)`

| Arg | Notes |
| --- | --- |
| `lane` | `'daily'`, `'4x4'`, `'performance'`, or `'supercar'`. Any other value falls back to `'daily'`. |
| `buttonEl` | The Post button to morph. The overlay is positioned from this element's box (road sits just above it; the car crosses at its horizontal centre). |
| `onDone` | Called once after the 3.5s play (or the short reduced-motion morph), once the overlay has been removed. |

Returns a `cancel()` function. A second `playBurnout` call cancels the first; the previous `onDone` still runs so callers are not left hanging. `playBurnout.cancel()` cancels the active run.

Optional: `playBurnout.setAssetBase('https://example/assets/burnout/')` if the script is bundled and its `src` cannot be inferred. Asset URLs otherwise come from the `burnout.js` script `src` (same folder, plus `{lane}/…`).

## Behaviour

- Full-width `position: fixed` overlay, `pointer-events: none`, `z-index: 9999`.
- Same 3.5s timeline as the approved previews: ~0.3s idle, enter, ~2.6s burnout, ~0.6s launch; button morphs to a tick + "You're live!" from 2920ms.
- Plays once (no loop). Overlay is removed on finish; the live label stays on the button.
- `prefers-reduced-motion: reduce` skips the car and still morphs the button in ~240ms, then calls `onDone`.
- 4x4 is AWD: all visible wheels spin, smoke/dust/skids from both axles, milder squat.
- Smoke, dust, and sparks are generated in code (no sprite sheets shipped).

## Assets

Per lane, under `assets/burnout/{lane}/`:

- `body.webp` — coloured body cutout (~800px wide, wheel holes punched)
- `wheel-front.webp` / `wheel-front-blur.webp` / `wheel-front-hot.webp`
- `wheel-rear.webp` / `wheel-rear-blur.webp` / `wheel-rear-hot.webp`
- `meta.json` — layout in body-export pixels (`lanes.json` is the same map for all four)

4x4 far-side wheels reuse the near-side sprites, scaled and slightly darkened in the module. Target size is under 300KB of WebP per lane.
