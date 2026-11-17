import type { AirZone, Pickup, Prop, Room } from "./rooms.ts";
import type { FoldGrade } from "./fold.ts";

export interface DartStats {
  /** parasite drag, grows with speed squared */
  dragA: number;
  /** induced drag, grows as the glide flattens: the price of holding the nose up */
  dragB: number;
  /** how fast the nose drops, degrees per second */
  noseDrop: number;
  /** wander amplitude, degrees per second */
  sway: number;
}

export const FOLD_STATS: Record<FoldGrade, DartStats> = {
  S: { dragA: 0.0086, dragB: 56, noseDrop: 25, sway: 0.9 },
  A: { dragA: 0.011, dragB: 60, noseDrop: 28, sway: 1.4 },
  B: { dragA: 0.014, dragB: 63, noseDrop: 32, sway: 2.3 },
  C: { dragA: 0.02, dragB: 70, noseDrop: 37, sway: 3.8 },
};

export const GRAVITY = 9.8;
export const STALL_SPEED = 4.1;
/** degrees per second of pitch the player can command at full deflection */
export const CONTROL_RATE = 44;

/**
 * The control that holds the nose where it is. Above this the dart climbs,
 * below it the nose falls: the heart of the height-versus-speed trade.
 */
export function trimInput(speed: number, stats: DartStats): number {
  const speedFactor = clamp(speed / 9, 0, 1.3);
  const drop = stats.noseDrop * (1 - 0.5 * Math.min(speedFactor, 1.2));
  const authority = CONTROL_RATE * clamp(speed / 8, 0.3, 1.15);
  return clamp(drop / authority, 0, 1);
}

const LAUNCH_SPEED = 8.2;
const MAX_SPEED = 22;
const MAX_RUN_SECONDS = 30;
const DART_RADIUS_M = 0.18;
const PROP_FORGIVE_M = 0.12;

export interface DartState {
  x: number;
  y: number;
  speed: number;
  /** degrees, positive is nose up */
  angle: number;
}

export type RunStatus = "flying" | "cleared" | "landed" | "crashed";

export interface RunState {
  room: Room;
  stats: DartStats;
  dart: DartState;
  status: RunStatus;
  time: number;
  clips: number;
  stars: number;
  collected: string[];
  distanceM: number;
  crashPropId: string | null;
  /** how the run finished: cleanly in the basket, beside it, or not at all */
  landing: "basket" | "beside" | null;
  stallTime: number;
  airId: string | null;
  seed: number;
  power: number;
  launchAngle: number;
}

export type FlightEvent =
  | { type: "air"; zone: AirZone }
  | { type: "ceiling" }
  | { type: "pickup"; pickup: Pickup }
  | { type: "hit"; prop: Prop }
  | { type: "end"; status: RunStatus };

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export function createRun(
  room: Room,
  launchAngleDeg: number,
  power: number,
  grade: FoldGrade,
  seed = 1,
): RunState {
  return {
    room,
    stats: FOLD_STATS[grade],
    dart: {
      x: 0.6,
      y: room.launchY,
      speed: LAUNCH_SPEED * clamp(power, 0.7, 1.15),
      angle: clamp(launchAngleDeg, -10, 32),
    },
    status: "flying",
    time: 0,
    clips: 0,
    stars: 0,
    collected: [],
    distanceM: 0,
    crashPropId: null,
    landing: null,
    stallTime: 0,
    airId: null,
    seed,
    power,
    launchAngle: launchAngleDeg,
  };
}

/** Vertical acceleration from air zones at a point, plus the zone we are inside. */
function airAt(room: Room, x: number, y: number): AirZone | null {
  for (const zone of room.air) {
    const half = zone.width / 2;
    if (x >= zone.x - half && x <= zone.x + half && y >= zone.yMin && y <= zone.yMax) return zone;
  }
  return null;
}

function hitsProp(prop: Prop, x: number, y: number): boolean {
  // the hit box is a little tighter than the drawing, so near misses feel fair
  const w = Math.max(0.15, prop.w / 2 - PROP_FORGIVE_M);
  const h = Math.max(0.15, prop.h / 2 - PROP_FORGIVE_M);
  return Math.abs(x - prop.x) <= w + DART_RADIUS_M && Math.abs(y - prop.y) <= h + DART_RADIUS_M;
}

