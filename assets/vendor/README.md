# Offline Vendor Runtime Assets

This folder contains local runtime assets for offline use.

## Bootstrap

`assets/vendor/bootstrap/` contains a minimal local CSS utility subset and a placeholder JavaScript bundle. RENDERit V5 does not require dynamic Bootstrap components.

## Three.js

`assets/vendor/three/` is reserved for the future full Three.js runtime path. For a production Three.js branch, place official local modules here, for example:

- `build/three.module.js`
- `examples/jsm/controls/OrbitControls.js`
- `examples/jsm/loaders/OBJLoader.js`
- `examples/jsm/loaders/STLLoader.js`
- `examples/jsm/loaders/RGBELoader.js`
- `examples/jsm/loaders/EXRLoader.js`
- `examples/jsm/postprocessing/EffectComposer.js`

Keep upstream license files in `assets/vendor/licenses/`.

## Licenses

Every external component added to this folder must keep its original license notice.


