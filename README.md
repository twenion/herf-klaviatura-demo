# HƏRF Ə75 — every letter its own key (animated concept)

In one century the Azerbaijani language changed its alphabet again and again: Arabic script until 1929, Latin
from 1929, Cyrillic from 1939, Latin again on 25 December 1991 — with **Ä** where the schwa should be — and on
16 May 1992 the **Ə** came back. HƏRF is a fictional keyboard maker; its Ə75 is a 75 % mechanical keyboard with
the Azerbaijani layout, and the Ə is the only key in colour. The sounds stayed, the letters changed: the page tells
that with the keyboard itself.

The site is animation-first. The keyboard stays in the middle of the screen; text appears as short lines at the
moments that need them.

## Scenes

| Scene | What happens |
| --- | --- |
| Opening | A low camera over a bare board: brass plate, 82 switches with red stems. The cobalt Ə falls onto its switch, the stem dips, a ring of light spreads, and the other 81 caps rain down around it, each bouncing on its spring. |
| Yaz | Type on your own keyboard (or tap the caps on a phone): the same physical key goes down 4 mm on screen, springs back, and the line appears above the board in Azerbaijani letters whatever your layout is. A demo line types itself until you do. |
| Makro | The camera dives to Ə, the cap rises above its neighbours, the camera goes round to its side and the cap is cut open: the walls, the stem socket, and the legend going through the plastic (double-shot). |
| İçi | One switch rises out of the board and comes apart: cap, top housing, stem, spring, bottom housing; a slow press of the bare parts runs along the force–travel curve of the chosen switch. Then the whole board separates into six layers: caps, switches, brass plate, PCB, foam, case. |
| Əlifba | Top view. A wave runs across the board and every letter key jumps, turns over and lands with the letter of the next alphabet — same sound, other letter — while the page changes its print colours. At the end only one key turns: Ä → Ə. |
| Al | Case colour and switch type change the board live; cart and checkout. |

## The alphabets on the keys

Each key keeps its sound. The letters come from the English Wikipedia article *Azerbaijani alphabet* (the table
"Azerbaijani alphabets, 1922–present" and the Arabic-script tables):

- **until 1929**, Arabic script (Noto Naskh Arabic), Persian digits;
- **1929**, the 1922–1933 Latin alphabet (Noto Sans: Ƣ on G, G on Ğ, Q on K, K on Q, Y on U, U on Ü, J on Y,
  Ƶ on J, Ɵ on Ö, Ɜ on Ş, Į on I — the I with descender has no code point and is drawn by hand);
- **1939**, the 1939–1958 Cyrillic alphabet (PT Mono: Ҹ Ч Э Ә Ҝ Ғ Һ Ы И Ж К Г Ө Ү Й…);
- **25 Dec 1991**, today's Latin layout with Ä on the Ə key;
- **16 May 1992**, Ə.

The Ə key is cobalt whenever its letter is a schwa (Ə, Ә), so it goes grey in the Arabic and 1991 steps.

## How it is built

- Static HTML + CSS + vanilla JS modules. No framework, no CDN, no build step.
- **Everything is generated in code** (`js/geo.js`): one primitive — a profile swept around a rounded
  rectangle — makes the keycaps (hollow 1.4 mm shell, tapered skirt, rounded top edge, cylindrical dish, stem
  socket), the case (diamond-cut chamfer, wedge bottom for a 6° typing angle), the switch housings, plate, PCB
  and foam; a helix makes the springs, a lathe the knurled knob.
- **Rendering** (`js/gl.js`, WebGL2): full device resolution with MSAA; keycaps instanced per width (82 caps in 7
  draw calls), switches instanced per part. Sculpted rows (height and top slope per row) are applied in the vertex
  shader. Studio lighting with soft boxes; metals see a darker studio so brass and aluminium keep their contrast.
  The scene is drawn front to back (caps, switches, plate, PCB, foam, case), so the depth test rejects hidden
  pixels before the costly shading; the board was fill-rate bound and this alone took a 1920 × 950 frame on
  integrated graphics from ~33 to ~25 ms.
- **Resolution policy:** sharpness first. The canvas renders at the device pixel ratio (up to 3) and keeps it at
  30 fps; only when two 50-frame windows in a row average over 40 ms does it give up 10 % of the scale (never below
  60 %), and it takes it back when the cost, scaled by pixel count, fits again. `?q=1` pins the scale for testing,
  `window.__herf` shows `{ q, avg, px }`.
- **Legends** (`js/atlas.js`): every legend of every alphabet is drawn once into a cell the shape of its cap top
  and converted to a signed distance field, so a 120-pixel cell is still sharp when one key fills the screen.
- **The cut** in the macro scene is done in the fragment shader: the cap is discarded past a plane, and where the
  view ray enters the solid the colour is computed at the cutting plane — plastic, or legend if the plane crosses
  the letter inside the top wall.
- **Motion** (`js/keys.js`): the opening is a function of time (so `?intro=0.4` freezes it), the alphabet wave a
  function of scroll; key presses use a spring with bottom-out and a small rebound at the top.
- **Sound** (`js/sound.js`): off by default; switched on, each press is synthesised (pitched body + filtered noise;
  a double click for the clicky switch, a light clack on release). No recordings.
- `js/shop.js`: case colour, switch type, cart drawer, checkout with validation. Cart in `localStorage`; nothing is
  sent.

## Run

```
python3 -m http.server 8744
```

then open `http://localhost:8744/`.

## Budget and checks (20 Nov 2026)

| | Measured | Budget |
| --- | --- | --- |
| HTML | 9.3 KB | < 60 KB |
| CSS + JS (uncompressed) | 133.6 KB (CSS 21.5, JS 112.1) | < 200 KB |
| First load, everything | 254 KB (fonts 110.6 KB) | < 1.5 MB |
| Frame, 1920 × 950 canvas, Intel UHD (laptop) | 24–30 ms at full resolution, spikes to ~45 in scene changes | — |

- Cart and checkout: 21 scripted checks pass (physical keys write Azerbaijani letters, case and switch radios with
  arrow keys, cart, quantities, validation, shipping, success, Escape, single Ə cap, persistence after reload).
- 360 px: no horizontal scroll at any scroll position. Console errors: 0.
- Every font and weight in use draws ə Ə ş ğ İ ı ö ü ç itself (checked by fallback test and by eye).
- `prefers-reduced-motion`: the opening is skipped and every scene sits still in its end state.
- Without JavaScript the pinned scenes become a plain reading column: every caption, era and part name is readable.

## Honest notes

- HƏRF, the Ə75, its specs, prices, phone number and e-mail are made up. The footer says so.
- The keyboard needs WebGL2. Without it the page still reads as a normal page.

Fonts: Unbounded, Onest, Noto Sans, PT Mono, Noto Naskh Arabic — SIL Open Font License (`fonts/OFL-*.txt`). The
legend fonts are subset to the letters the keys need.