/** Advance one deterministic tick. Returns what the player should hear or see. */
export function stepRun(run: RunState, dt: number, pitchInput: number): FlightEvent[] {
  const events: FlightEvent[] = [];
  if (run.status !== "flying") return events;

  const s = run.dart;
  const stats = run.stats;
  const stability = 1 - 0.02 * run.clips;

  run.time += dt;

  // --- nose: the player's hand on the paper, gravity, and fold-quality wander
  const u = clamp(pitchInput, -1, 1);
  // control authority: paper only answers while it has airspeed
  const authority = CONTROL_RATE * clamp(s.speed / 8, 0.3, 1.15);
  s.angle += u * authority * dt;
  const speedFactor = clamp(s.speed / 9, 0, 1.3);
  s.angle -= stats.noseDrop * (1 - 0.5 * Math.min(speedFactor, 1.2)) * dt;
  run.stallTime = Math.max(0, run.stallTime - dt * 0.5);
  s.angle += stats.sway * stability * Math.sin(run.time * 3.7 + run.seed) * dt;
  s.angle = clamp(s.angle, -68, 68);

  // --- air zones: the air itself moves, so the dart rides it without losing airspeed
  const zone = airAt(run.room, s.x, s.y);
  if (zone) {
    if (run.airId !== zone.id) {
      run.airId = zone.id;
      events.push({ type: "air", zone });
    }
  } else if (run.airId !== null) {
    run.airId = null;
  }
  const airLift = zone ? zone.lift : 0;

  // --- speed: climbing costs, diving pays, drag always takes its cut
  s.speed -= Math.sin((s.angle * Math.PI) / 180) * GRAVITY * dt;
  const q = s.speed * s.speed;
  const cosA = Math.max(0.25, Math.cos((s.angle * Math.PI) / 180));
  // a stalled wing stops making lift, so its induced drag falls away with it
  const liftFactor = Math.min(1, q / (STALL_SPEED * STALL_SPEED));
  s.speed -=
    (stats.dragA * q + (stats.dragB * cosA * cosA * liftFactor) / Math.max(q, 6)) * dt;

  // --- stall: too slow and the paper mushes downward
  if (s.speed < STALL_SPEED) {
    // a stalled dart mushes down rather than diving: it keeps some energy
    const lack = 1 - s.speed / STALL_SPEED;
    s.angle = Math.max(-26, s.angle - lack * 60 * dt);
    s.speed = Math.max(0, s.speed - (0.5 + lack * 1.5) * dt);
    run.stallTime += dt;
  }
  // a dart with no airspeed tumbles down rather than hanging in the air
  if (s.speed < 2.2 && s.y > 0.1) s.angle = Math.min(s.angle, -55);
  s.speed = clamp(s.speed, 0, MAX_SPEED);

  // --- integrate
  const rad = (s.angle * Math.PI) / 180;
  s.x += Math.cos(rad) * s.speed * dt;
  s.y += (Math.sin(rad) * s.speed + airLift) * dt;
  run.distanceM = Math.max(0, s.x - 0.6);

  // --- ceiling: the dart slaps the plaster and loses its climb
  const ceiling = run.room.ceilingM - 0.12;
  if (s.y > ceiling) {
    s.y = ceiling;
    const horizontal = Math.cos((Math.max(s.angle, 0) * Math.PI) / 180) * s.speed;
    s.speed = Math.min(s.speed, horizontal) * 0.96;
    s.angle = Math.min(s.angle, -2);
    events.push({ type: "ceiling" });
  }

  // --- pickups
  for (const p of run.room.pickups) {
    if (run.collected.includes(p.id)) continue;
    if (Math.hypot(p.x - s.x, p.y - s.y) <= 0.55) {
      run.collected.push(p.id);
      if (p.kind === "clip") run.clips += 1;
      else run.stars += 1;
      events.push({ type: "pickup", pickup: p });
    }
  }

  // --- props
  for (const prop of run.room.props) {
    if (hitsProp(prop, s.x, s.y)) {
      run.status = "crashed";
      run.crashPropId = prop.id;
      events.push({ type: "hit", prop });
      events.push({ type: "end", status: "crashed" });
      return events;
    }
  }

  // --- the basket: into the mouth, or landing right beside it
  const basket = run.room.target;
  const dx = Math.abs(s.x - basket.x);
  if (dx <= basket.width * 0.7 && s.y <= basket.topY) {
    run.status = "cleared";
    run.landing = "basket";
    events.push({ type: "end", status: "cleared" });
    return events;
  }

  // --- floor and hard stops
  if (s.y <= 0) {
    s.y = 0;
    if (dx <= basket.width * 0.55) {
      run.status = "cleared";
      run.landing = "beside";
      events.push({ type: "end", status: "cleared" });
      return events;
    }
    run.status = "landed";
    events.push({ type: "end", status: "landed" });
    return events;
  }
  if (run.time >= MAX_RUN_SECONDS || (s.speed < 0.4 && s.y <= 0.05)) {
    run.status = "landed";
    events.push({ type: "end", status: "landed" });
  }
  return events;
}

/** How much of the room the dart has passed, 0..1. */
export const runProgress = (run: RunState): number =>
  clamp(run.dart.x / run.room.lengthM, 0, 1);
