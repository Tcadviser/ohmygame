# Paper Dart — Main Design Document

*Fold it. Fling it. Land it in the basket on the far side of the room.*

## 1. Player Fantasy

You are a kid with one sheet of paper and a room that is much too quiet. You fold a
classic dart with your own hands, feel the crease snap, then send it sailing across the
room — over desk fans, past lamps, through the updraft from a heating vent — until it
drops neatly into the wastebasket on the far side.

The fantasy has two halves and the game keeps both: **the fold matters** (a crisp dart
glides; a sloppy one wanders and drops) and **the flight is a skill** (height and speed
trade against each other, exactly like a real paper plane).

## 2. Core Loop

1. **Fold** — 5 folding steps on a real sheet. Each step: press and hold to run the
   crease along the dashed line, keep the crease on the line, and release inside the
   green band. Grade per step → overall fold grade **S / A / B / C**, which sets the
   dart's aerodynamics.
2. **Launch** — hold to charge power (the needle sweeps), drag up/down or W/S to aim,
   then release to throw. A dotted arc previews where a trimmed glide would land.
3. **Fly** — the dart always moves forward. Raise the nose to climb and bleed speed;
   push it down to dive and gain speed. Catch updrafts, dodge props, grab paperclips and
   stickers.
4. **Land** — the run ends in the basket, beside it, on the floor, or on a prop.
   Distance, pickups, fold grade and the landing produce a score and 1–3 stars.
5. **Result** — best distance, best score and stars are saved per room; the next room
   unlocks on a clear.

**Success:** land in the basket (or right beside it) → room cleared, stars awarded.
**Failure:** hit a prop, or run out of paper and land short → the dart crumples, the run
ends, Retry is one tap away.

## 3. Rooms (progression)

| # | Room | Length | Target | Obstacles | Air | Teaches |
|---|------|--------|--------|-----------|-----|---------|
| 1 | Desk Nook | 24 m | wastebasket by the wall | a potted plant | one updraft | trim, launch angle, the vent |
| 2 | Study | 30 m | basket under the shelf | books, desk fan, lamp | updraft + cold draught | height budget, dodging |
| 3 | Classroom | 42 m | basket on the far shelf | books, mug, hanging mobile, plant | two updrafts + cold draught | route choice, energy management |
| 4 | Auditorium | 48 m | basket on the stage | two banners, spotlight, fan | three updrafts + cold draught | long-range vent hopping |

Rooms unlock in order. Each room keeps its own best distance, best score, stars and best
fold grade. The measured range of a dart on a clear, flat glide is roughly **39 m at
grade S, 27 m at grade B, 22 m at grade C** — so the later rooms can only be reached by
catching the vents, which is the intended lesson.

## 4. Controls

| Action | Pointer / touch | Keyboard |
|---|---|---|
| Fold: run the crease | press & hold with the finger on the dashed line | hold Space |
| Fold: commit the crease | lift the finger inside the green band | release Space |
| Launch: charge power | hold | hold Space |
| Launch: aim | drag up / down while charging | W / S or ↑ / ↓ |
| Launch: throw | release | release Space |
| Fly: pitch up | drag up | ↑ / W |
| Fly: pitch down | drag down | ↓ / S |
| Pause | Pause button | Esc / P |
| Retry / next | result buttons | Enter (retry) |
| Sound | Sound button | M |

One action map (`src/game/input.ts`) serves pointer, touch and keyboard.

## 5. Simulation Model

Owned by `src/game/` (no Phaser types); `src/scenes/` only adapts it to sprites and
cameras. All state is in metres and degrees, y is up, and the floor is y = 0.

- **Control is a torque, not a target angle.** The player's pitch input turns the nose
  at up to 44°/s (less when the paper is slow), while gravity pulls the nose down by
  `noseDrop` °/s. Holding about half deflection *trims* the glide; more climbs, less
  dives. There is no free level flight: energy is conserved.
- **Speed** follows `dv/dt = -sin(angle)·g - drag`, so a dive pays for speed and a climb
  spends it.
