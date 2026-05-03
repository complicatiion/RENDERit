# RENDERit Documentation

RENDERit is an offline-capable browser viewport for fast product-style staging, realtime PBR-style material preview, local model import, scene arrangement and clean render export.

## Start
Run `start_RENDERit.bat` from the project root. The script starts a local Python server on port `8888` and opens the app at `http://localhost:8888`.

Alternative startup options:
- `server_RENDERit.bat` starts only the local server.
- `tools/local-server.js` can be used with Node.js if Python is unavailable.
- `BATCHLESS.md` describes manual startup without batch files.

## Navigation
- `Alt` + left mouse button: orbit
- `Alt` + middle mouse button: pan
- `Alt` + right mouse button: dolly
- Mouse wheel: quick zoom
- Click an object in the viewport or Object Manager to select it
- Double-click an object in the viewport to select it directly
- Use the top-right View Snap Grid for Top, Bottom, Left, Right, Front and Rear camera views
- `Ctrl + Z`: undo the last recorded scene edit
- `Ctrl + Y`: redo the next recorded scene edit

## Transform Tools
Use the center toolbar for object interaction modes:
- Select: normal picking mode
- Move: drag the selected object in screen space
- Rotate: drag to rotate the selected object
- Scale: drag to scale the selected object

Use the Object Transform card in the right Scene tab for exact position, rotation and scale values. Imported OBJ parts can be selected and transformed individually.

The Editor View also shows a selection HUD for the active object. The visible XYZ axis handles can be dragged for quick constrained movement along the X, Y or Z direction.

## History
The left sidebar contains a History card below Render Tools and above Status. It records recent scene edits and exposes both button-based and keyboard-based Undo / Redo.

History controls:
- `↶`: undo
- `↷`: redo
- `Ctrl + Z`: undo
- `Ctrl + Y`: redo
- click an entry to restore that saved state

The history list focuses on meaningful scene edits. Selection changes and normal camera navigation are not recorded so the list stays useful during look development.

## Ground Plane
The ground plane is a selectable internal scene item. It appears in the Object Manager and can receive material changes.

Ground Studio supports:
- ground color
- roughness and metalness
- reflection strength via the Scene tab
- local image texture loading
- texture repeat control

Local ground textures are applied directly in the WebGL2 shader for the ground plane.

## Model Import
Use `Import Model` for `.obj` or ASCII `.stl` files.

OBJ files are split into separate Object Manager entries when the source file contains renderable `o` or `g` groups. This helps with complex models where separate parts need individual material assignments and transforms.

## Materials
The left Library contains realtime material presets. Click a material to apply it to the selected object, or drag it onto the viewport.

Use Material Studio to:
- create a new material
- edit color, roughness, metalness, clearcoat, transmission and emission
- register PBR texture channel filenames
- delete custom materials
- export the material library as JSON

Supported PBR channel metadata:
- Albedo
- Normal
- Roughness
- Metalness
- Emissive

The built-in WebGL2 runtime uses scalar material parameters for mesh materials. Texture filenames are stored as project metadata for offline workflow tracking and future pipeline extension. Ground albedo textures are rendered directly.

## Environments
The Environment list contains HDRI-style gradient presets for neutral studio lighting, deep contrast and reflective product looks.

Use Environment Studio to:
- create custom environment presets
- edit top, horizon and ground colors
- adjust environment strength
- delete custom environments
- export environment presets as JSON

The Environment tab also includes quick color controls for fast look development.

## Camera Manager
The Camera tab provides:
- FOV
- camera distance
- pitch
- yaw
- Front, Back, Left, Right, Top and ISO view presets

Use `Frame Selected` for focused work and `Frame All Objects` for complete scene framing.

## Render Export
Use `Render Export` to create image output from the current scene.

Available options:
- current viewport or fixed output resolution
- common aspect ratios such as 16:9, 1:1, 4:5 and 3:2
- PNG or JPEG output
- JPEG quality control

## Project Save
`Save Project` exports a `.renderit.json` file containing scene objects, transforms, materials, environments, lights, camera, ground material and viewport settings.

## Folder Structure
- `index.html` — main interface
- `assets/css/renderit_main.css` — Lunar Neon UI theme
- `assets/js/render_core.js` — offline WebGL2 renderer and scene core
- `assets/js/material_manager.js` — materials, PBR metadata and environment presets
- `assets/js/ui_tabs.js` — tabs and markdown modals
- `assets/Documentation.md` — documentation loaded by the info button
- `assets/NOTES.md` — release notes loaded by the notes button
- `assets/img/` — logo, favicon and UI imagery
- `assets/models/` — local model samples
- `assets/hdr/` — local HDR/HDRI assets
- `assets/vendor/` — offline runtime assets and vendor placeholders
- `exports/` — suggested location for exported renders, projects and scene manifests
- `preview/` — preview images
- `tools/` — optional local server helper


## Performance Notes
V1.0.5 uses an on-demand render loop. Static scenes no longer redraw continuously while idle. Camera movement, transforms, selection changes, material edits, environment edits and exports still trigger immediate viewport updates.

The UI refresh path is throttled during active orbit, pan, zoom and transform operations so heavy side panels are not rebuilt on every pointer event.
