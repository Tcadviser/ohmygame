/** Prints one autopilot flight so the tuning can be read frame by frame. */
import { createRun, stepRun } from "../src/game/flight.ts";
import { ROOMS } from "../src/game/rooms.ts";
import { autopilot } from "./autopilot.ts";

const room = ROOMS.find((r) => r.id === (process.argv[2] ?? "auditorium")) ?? ROOMS[3];
const angle = Number(process.argv[3] ?? 8);
const power = Number(process.argv[4] ?? 1);
const DT = 1 / 120;

const run = createRun(room, angle, power, "S", 1);
let t = 0;
let next = 0;
console.log(`room ${room.id} len ${room.lengthM} angle ${angle} power ${power}`);
while (run.status === "flying" && t < 30) {
  const pitch = autopilot(run, room);
  if (t >= next) {
    next += 0.3;
    console.log(
      `t=${t.toFixed(2)} x=${run.dart.x.toFixed(1)} y=${run.dart.y.toFixed(2)} v=${run.dart.speed.toFixed(1)} ` +
        `ang=${run.dart.angle.toFixed(1)} pitch=${pitch.toFixed(2)} zone=${run.airId ?? "-"}`,
    );
  }
  stepRun(run, DT, pitch);
  t += DT;
}
console.log(`END ${run.status} x=${run.dart.x.toFixed(1)} y=${run.dart.y.toFixed(2)} t=${t.toFixed(1)}`);