- **Drag polar:** `dragA·v² + dragB·cos²(angle)·liftFactor / v²`. The induced term is the
  price of holding the nose up, which is what stops a dart from hovering on the ceiling;
  `liftFactor` fades the induced term away below the stall speed, so a stalled dart can
  always rebuild speed in its mush.
- **Stall** below 4.1 m/s: the nose mushes down (capped at −26°) and drag rises. Under
  2.2 m/s the dart tumbles (about −55°) until it has airspeed again. Every run ends.
- **Air zones are moving air, not a push.** Inside a vent the air itself moves up (or
  down) at `lift` m/s, and the dart's ground velocity is its air-relative velocity plus
  that air movement. Riding a vent therefore gains height *without* losing airspeed —
  the clean "catch the thermal" feel — and the dart stops rising exactly at the top of
  the band instead of being flung into the ceiling.
- **Fold grade** changes the drag polar, the nose drop and the wander:

| Grade | dragA | dragB | nose drop | wander | feel |
|---|---|---|---|---|---|
| S | 0.0086 | 56 | 25°/s | 0.9°/s | holds a line, longest glide |
| A | 0.011 | 60 | 28°/s | 1.4°/s | |
| B | 0.014 | 63 | 32°/s | 2.3°/s | baseline |
| C | 0.020 | 70 | 37°/s | 3.8°/s | wanders, drops quickly |

- **Pickups:** paperclip +50 (and 2 % steadiness each, up to 8 clips), sticker +150.
- **Distance** is shown in metres (120 px = 1 m). Score = `distance × 10 + clips × 50 +
  stickers × 150 + landing bonus (500 in the basket, 250 beside it)`, multiplied by the
  fold grade (S 1.3, A 1.15, B 1.0, C 0.85).
- **Stars:** 1 = cleared, +1 = three or more pickups, +1 = fold grade A or better.

## 6. Visual Direction

**Material language: papercraft diorama.** Everything in the world is card stock: flat
cut shapes, visible paper fibre, soft drop shadows, creased edges, and a faint blueprint
grid on the walls. The dart is the only object with a real crease highlight.

**Palette** (`src/theme.css` variables, mirrored in `src/game/palette.ts`):

| Token | Hex | Use |
|---|---|---|
| paper | `#F7F2E6` | sheets, panels, dart body |
| paper-2 | `#EADFC8` | panels, folded flaps |
| kraft | `#C08A4E` | wood, cardboard, furniture |
| ink | `#22303F` | outlines, text, blueprint lines |
| ink-soft | `#5A6B7C` | secondary text |
| accent | `#E4572E` | power, danger, cold draughts |
| accent-2 | `#2A9D8F` | updrafts, success, paperclips |
| gold | `#E9B949` | stars, score, sticker |

**Typography:** `Fredoka` (display, buttons) and `IBM Plex Mono` (distance, power,
score), both self-hosted through `@fontsource`.

**Motion:** springy paper. Flaps fold with a 260 ms ease, HUD numbers tick rather than
slide, and the title dart drifts across the room behind the menu.

## 7. HUD And Surfaces

- **In flight (DOM over the canvas):** distance tape with the room goal, score, pickup
  count, a semicircular pitch gauge, a speed bar, the power meter during aim, a pause
  button, and transient toasts.
- **Fold screen:** step counter (n/5), the dashed crease line with the green band, a live
  crease bead, per-step grade stamps, and a one-line prompt.
- **Menus:** title with an animated papercraft room behind it, room select cards (stars,
  best distance, best score, best grade), how-to-fold help, pause, and a result card with
  the score breakdown and the room's leaderboard when the game service has one.

## 8. Assets

### Art: procedural papercraft (no image model was connected)

No image-generation model was available in this environment, so the game draws its whole
look in code instead of shipping generated art. This is a deliberate, coherent substitute
rather than a placeholder set:

