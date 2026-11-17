/**
 * Headless tuning check for the dart physics: runs scripted flights through every
 * room so the numbers in src/game can be judged without a browser.
 *   npx tsx tools/simcheck.ts
 */
import { createRun, stepRun, trimInput, type RunState } from "../src/game/flight.ts";
import { ROOMS, type Room } from "../src/game/rooms.ts";
import type { FoldGrade } from "../src/game/fold.ts";
import { autopilot } from "./autopilot.ts";

const DT = 1 / 120;
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** A plain "hold the trim" throw, for the baseline distance of each grade. */
function levelRun(room: Room, grade: FoldGrade, angle: number, power: number, seed: number) {
  const run = createRun(room, angle, power, grade, seed);
  let t = 0;
  while (run.status === "flying" && t < 30) {
    stepRun(run, DT, trimInput(run.dart.speed, run.stats));
    t += DT;
  }
  return run;
}

interface Tuning {
  slow: number;
  flare: number;
  approach: number;
  ceiling: number;
}

/**
 * A family of player styles: trim the glide, dive when the paper gets slow,
 * flare near the floor, and drop the nose to land once the basket is close.
 */
function tunedRun(
  room: Room,
  grade: FoldGrade,
  angle: number,
  power: number,
  seed: number,
  tune: Tuning,
) {
  const run = createRun(room, angle, power, grade, seed);
  let t = 0;
  while (run.status === "flying" && t < 30) {
    const d = run.dart;
    const trim = trimInput(d.speed, run.stats);
    let pitch = trim;
    const remaining = room.target.x - d.x;
    if (d.speed < tune.slow) pitch = trim - 0.45;
    if (d.angle > 14) pitch = Math.min(pitch, trim - 0.3);
    if (d.angle > 24) pitch = Math.min(pitch, trim - 0.6);
    if (d.y < tune.flare && d.speed > 6) pitch = trim + 0.4;
    if (d.y > room.ceilingM - tune.ceiling) pitch = Math.min(pitch, trim - 0.3);
    if (remaining < tune.approach && d.y > room.target.topY + 0.3) pitch = trim - 0.5;
    stepRun(run, DT, clamp(pitch, -1, 1));
    t += DT;
  }
  return run;
}

const TUNINGS: Tuning[] = [];
for (const slow of [4.5, 5.5, 6.5]) {
  for (const flare of [0.5, 0.9, 1.4]) {
    for (const approach of [2, 5, 9, 16]) {
      for (const ceiling of [0.4, 0.9]) {
        TUNINGS.push({ slow, flare, approach, ceiling });
      }
    }
  }
}

function sweep(room: Room, grade: FoldGrade, policy: "trim" | "tuned" | "auto") {
  let bestRun: RunState | null = null;
  let cfg = "";
  for (let angle = -6; angle <= 22; angle += 2) {
    for (let power = 0.75; power <= 1.1501; power += 0.1) {
      for (const seed of [1, 7, 13]) {
        const runs: RunState[] = [];
        if (policy === "trim") runs.push(levelRun(room, grade, angle, power, seed));
        else if (policy === "auto") {
          const run = createRun(room, angle, power, grade, seed);
          let t = 0;
          while (run.status === "flying" && t < 30) {
            stepRun(run, DT, autopilot(run, room));
            t += DT;
          }
          runs.push(run);
        } else {
          for (const tune of TUNINGS) runs.push(tunedRun(room, grade, angle, power, seed, tune));
        }
        for (const run of runs) {
          if (!bestRun || run.distanceM > bestRun.distanceM) {
            bestRun = run;
            cfg = `${angle}deg p${power.toFixed(2)} seed${seed}`;
          }
          if (run.status === "cleared") {
            return { run, cfg: `${angle}deg p${power.toFixed(2)} seed${seed}`, cleared: true };
          }
        }
      }
    }
  }
  return { run: bestRun as RunState, cfg, cleared: false };
}

let failures = 0;
for (const room of ROOMS) {
  const s = sweep(room, "S", "tuned");
  const b = sweep(room, "B", "tuned");
  const trim = sweep(room, "S", "trim");
  if (!s.cleared) failures += 1;
  console.log(
    [
      room.id.padEnd(11),
      `len ${String(room.lengthM).padStart(3)}m`,
      s.cleared
        ? `CLEARED at ${s.run.distanceM.toFixed(1)}m (${s.cfg})`
        : `NOT CLEARED best ${s.run.distanceM.toFixed(1)}m (${s.cfg})`,
      `| grade B: ${b.run.distanceM.toFixed(1)}m ${b.run.status}`,
      `| plain trim glide: ${trim.run.distanceM.toFixed(1)}m ${trim.run.status}`,
    ].join(" "),
  );
}

console.log("\nGrade spread on room 1 (plain trim glide, 12 deg, full power):");
for (const grade of ["S", "A", "B", "C"] as FoldGrade[]) {
  const run = levelRun(ROOMS[0], grade, 12, 1, 3);
  console.log(`  ${grade}: ${run.distanceM.toFixed(1)} m in ${run.time.toFixed(1)} s -> ${run.status}`);
}

console.log("\nStall behaviour (very soft throw, room 1):");
const soft = createRun(ROOMS[0], 20, 0.72, "C", 5);
let stallSeen = false;
let t = 0;
while (soft.status === "flying" && t < 30) {
  stepRun(soft, DT, 0);
  if (soft.stallTime > 0.25) stallSeen = true;
  t += DT;
}
console.log(`  stalled=${stallSeen} distance=${soft.distanceM.toFixed(1)}m status=${soft.status}`);

console.log(failures === 0 ? "\nAll rooms clearable." : `\n${failures} room(s) not clearable.`);
process.exit(failures === 0 ? 0 : 1);
