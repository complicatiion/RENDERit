# RENDERit Notes

## V1.0.5 build
- Added a new left-panel History card below Render Tools and above Status.
- Added classic Undo and Redo buttons with left/right arrow styling.
- Added a compact History list that shows recent recorded scene states.
- History entries can be clicked to restore a specific state.
- Added keyboard shortcuts: `Ctrl + Z` for Undo and `Ctrl + Y` for Redo.
- Scene history records practical editing actions such as preset loading, imports, material changes, environment changes, object deletion, duplication, transform edits, axis moves, nudges, ground material changes and light additions.
- Camera navigation and selection-only changes are intentionally not recorded to keep the history list clean.
- Existing viewport behavior, object selection, transform tools, selection HUD, axis gizmo and view snap grid remain intact.

## Current runtime scope
- The default V1.0.5 runtime uses the built-in offline WebGL2 renderer.
- Official Three.js runtime files can still be placed in `assets/vendor/three/` for later pipeline replacement.
- Mesh PBR texture files are currently registered as material metadata in the offline project workflow.
- Ground albedo textures are rendered directly and are intended for studio floor previews.
- The selection HUD is an editor overlay and is intentionally not included in exported render images.

### © complicatiion aka sksdesign · 2026