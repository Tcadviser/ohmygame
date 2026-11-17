/**
 * Logic checks for the parts of the game that are pure TypeScript: the fold
 * grading, the run scoring, the unlock rules and the fold geometry.
 *   npx tsx tools/logiccheck.ts
 */
import {
  FOLD_STEPS,
  advanceFold,
  commitFold,
  gradeFromQualities,
  newFoldProgress,
  sheetPanels,
  type FoldQuality,
} from "../src/game/fold.ts";
import { createRun, stepRun, trimInput } from "../src/game/flight.ts";
import { ROOMS } from "../src/game/rooms.ts";
import { ProgressStore } from "../src/game/save.ts";
import { scoreRun } from "../src/game/score.ts";

let failures = 0;
const check = (name: string, ok: boolean, detail = ""): void => {
  if (!ok) failures += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const DT = 1 / 120;
const room = ROOMS[0];
const band = room.creaseBand;
const limit = 0.09;

// --- a careful fold: hold until the crease band, release inside it
const careful: FoldQuality[] = [];
for (let i = 0; i < FOLD_STEPS.length; i += 1) {
  let fp = newFoldProgress();
  while (fp.progress < band.centre) {
    fp = advanceFold(fp, DT, true, 0, limit, band);
  }
  fp = commitFold(fp, limit, band);
  careful.push(fp.quality ?? "rough");
}
check(
  "careful fold grades S or A",
  gradeFromQualities(careful) === "S" || gradeFromQualities(careful) === "A",
  `${careful.join(",")} -> ${gradeFromQualities(careful)}`,
);

// --- a sloppy fold: hold way past the band
const sloppy: FoldQuality[] = [];
for (let i = 0; i < FOLD_STEPS.length; i += 1) {
  let fp = newFoldProgress();
  while (fp.progress < 1.1) {
    fp = advanceFold(fp, DT, true, 0, limit, band);
  }
  fp = commitFold(fp, limit, band);
  sloppy.push(fp.quality ?? "rough");
}
check(
  "sloppy fold grades B or C",
  gradeFromQualities(sloppy) === "B" || gradeFromQualities(sloppy) === "C",
  `${sloppy.join(",")} -> ${gradeFromQualities(sloppy)}`,
);

// --- a fold that wanders off the line stalls
let stalled = newFoldProgress();
for (let i = 0; i < 120; i += 1) stalled = advanceFold(stalled, DT, true, limit * 3, limit, band);
check("an off-line crease stalls", stalled.progress === 0, `progress ${stalled.progress}`);

// --- fold geometry stays finite and inside the sheet for every step
let geometryOk = true;
for (let step = 0; step < FOLD_STEPS.length; step += 1) {
  for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
    for (const panel of sheetPanels(step, progress)) {
      for (const p of panel.poly) {
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) geometryOk = false;
        if (p.x < -0.7 || p.x > 1.7 || p.y < -0.7 || p.y > 2.1) geometryOk = false;
      }
    }
  }
}
check("fold panels stay inside the sheet", geometryOk);

// --- scoring
const run = createRun(room, 8, 1, "A", 1);
let t = 0;
while (run.status === "flying" && t < 30) {
  stepRun(run, DT, trimInput(run.dart.speed, run.stats));
  t += DT;
}
const result = scoreRun(run, "A", room);
const expected = Math.round(
  (run.distanceM * 10 +
    run.clips * 50 +
    run.stars * 150 +
    (run.landing === "basket" ? 500 : run.landing === "beside" ? 250 : 0)) *
    1.15,
);
check("score matches its parts", result.score === expected, `${result.score} vs ${expected}`);
check("a landed run is not cleared", !result.cleared || run.status === "cleared");
check("stars only come from a clear", result.cleared ? result.starCount >= 1 : result.starCount === 0);

// --- progress and unlocking
const store = new ProgressStore(null);
check("only the first room starts unlocked", store.isUnlocked("nook") && !store.isUnlocked("study"));
store.record("nook", { ...result, cleared: true, starCount: 2, score: 900 });
check("clearing a room unlocks the next", store.isUnlocked("study"));
const first = store.value.rooms["nook"];
store.record("nook", { ...result, cleared: false, score: 10, distanceM: 1 });
check("a worse run does not lower a record", store.value.rooms["nook"].bestScore === first.bestScore);
check("runs are counted", store.value.runs === 2);

// --- the dart always ends, and never hangs in the air
let hangOk = true;
for (const room2 of ROOMS) {
  for (const grade of ["S", "B", "C"] as const) {
    const r = createRun(room2, 12, 1, grade, 3);
    let time = 0;
    while (r.status === "flying" && time < 30) {
      stepRun(r, DT, 0.4);
      time += DT;
    }
    if (r.status === "flying") hangOk = false;
    if (!Number.isFinite(r.dart.x) || !Number.isFinite(r.dart.y)) hangOk = false;
  }
}
check("every run ends with a finite position", hangOk);

console.log(failures === 0 ? "\nAll logic checks passed." : `\n${failures} logic check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
