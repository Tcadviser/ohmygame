import { trimInput, type RunState } from "../src/game/flight.ts";
import type { Room } from "../src/game/rooms.ts";

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/**
 * What a good player does: trim a glide, take the lift from a vent without
 * letting the nose climb too far, keep enough airspeed, dodge props, and flare
 * before the floor. Used by tools/simcheck.ts to judge whether a room is fair.
 */
export function autopilot(run: RunState, room: Room): number {
  const d = run.dart;
  const trim = trimInput(d.speed, run.stats);
  let pitch = trim;

  const zone = room.air.find(
    (z) =>
      d.x >= z.x - z.width / 2 &&
      d.x <= z.x + z.width / 2 &&
      d.y >= z.yMin &&
      d.y <= z.yMax,
  );

  // a climb costs airspeed: ease the nose down as soon as it gets steep
  if (d.angle > 12) pitch = Math.min(pitch, trim - 0.1);
  if (d.angle > 22) pitch = Math.min(pitch, trim - 0.3);
  // too slow to fly: put the nose down
  if (d.speed < 6.4) pitch = Math.min(pitch, trim - 0.3);
  if (d.speed < 5.2) pitch = Math.min(pitch, trim - 0.6);
  // running out of room at the top or the bottom
  if (d.y > room.ceilingM - 0.5) pitch = Math.min(pitch, trim - 0.25);
  if (d.y < 0.8 && d.speed > 6) pitch = Math.max(pitch, trim + 0.35);
  if (zone?.kind === "up" && d.y < room.ceilingM - 1.2) pitch = Math.max(pitch, trim + 0.2);

  // props: pick the cheaper side, early enough to get there
  for (const prop of room.props) {
    const dx = prop.x - d.x;
    if (dx < 0.1 || dx > 3.2) continue;
    const under = prop.y - prop.h / 2;
    const top = prop.y + prop.h / 2;
    if (d.y > top + 0.45 || d.y < under - 0.45) continue;
    if (under > 1.3 && under - 0.6 < d.y) pitch = Math.min(pitch, trim - 0.35);
    else pitch = Math.max(pitch, trim + 0.45);
    break;
  }
  return clamp(pitch, -1, 1);
}
