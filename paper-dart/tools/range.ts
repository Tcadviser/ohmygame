/** Maximum glide range on a clear, endless room, for each fold grade. */
import { createRun, stepRun, trimInput } from "../src/game/flight.ts";
import type { Room } from "../src/game/rooms.ts";
import type { FoldGrade } from "../src/game/fold.ts";

const DT = 1 / 120;
const clearRoom: Room = {
  id: "clear",
  name: "clear",
  blurb: "",
  lengthM: 400,
  launchY: 2.7,
  ceilingM: 7.5,
  target: { x: 400, width: 1, topY: 0.6 },
  props: [],
  air: [],
  pickups: [],
  creaseBand: { centre: 0.8, half: 0.1 },
  threeStarScore: 0,
};

for (const grade of ["S", "A", "B", "C"] as FoldGrade[]) {
  let best = 0;
  let bestCfg = "";
  for (let angle = -8; angle <= 20; angle += 1) {
    for (let power = 0.75; power <= 1.1501; power += 0.05) {
      const run = createRun(clearRoom, angle, power, grade, 1);
      let t = 0;
      while (run.status === "flying" && t < 30) {
        stepRun(run, DT, trimInput(run.dart.speed, run.stats));
        t += DT;
      }
      if (run.distanceM > best) {
        best = run.distanceM;
        bestCfg = `${angle}deg p${power.toFixed(2)}`;
      }
    }
  }
  console.log(`grade ${grade}: max range ${best.toFixed(1)} m (${bestCfg})`);
}
