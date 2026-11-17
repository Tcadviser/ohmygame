import Phaser from "phaser";
import { PALETTE } from "../game/palette.ts";

export interface Pt {
  x: number;
  y: number;
}

export const PAPER_TEX = "paper-fibre";

/** A procedural sheet of card stock: fibres, speckles and a soft edge. */
export function ensurePaperTexture(scene: Phaser.Scene, size = 256): string {
  if (scene.textures.exists(PAPER_TEX)) return PAPER_TEX;
  const canvas = scene.textures.createCanvas(PAPER_TEX, size, size);
  if (!canvas) return PAPER_TEX;
  const ctx = canvas.getContext();
  ctx.fillStyle = "#fdfaf2";
  ctx.fillRect(0, 0, size, size);
  // fibres
  for (let i = 0; i < 900; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const len = 2 + Math.random() * 7;
    const angle = Math.random() * Math.PI;
    ctx.strokeStyle = `rgba(150,132,100,${0.02 + Math.random() * 0.05})`;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }
  // speckles
  for (let i = 0; i < 260; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle = `rgba(120,100,72,${0.02 + Math.random() * 0.07})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.5 + Math.random() * 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  canvas.refresh();
  return PAPER_TEX;
}

/** A soft paper shadow drawn behind a shape. */
export function paperShadow(
  g: Phaser.GameObjects.Graphics,
  points: Pt[],
  offset = 4,
  alpha = 0.16,
): void {
  g.fillStyle(PALETTE.ink, alpha);
  g.fillPoints(
    points.map((p) => ({ x: p.x + offset, y: p.y + offset })),
    true,
  );
}

export function poly(
  g: Phaser.GameObjects.Graphics,
  points: Pt[],
  fill: number,
  alpha = 1,
  stroke: number | null = PALETTE.ink,
  lineWidth = 2,
): void {
  g.fillStyle(fill, alpha);
  g.fillPoints(points, true);
  if (stroke !== null) {
    g.lineStyle(lineWidth, stroke, 0.85);
    g.strokePoints(points, true);
  }
}

export function rect(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number,
  alpha = 1,
  stroke: number | null = PALETTE.ink,
  lineWidth = 2,
): void {
  g.fillStyle(fill, alpha);
  g.fillRect(x, y, w, h);
  if (stroke !== null) {
    g.lineStyle(lineWidth, stroke, 0.85);
    g.strokeRect(x, y, w, h);
  }
}

export function roundedRect(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  fill: number,
  alpha = 1,
  stroke: number | null = PALETTE.ink,
  lineWidth = 2,
): void {
  g.fillStyle(fill, alpha);
  g.fillRoundedRect(x, y, w, h, radius);
  if (stroke !== null) {
    g.lineStyle(lineWidth, stroke, 0.85);
    g.strokeRoundedRect(x, y, w, h, radius);
  }
}

export function circle(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  r: number,
  fill: number,
  alpha = 1,
  stroke: number | null = PALETTE.ink,
  lineWidth = 2,
): void {
  g.fillStyle(fill, alpha);
  g.fillCircle(x, y, r);
  if (stroke !== null) {
    g.lineStyle(lineWidth, stroke, 0.85);
    g.strokeCircle(x, y, r);
  }
}

/** A paper cut-out edge: a wavy or torn run of points between two ends. */
export function wavyEdge(
  from: Pt,
  to: Pt,
  amplitude: number,
  waves: number,
  phase = 0,
): Pt[] {
  const points: Pt[] = [];
  const steps = Math.max(6, waves * 6);
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const base = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
    const nx = -(to.y - from.y);
    const ny = to.x - from.x;
    const len = Math.hypot(nx, ny) || 1;
    const wobble = Math.sin(t * Math.PI * 2 * waves + phase) * amplitude;
    points.push({ x: base.x + (nx / len) * wobble, y: base.y + (ny / len) * wobble });
  }
  return points;
}

/** A faint blueprint grid, the way graph paper looks on a wall. */
export function grid(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  step: number,
  color = PALETTE.ink,
  alpha = 0.05,
): void {
  g.lineStyle(1, color, alpha);
  for (let gx = x - (x % step); gx <= x + w; gx += step) {
    g.lineBetween(gx, y, gx, y + h);
  }
  for (let gy = y - (y % step); gy <= y + h; gy += step) {
    g.lineBetween(x, gy, x + w, gy);
  }
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;
