# openmock

Turn a screenshot or screen recording into a 3D device mockup, then export it.
Runs entirely in your browser. No account, no server, no upload, no paywall.

MIT licensed. Your projects live in IndexedDB on your own machine.

## Run it

```bash
npm install
npm run dev
```

Then drop a screenshot on the Source panel.

## Status

A full editor: compose a shot, animate it, export a picture or a video.

**Input** — drop, click, or paste a screenshot or screen recording anywhere.

**Devices** — iPhone, MacBook Pro, and a browser window, each with finishes.
Procedural stand-ins ship in the box so it works with no model files at all.

**Scene** — five lighting rigs built from area lights, no HDR downloads, works
offline. Scene presets, twelve curated gradients, custom colours, images with
blur, transparency, contact shadow, and screen light spill.

**Camera** — orbit, pan, dolly, field of view, zoom. All of it stored as data,
so all of it can be animated.

**Timeline** — multiple shots with duplicate, reorder, and per-shot duration.
Scrub, play, loop. Keyframes on lighting, blur, glow, field of view, zoom,
camera position and target, and every effect.

**Motion** — Auto-Motion picks a move that suits the shot. Five canned moves
(push in, pull back, orbit, slow zoom, reveal) generate editable keyframes
anchored on the framing you set up. Record mode keyframes every edit; with it
off, reframing shifts the whole move instead of rewriting one end.

**Effects** — bloom, lens blur with focus control, vignette, grain, chromatic
aberration, and a real mirror floor.

**Text and logos** — headlines and logo images pinned to the frame, with enter
and exit animations on their own timing.

**Export** — PNG at any aspect and resolution with alpha, and video as MP4,
WebM, or transparent WebM at 30 or 60 fps, encoded with WebCodecs. Effects and
overlays render into the file exactly as the viewport shows them.

**Editor** — light and dark themes, undo and redo, reusable templates,
autosave to IndexedDB, keyboard shortcuts.

### Shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `←` `→` | Step one frame, hold `Shift` for one second |
| `Home` `End` | Jump to start or end |
| `R` | Toggle Record Keyframes |
| `⌘Z` / `⇧⌘Z` | Undo / redo |
| `⌘E` | Export |

## Adding real device models

The app ships with procedural placeholder geometry, so it works with an empty
`public/models/`. A real MacBook Pro model is included.

**From an OBJ** (what most model sites give you):

```bash
./scripts/obj-to-glb.sh ~/Downloads/whatever.obj macbook-pro-16
```

It converts, compresses with meshopt, and prints the model's materials. Set
`screenMesh` in `src/devices.ts` to a pattern matching the display, which is
matched against both mesh and material names. The display is usually the
material whose UVs span the full 0..1 range. If your screenshot lands mirrored
or upside down, fix it with the Flip Screen toggles in the Mockup panel rather
than editing the model.

`src/devices.test.ts` checks every shipped model: it reads the GLB and fails if
the screen pattern matches no material, or more than one.

To check a model actually renders, run the editor and then:

```bash
npm run shoot                 # or: npm run shoot -- "iPhone 17"
```

It drives headless Chrome, loads a test card with a known layout, orbits the
device, and reports how much of the card survives at each angle. Images land in
`.shots/`. A blank, hidden, or upside-down screen is obvious there in a way it
never is from a unit test.

Three things bite when importing models, and all are handled:

- Display quads are often wound backwards, so the screen material is
  double-sided. Otherwise the screen is culled and you see the lid's interior.
- Bezels sit within a hair of the display, in this model about 0.008 units. A
  depth bias alone loses that fight at glancing angles, so the display mesh is
  lifted a fixed distance along its outward normal instead.
- Screen UVs may run bottom-up. Check with `npm run shoot` and set `uv.flipY` in
  `src/devices.ts`, or use the Flip Screen toggles for a one-off.

**From a GLB:**

1. Download a **CC-BY** GLB. Vetted candidates are listed in
   [`public/models/ATTRIBUTION.md`](public/models/ATTRIBUTION.md).
2. Optimize it and list its meshes:
   ```bash
   ./scripts/prep-model.sh ~/Downloads/whatever.glb iphone-17-pro
   ```
3. Set `screenMesh` in `src/devices.ts` to a regex matching the display mesh the
   script printed. The app logs every mesh name to the console if nothing matches.
4. If the screenshot lands rotated or mirrored, flip it with the `uv` field on
   that same device entry rather than editing the model.
5. Add a row to `ATTRIBUTION.md`. CC-BY requires it.

Only CC-BY models get committed. Sketchfab "Free Standard" models cannot be
redistributed in a public repo, and Apple's design resources forbid 3D renders of
their products.

## Disclaimer

Device models are fan-made recreations. This project is not affiliated with or
endorsed by Apple, Google, or Samsung.
