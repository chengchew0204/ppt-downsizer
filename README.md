# PPT Downsizer

A purely client-side web application that shrinks `.pptx` files by compressing
their embedded images. Everything runs in the browser — uploaded files never
leave the device.

## Features

- Drag-and-drop upload of `.pptx` files.
- Automatic extraction of every image under `ppt/media/` inside the archive.
- Premium dashboard with original size, estimated new size, and savings.
- Global compression ratio that can be applied to every image at once.
- Per-image sliders with debounced, live size estimation.
- Exports a new `.pptx` with the compressed media preserved inside the archive.

## Tech stack

- [Next.js](https://nextjs.org/) (App Router) with TypeScript.
- [Tailwind CSS](https://tailwindcss.com/) with a bespoke, shadcn/ui-inspired
  component layer (Button, Slider, Card) living in `src/components/ui/`.
- [lucide-react](https://lucide.dev/) for icons.
- [framer-motion](https://www.framer.com/motion/) for subtle animations.
- [jszip](https://stuk.github.io/jszip/) for reading and rebuilding the
  `.pptx` archive (a `.pptx` is a ZIP file).
- HTML5 Canvas API for image re-encoding (JPEG for photos, PNG when
  transparency is required).

## Getting started

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

To build for production:

```bash
npm run build    # builds both the Next.js site and the standalone HTML
npm run start
```

## Standalone single-file HTML

In addition to the Next.js site, the project ships a fully self-contained
HTML build that bundles all JavaScript and CSS inline. It is the same app,
runnable by double-clicking the file on any modern browser (no server, no
internet required).

- Built by Vite with `vite-plugin-singlefile` (`vite.config.ts`).
- Output written to `public/ppt-downsizer.html`, so the Next.js site serves
  it at [`/ppt-downsizer.html`](http://localhost:3000/ppt-downsizer.html).
- The live site shows a "Share as HTML" button that downloads this file.
- Rebuild just the standalone file with `npm run build:standalone`.

## Project structure

```
src/
  App.tsx                 Shared app shell (used by Next + Vite)
  app/
    layout.tsx            Next root layout + metadata
    page.tsx              Next entry, renders <App />
    globals.css           Tailwind v4 entry for Next
  components/
    Dashboard.tsx         Core dashboard (summary, controls, grid)
    Dropzone.tsx          Drag-and-drop upload surface
    GlobalControls.tsx    Global compression ratio panel
    ImageCard.tsx         Per-image tile with live estimate + slider
    ImageDetailModal.tsx  Click-to-zoom preview with quality slider
    ui/
      button.tsx          shadcn-style button primitive
      card.tsx            Card primitives
      slider.tsx          Accessible range slider
  lib/
    image-compression.ts  Canvas-based image compression
    pptx.ts               JSZip-based parse + rebuild helpers
    utils.ts              cn, formatBytes, mime helpers

standalone/
  index.html              Vite entry HTML for the standalone build
  main.tsx                Mounts <App /> into #root
  styles.css              Tailwind v4 entry for Vite (uses @source)

scripts/
  build-standalone.mjs    Runs vite build and copies the single HTML
                          file to public/ppt-downsizer.html
```

## How it works

1. The user drops a `.pptx` file onto the dropzone.
2. `loadPptx` reads it with JSZip and extracts every file under
   `ppt/media/` whose extension looks like an image.
3. Each image is turned into a `Blob` and an object URL for previewing.
4. Moving any slider schedules a debounced canvas-based re-encode. The
   resulting `Blob`'s size is used as the "estimated" size. If compression
   ends up larger than the original (rare, but possible on already-optimized
   images), the original blob is kept.
5. On download, the original `JSZip` tree is cloned into a new archive with
   the media entries replaced by the compressed blobs. The archive is saved
   as `<original>_downsized.pptx`.
