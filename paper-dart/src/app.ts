import Phaser from "phaser";
import type { FoldGrade, FoldQuality } from "./game/fold.ts";
import type { RunState } from "./game/flight.ts";
import type { RunResult } from "./game/score.ts";
import { ROOMS } from "./game/rooms.ts";

export interface Session {
  roomId: string;
  grade: FoldGrade;
  qualities: FoldQuality[];
  seed: number;
  launchAngle: number;
  power: number;
  run: RunState | null;
  result: RunResult | null;
}

export const session: Session = {
  roomId: ROOMS[0].id,
  grade: "B",
  qualities: [],
  seed: 1,
  launchAngle: 12,
  power: 1,
  run: null,
  result: null,
};

export const bus = new Phaser.Events.EventEmitter();

export const EV = {
  foldStep: "fold:step",
  foldProgress: "fold:progress",
  foldPrompt: "fold:prompt",
  foldStamp: "fold:stamp",
  foldDone: "fold:done",
  foldReady: "fold:ready",
  flightHud: "flight:hud",
  flightPhase: "flight:phase",
  runEnd: "run:end",
  toast: "ui:toast",
} as const;

export interface FlightHud {
  phase: "aim" | "fly" | "end";
  distance: number;
  goal: number;
  score: number;
  clips: number;
  stars: number;
  speed: number;
  pitch: number;
  power: number;
  state: string;
}

export const SCENES = {
  boot: "Boot",
  menu: "Menu",
  fold: "Fold",
  flight: "Flight",
} as const;
