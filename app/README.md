# Gooey

An interactive pastel jelly keyboard. Just a passage, a keyboard, and Start / Stop.

## Play

- Press **Start**, or begin typing the passage. The clock begins with your first character.
- Type on your physical keyboard to press and release the 3D keys. Each press dents the crown, pushes out the sides, and sends a wave through neighboring keys and the gel bed.
- **Hold and drag a key** with a mouse or touch to pull, twist, and stretch it. Let go to watch it wobble back into shape. You can play before or after a typing session.
- Clicking an on-screen key during an active session types it. Dragging never enters text.
- Press **Stop** (or Escape) to finish. A single line shows WPM, accuracy, and elapsed time. Start begins a fresh session.
- Sounds are synthesized quietly in the browser. Your browser's normal tab mute control silences them.

## Open locally

Double-click **Open Gooey Typing.command** in the parent project folder, or run `npm start` here and visit http://127.0.0.1:4173. Node.js is required; there are no packages to install and no build step.

All source, fonts, and graphics work locally with no account, API key, analytics, or external asset downloads. This version does not store writing or session history.

## Rendering

The keys use smooth, welded pillow geometry, GPU vertex deformation, deformed surface normals, and independently damped spring channels for pressure, pull, sway, and torsion. Legends stretch with the surface. Physical transmission, studio reflection cards, internal bubbles, a deformable liquid bed, floor ripples, sticky filaments, and small release droplets complete the material.

Picking uses inexpensive deforming proxies, while the detailed surface runs on the GPU. Rendering rests between interactions, adapts resolution on slower devices, and pauses when hidden. Reduced-motion preferences disable the elastic effects. An HTML keyboard is available when WebGL cannot initialize.

## Scoring and input

WPM is current correct characters (including spaces) divided by five and elapsed minutes. Accuracy counts correct insertion attempts; correcting a mistake does not erase that historical attempt. The passage extends as you type, and sessions end only when stopped. Scores then freeze.

Native text input supports caret movement, selection, backspace, and composition. Paste, drop, replacement suggestions, and undo/redo are disabled so they cannot manufacture a typing score. Tab navigates the two buttons.

## Source

- `dist/keyboard.js` — scene, interaction, spring animation, and picking
- `dist/geometry.js` — pillow geometry, reflection environment, and printed legends
- `dist/softbody.js` — pure deformation, spring, and wave calculations
- `dist/deformation-shader.js` — GPU deformation and normal reconstruction
- `dist/liquid.js` — gel base, floor ripples, and droplets
- `dist/app.js` — typing and Start / Stop lifecycle
- `dist/engine.js` — scoring and session state
- `dist/audio.js` — procedural Web Audio squish and release sounds
- `dist/styles.css` / `dist/index.html` — minimal responsive interface
- `dist/vendor/` — Three.js 0.186.1 and license
- `server.mjs` — local server bound to loopback

`npm test` checks scoring, manual session completion, spring stability, anchoring, compression, and wave propagation. `npm run check` checks all application modules.

Optional browser WebMCP tools read the session or invoke the same Start / Stop actions. They cannot type text or fabricate scores.
