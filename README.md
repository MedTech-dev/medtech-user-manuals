# MedTech user manuals

Step-by-step user guides for every part of the MedTech platform, in English and Arabic, with annotated screenshots. The site is plain HTML, CSS and a little JavaScript — no framework, no build service — served by GitHub Pages straight from this repository.

| Guide | For | Page |
|---|---|---|
| Operator admin | Operator Admin and Super Admin (programme setup) | `en/operator.html` · `ar/operator.html` |
| Coordinator | Program Coordinator (case work) | `en/coordinator.html` · `ar/coordinator.html` |
| Doctor | Doctors and assistants | `en/doctor.html` · `ar/doctor.html` |
| Pharmacy | Pharmacists at the counter | `en/pharmacy.html` · `ar/pharmacy.html` |
| MedTech admin | MedTech System Admin | `en/admin.html` · `ar/admin.html` |
| Patient app | Patients (mobile app) | `en/patient-app.html` · `ar/patient-app.html` |

The root page sends visitors to `ar/` or `en/` by browser language. Each portal links to its own guide in the user's language.

## How it is built

```
content/<lang>/<manual>.md     the text you edit
shots/<lang>/<manual>/*.png    screenshots
shots/<lang>/<manual>/*.json   size + marker positions for each screenshot
tools/build.mjs                content + shots → en/*.html, ar/*.html, index.html
tools/capture/*.mjs            take the web-portal screenshots automatically
tools/place-markers.html       place markers by hand (patient app screenshots)
tools/list-shots.mjs           checklist of the screenshots a manual expects
assets/                        site CSS, JS, favicon
```

The generated `en/`, `ar/` and `index.html` are committed: GitHub Pages serves them as they are.

### Writing content

Each manual is one Markdown-like file per language:

```md
---
title: Pharmacy portal
short: Pharmacy            (name in the top menu)
portal: Pharmacy           (small label above the title)
lead: One sentence under the title.
audience: Who the guide is for.
device: phone              (optional: patient app slots are phone-shaped)
---

## A section            → sidebar entry
### A step              → indented sidebar entry

::shot counter-home | Caption under the picture.
1. Explains marker 1 on that screenshot.
2. Explains marker 2.

> [!note] A note.   > [!warn] Something important.   > [!tip] A tip.

| Tables | work |
|---|---|
```

The numbered lines straight after a `::shot` line are its callouts: line N describes marker N. Write **bold** for a label exactly as it reads on screen in that language. A shot with no screenshot yet shows a "Screenshot coming soon" placeholder.

Build and preview:

```bash
node tools/build.mjs
python -m http.server 5390
```

Then open http://localhost:5390.

## Web portal screenshots

Screenshots come from the portals running locally **in mock mode, with demonstration data only** — never from a deployed environment and never with real patients.

1. In a `medtech-frontend` checkout of `main` with dependencies installed, create `.env.local` at its root:
   ```
   VITE_API_MODE=mock
   VITE_ENABLE_MSW=true
   VITE_API_PROXY_TARGET=
   VITE_MOCK_LATENCY=0
   ```
2. Start the portal you need on its capture port:

   | Portal | Port | Command (from the checkout) |
   |---|---|---|
   | admin | 5380 | `pnpm --filter @medtech/admin exec vite --port 5380 --strictPort` |
   | operator | 5381 | `pnpm --filter @medtech/operator exec vite --port 5381 --strictPort` |
   | doctor | 5382 | `pnpm --filter @medtech/doctor exec vite --port 5382 --strictPort` |
   | pharmacy | 5383 | `pnpm --filter @medtech/pharmacy exec vite --port 5383 --strictPort` |

3. Capture (both languages, or `en` / `ar`):
   ```bash
   MEDTECH_FRONTEND=/path/to/medtech-frontend node tools/capture/pharmacy.mjs all
   ```
   The scripts use the checkout's own Playwright and its translation files, so the same script captures the English and the Arabic screens, and every marker is placed on the element it explains.
4. Review every shot with its markers in one image, then rebuild:
   ```bash
   MEDTECH_FRONTEND=/path/to/medtech-frontend node tools/capture/contact-sheet.mjs en pharmacy
   node tools/build.mjs
   ```

When a portal's screen changes, re-run its capture script. If a label was renamed, the script fails at that step and names the missing text — update the locator, and the manual text if the label changed.

## Patient app screenshots

The patient app is captured by hand on a phone.

1. List what is needed: `node tools/list-shots.mjs patient-app --missing`.
2. Save each screenshot as `shots/<lang>/patient-app/<name>.png` (English screens under `en`, Arabic under `ar`). Use a demo account — no real patient data.
3. Serve the repo (`python -m http.server 5390`) and open http://localhost:5390/tools/place-markers.html. Pick the language, manual and screenshot, click to drop the numbered markers in the order of the callouts shown, and **Download JSON**. Put the JSON next to the PNG.
4. `node tools/build.mjs`.

## Publishing

GitHub Pages: **Settings → Pages → Deploy from a branch → `main` / root**. Every push to `main` publishes within a minute; there is no Actions workflow. `.nojekyll` makes Pages serve the files exactly as they are.
