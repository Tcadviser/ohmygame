/**
 * Folding phase: five steps of a classic dart, each graded from the crease
 * gesture. Pure data and pure functions so it can be tested headlessly.
 */

export type FoldGrade = "S" | "A" | "B" | "C";
export type FoldQuality = "perfect" | "good" | "rough";

export interface Vec2 {
  x: number;
  y: number;
}

/** Sheet space: x 0..1 (width), y 0..1.4 (length), origin top-left, y down. */
export const SHEET_W = 1;
export const SHEET_H = 1.4;

export interface FoldLine {
  a: Vec2;
  b: Vec2;
}

export type PanelId = "left" | "right" | "cornerTL" | "cornerTR" | "wingTop" | "wingBottom";

export interface FoldOp {
  /** panels that move with this operation */
  panels: PanelId[];
  /** axis the moving panels mirror across */
  axis: FoldLine;
  /** progress range of the step over which this operation runs */
  from: number;
  to: number;
  /** fold over and come back (a crease, not a fold) */
  unfold?: boolean;
}

export interface FoldStep {
  id: string;
  title: string;
  hint: string;
  /** the dashed guide the player drags along */
  line: FoldLine;
  ops: FoldOp[];
  /** step 5 narrows the folded body into the dart instead of folding a flap */
  narrow?: boolean;
  /** line length in sheet units, used to scale crease speed */
  length: number;
}

export const CENTRE: FoldLine = { a: { x: 0.5, y: 0 }, b: { x: 0.5, y: SHEET_H } };
const CORNER_L: FoldLine = { a: { x: 0.5, y: 0 }, b: { x: 0, y: 0.5 } };
const CORNER_R: FoldLine = { a: { x: 0.5, y: 0 }, b: { x: 1, y: 0.5 } };

export const FOLD_STEPS: FoldStep[] = [
  {
    id: "crease",
    title: "Crease the centre",
    hint: "Hold and drag down the middle",
    line: CENTRE,
    ops: [{ panels: ["right"], axis: CENTRE, from: 0.05, to: 0.95, unfold: true }],
    length: SHEET_H,
  },
  {
    id: "corner-left",
    title: "Corner to the middle",
    hint: "Fold the top-left corner onto the centre crease",
    line: CORNER_L,
    ops: [{ panels: ["cornerTL"], axis: CORNER_L, from: 0.1, to: 1 }],
    length: 0.7,
  },
  {
    id: "corner-right",
    title: "Mirror the corner",
    hint: "Fold the top-right corner onto the centre crease",
    line: CORNER_R,
    ops: [{ panels: ["cornerTR"], axis: CORNER_R, from: 0.1, to: 1 }],
    length: 0.7,
  },
  {
    id: "spine",
    title: "Fold the spine",
    hint: "Close the dart along the centre",
    line: CENTRE,
    ops: [{ panels: ["right"], axis: CENTRE, from: 0.05, to: 1 }],
    length: SHEET_H,
  },
  {
    id: "wings",
    title: "Set the wings",
    hint: "Hold until the wings meet the body",
    line: { a: { x: 0.5, y: 0 }, b: { x: 0.5, y: SHEET_H } },
    ops: [],
    narrow: true,
    length: SHEET_H,
  },
];

/** How long the crease takes to run the whole line, in seconds. */
export const CREASE_SECONDS = 1.15;

export interface FoldProgress {
  /** 0..1 along the guide line */
  progress: number;
  /** how far the pointer strayed from the guide, in sheet units */
  stray: number;
  quality: FoldQuality | null;
  /** signed offset of the resulting crease from the guide, sheet units */
  creaseOffset: number;
}

export const newFoldProgress = (): FoldProgress => ({
  progress: 0,
  stray: 0,
  quality: null,
  creaseOffset: 0,
});

export interface StepGeometry {
  centre: number;
  half: number;
}

/**
 * Advance one fold step. `stray` is the pointer's distance from the guide line
 * in sheet units (0 for keyboard), `strayLimit` the distance that still counts
 * as a clean crease. Progress only advances while the crease is on the line.
 */
export function advanceFold(
  fp: FoldProgress,
  dt: number,
  holding: boolean,
  stray: number,
  strayLimit: number,
  band: StepGeometry,
): FoldProgress {
  if (fp.quality !== null) return fp;
  const next: FoldProgress = { ...fp };
  if (!holding) return next;

  const onLine = stray <= strayLimit;
  next.stray = Math.max(fp.stray, stray);
  if (onLine) {
    next.progress = Math.min(1.14, fp.progress + dt / CREASE_SECONDS);
  }
  // keep a live read on where the crease is landing
  if (next.progress >= band.centre - band.half) {
    const miss = next.progress - band.centre;
    next.creaseOffset = Math.sign(miss) * Math.min(0.06, Math.abs(miss) * 0.18);
  }
  return next;
}

