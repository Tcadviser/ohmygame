import type { FoldGrade } from "./fold.ts";
import { GRADE_MULTIPLIER } from "./fold.ts";
import type { RunState, RunStatus } from "./flight.ts";
import type { Room } from "./rooms.ts";

export interface RunResult {
  roomId: string;
  status: RunStatus;
  cleared: boolean;
  distanceM: number;
  clips: number;
  stars: number;
  foldGrade: FoldGrade;
  score: number;
  starCount: number;
}

export const CLIP_POINTS = 50;
export const STAR_POINTS = 150;
export const LANDING_BONUS = 500;
export const BESIDE_BONUS = 250;

export function scoreRun(run: RunState, grade: FoldGrade, room: Room): RunResult {
  const cleared = run.status === "cleared";
  const raw =
    run.distanceM * 10 +
    run.clips * CLIP_POINTS +
    run.stars * STAR_POINTS +
    (run.landing === "basket" ? LANDING_BONUS : run.landing === "beside" ? BESIDE_BONUS : 0);
  const score = Math.round(raw * GRADE_MULTIPLIER[grade]);

  let starCount = 0;
  if (cleared) {
    starCount = 1;
    if (run.clips + run.stars >= 3) starCount += 1;
    if (grade === "A" || grade === "S") starCount += 1;
  }
  return {
    roomId: room.id,
    status: run.status,
    cleared,
    distanceM: Math.round(run.distanceM * 10) / 10,
    clips: run.clips,
    stars: run.stars,
    foldGrade: grade,
    score,
    starCount,
  };
}

export const resultHeadline = (result: RunResult): string => {
  if (result.cleared) return "In the basket!";
  if (result.status === "crashed") return "Ouch — crumpled";
  return "Short of the basket";
};

export const resultDetail = (result: RunResult): string => {
  if (result.cleared) return "Clean landing. That one counts.";
  if (result.status === "crashed") return "The paper lost that argument.";
  return "Steeper dives buy distance. Watch the speed.";
};