| Runtime art | Where it lives | What it is |
|---|---|---|
| Room backdrops ×4 | `src/render/backdrop.ts` | layered papercraft dioramas (windows and curtains, pinboards, shelves, chalkboard, posters, radiators, arched windows with light beams, stage curtain), blueprint grid, floor bands |
| Foreground parallax band | `src/render/backdrop.ts` | desk edges and floor boards that slide faster than the wall |
| Dart + crumpled ball | `src/render/dart.ts` | creased side-view dart with a far wing that flutters, and the crash ball |
| Props | `src/render/props.ts` | desk fan (spinning blades), lamp with a warm glow, book stack, mug with steam, potted plant, hanging banner, spotlight |
| Pickups, basket, air vents, trail, hand | `src/scenes/FlightScene.ts` | code-drawn clip/star, wavy-rimmed basket, animated vent streamers, paper trail |
| Sheet, flaps, crease lines | `src/scenes/FoldScene.ts` + `src/game/fold.ts` | the folding sheet is real geometry: five steps of panels mirroring across fold axes |
| Paper texture, panels, buttons | `src/render/paper.ts`, `src/theme.css` | procedural fibre texture for the paper, and paper-card CSS for every DOM surface |

The canvas keeps the production-art generation nodes with their prompts, dimensions and
shared style reference so the same list can be generated and swapped in when a provider
is connected. **None of those nodes has an image yet; nothing in the running game reads
from `assets/generated/`.**

### Audio: synthesised in the browser

No audio model was connected either, so `src/game/audio.ts` builds every sound with
WebAudio: a dry paper crease (filtered noise sweep plus a snap whose pitch follows the
fold grade), a launch whoosh, a flutter bed whose volume follows airspeed, pickup chimes,
a crumple crackle with a thud, a marimba-and-ukulele clear jingle, and a 90 bpm
generative loop (plucked chords, bass, shaker) for menus and flight. No audio files are
shipped. The canvas audio nodes hold the intended SFX/music prompts for a later pass.

## 9. Tech

- **Runtime:** Phaser 3 + TypeScript + Vite, `base: "./"`, static output in `dist/`.
- **State owner:** `src/game/` — pure TS (rooms, fold grading, dart physics, scoring,
  saves). `src/scenes/` adapts it to sprites, tweens and cameras.
- **Saves:** the OhMyGame SDK (`src/ohmygame/client.js`) — `game.storage` for unlocks,
  best distance/score/stars/grade, and `game.leaderboard` (`best-score-<roomId>`) when
  `game.leaderboard.available`. No custom localStorage.
- **Responsive:** renderer resizes to the iframe (`Scale.RESIZE`), the camera zoom fits
  the room height on wide screens and the playable width on phones, and the DOM overlay
  uses safe-area padding. No fixed-width layout and no horizontal overflow.
- **Test bridge (test-only):** `globalThis.__OHMYGAME_PLAYTEST__` exposes `snapshot()`,
  `reset()`, `setSeed(seed)`, `step(ms, pitch)`, `startRoom(id)` and `foldAuto()`.
  Normal gameplay never depends on it.

## 10. Verification

What was actually run (see `tools/`):

- `npx tsc --noEmit` — clean.
- `npx vite build` — clean; `dist/` contains `manifest.json` and relative asset URLs.
- `tools/logiccheck.ts` — fold grading (careful → S, sloppy → C, an off-line crease
  stalls), fold panel geometry stays finite for every step and progress value, score
  arithmetic, unlock rules, record keeping, and that every run terminates with a finite
  position.
- `tools/simcheck.ts` — sweeps launch angles, powers and 72 player-style tunings over
  every room and reports that all four rooms are clearable at grade S and B, with the
  grade spread and stall behaviour printed alongside.
- `tools/range.ts`, `tools/trace.ts` — the per-grade range table and frame-by-frame
  traces used to tune the drag polar, the stall recovery and the vents.

**Not verified:** no browser runtime was available in this environment (`game_use` is not
present), so the game has **not** been visually playtested. Rendering, the fold
animation, touch input, HUD legibility, resize behaviour and the save round-trip through
the local OhMyGame service are unverified and should be checked in the preview.