export function evaluateFold(
  fp: FoldProgress,
  strayLimit: number,
  band: StepGeometry,
): FoldQuality {
  const offBand = Math.abs(fp.progress - band.centre) / band.half;
  let quality: FoldQuality = offBand <= 0.42 ? "perfect" : offBand <= 0.85 ? "good" : "rough";
  const sloppiness = fp.stray / strayLimit;
  if (sloppiness > 1.6 && quality === "perfect") quality = "good";
  if (sloppiness > 2.6) quality = "rough";
  if (fp.progress < band.centre - band.half) quality = "rough";
  return quality;
}

export function commitFold(fp: FoldProgress, strayLimit: number, band: StepGeometry): FoldProgress {
  const quality = evaluateFold(fp, strayLimit, band);
  const offBand = (fp.progress - band.centre) / band.half;
  return {
    ...fp,
    quality,
    creaseOffset: Math.sign(offBand || 1) * Math.min(0.05, Math.abs(offBand) * 0.04),
  };
}

const QUALITY_POINTS: Record<FoldQuality, number> = { perfect: 2, good: 1, rough: 0 };

export function gradeFromQualities(qualities: FoldQuality[]): FoldGrade {
  const total = qualities.reduce((sum, q) => sum + QUALITY_POINTS[q], 0);
  const max = qualities.length * 2;
  const ratio = max === 0 ? 0 : total / max;
  if (ratio >= 0.9) return "S";
  if (ratio >= 0.7) return "A";
  if (ratio >= 0.45) return "B";
  return "C";
}

export const GRADE_MULTIPLIER: Record<FoldGrade, number> = { S: 1.3, A: 1.15, B: 1, C: 0.85 };

/** Reflect a point across the line through a and b. */
export function mirrorPoint(p: Vec2, line: FoldLine): Vec2 {
  const dx = line.b.x - line.a.x;
  const dy = line.b.y - line.a.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = ((p.x - line.a.x) * dx + (p.y - line.a.y) * dy) / len2;
  const projX = line.a.x + t * dx;
  const projY = line.a.y + t * dy;
  return { x: 2 * projX - p.x, y: 2 * projY - p.y };
}

export function foldAmount(step: FoldStep, progress: number): FoldOp[] {
  return step.ops.map((op) => {
    const span = op.to - op.from;
    let t = span <= 0 ? 1 : (progress - op.from) / span;
    t = Math.max(0, Math.min(1, t));
    if (op.unfold) {
      // 0 -> 1 -> 0 across the operation window
      t = 1 - Math.abs(t * 2 - 1);
    }
    return { ...op, from: t, to: t };
  });
}

export function applyOp(p: Vec2, op: FoldOp, t: number): Vec2 {
  const m = mirrorPoint(p, op.axis);
  return { x: p.x + (m.x - p.x) * t, y: p.y + (m.y - p.y) * t };
}

/** Panel polygons for the current step, with the step's transform applied. */
export interface SheetPanel {
  id: PanelId;
  poly: Vec2[];
  shade: "front" | "back" | "wing";
  visible: boolean;
}

const rect = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

export function sheetPanels(stepIndex: number, progress: number): SheetPanel[] {
  const step = FOLD_STEPS[stepIndex];
  const ops = foldAmount(step, progress);
  const moveT: Partial<Record<PanelId, number>> = {};
  for (const op of ops) {
    for (const id of op.panels) moveT[id] = op.to;
  }

  const build = (
    id: PanelId,
    poly: Vec2[],
    shade: SheetPanel["shade"],
    visible: boolean,
  ): SheetPanel => {
    const t = moveT[id] ?? 0;
    const op = ops.find((o) => o.panels.includes(id));
    const moved = op ? poly.map((p) => applyOp(p, op, t)) : poly;
    return { id, poly: moved, shade, visible };
  };

  const narrowT = step.narrow ? Math.max(0, Math.min(1, progress)) : 0;
  const narrow = (poly: Vec2[]): Vec2[] =>
    poly.map((p) => {
      const nx = 0.5 - (0.5 - p.x) * (1 - 0.42 * narrowT);
      const dir = p.y < 0.7 ? -1 : 1;
      const ny = p.y + dir * 0.05 * narrowT * Math.abs(p.y - 0.7) * 2;
      return { x: nx, y: ny };
    });

  const panels: SheetPanel[] = [
    build("left", rect(0, 0, 0.5, SHEET_H), "front", true),
    build("right", rect(0.5, 0, 1, SHEET_H), "front", true),
    build("cornerTL", [{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0, y: 0.5 }], "back", stepIndex >= 1),
    build("cornerTR", [{ x: 1, y: 0 }, { x: 0.5, y: 0 }, { x: 1, y: 0.5 }], "back", stepIndex >= 2),
  ];

  if (stepIndex >= 3) {
    const top = build("wingTop", rect(0, 0, 0.5, 0.7), "wing", true);
    const bottom = build("wingBottom", rect(0, 0.7, 0.5, SHEET_H), "wing", true);
    top.poly = narrow(top.poly);
    bottom.poly = narrow(bottom.poly);
    panels.push(top, bottom);
  }
  return panels;
}
