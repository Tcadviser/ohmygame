import Phaser from "phaser";
import { PALETTE } from "../game/palette.ts";
import type { PropKind } from "../game/rooms.ts";
import { circle, poly, rect, roundedRect, wavyEdge, type Pt } from "./paper.ts";

/**
 * Every prop is a paper cut-out drawn inside its collision box, centred on the
 * box, with the same navy outline and drop shadow as the rest of the world.
 */
export function drawProp(
  g: Phaser.GameObjects.Graphics,
  kind: PropKind,
  cx: number,
  cy: number,
  w: number,
  h: number,
  spinRad: number,
): void {
  g.save();
  g.translateCanvas(cx, cy);
  switch (kind) {
    case "fan":
      drawFan(g, w, h, spinRad);
      break;
    case "lamp":
      drawLamp(g, w, h);
      break;
    case "books":
      drawBooks(g, w, h);
      break;
    case "mug":
      drawMug(g, w, h);
      break;
    case "plant":
      drawPlant(g, w, h);
      break;
    case "banner":
      drawBanner(g, w, h);
      break;
    case "spot":
      drawSpot(g, w, h, spinRad);
      break;
  }
  g.restore();
}

function drawFan(g: Phaser.GameObjects.Graphics, w: number, h: number, spinRad: number): void {
  const r = Math.min(w, h * 0.78) * 0.5;
  const headY = -h * 0.5 + r + 4;
  // stand
  poly(g, [
    { x: -w * 0.06, y: headY + r * 0.7 },
    { x: w * 0.06, y: headY + r * 0.7 },
    { x: w * 0.12, y: h * 0.5 },
    { x: -w * 0.12, y: h * 0.5 },
  ], PALETTE.kraftDark);
  circle(g, 0, h * 0.5 - 3, w * 0.16, PALETTE.kraft);

  // blades
  g.save();
  g.translateCanvas(0, headY);
  for (let i = 0; i < 3; i += 1) {
    g.save();
    g.rotateCanvas(spinRad + (i * Math.PI * 2) / 3);
    const blade: Pt[] = [
      { x: 0, y: 0 },
      { x: r * 0.85, y: -r * 0.28 },
      { x: r * 0.7, y: r * 0.2 },
      { x: 0, y: 0 },
    ];
    poly(g, blade, i === 1 ? PALETTE.accent2 : PALETTE.paper2, 1, PALETTE.ink, 2);
    g.restore();
  }
  circle(g, 0, 0, r * 0.16, PALETTE.ink);
  g.restore();

  // guard rings
  g.lineStyle(2.5, PALETTE.ink, 0.8);
  g.strokeCircle(0, headY, r);
  g.lineStyle(2, PALETTE.ink, 0.45);
  g.strokeCircle(0, headY, r * 0.62);
  g.fillStyle(PALETTE.paper, 0.18);
  g.fillCircle(0, headY, r);
}

function drawLamp(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
  // base
  g.fillStyle(PALETTE.ink, 0.14);
  g.fillEllipse(0, h * 0.5 + 3, w * 0.7, h * 0.12);
  g.fillStyle(PALETTE.kraft, 1);
  g.fillEllipse(0, h * 0.5, w * 0.7, h * 0.13);
  g.lineStyle(2, PALETTE.ink, 0.8);
  g.strokeEllipse(0, h * 0.5, w * 0.7, h * 0.13);
  // arm
  g.lineStyle(w * 0.09, PALETTE.kraftDark, 1);
  g.beginPath();
  g.moveTo(0, h * 0.45);
  g.lineTo(w * 0.18, 0);
  g.lineTo(-w * 0.06, -h * 0.28);
  g.strokePath();
  // shade
  const shade: Pt[] = [
    { x: -w * 0.5, y: -h * 0.42 },
    { x: w * 0.24, y: -h * 0.5 },
    { x: w * 0.34, y: -h * 0.16 },
    { x: -w * 0.3, y: -h * 0.2 },
  ];
  poly(g, shade, PALETTE.accent, 1, PALETTE.ink, 2);
  // glow
  g.fillStyle(PALETTE.gold, 0.22);
  g.fillTriangle(-w * 0.28, -h * 0.18, w * 0.32, -h * 0.14, w * 0.02, h * 0.5);
}

function drawBooks(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
  const colors = [PALETTE.kraft, PALETTE.accent2, PALETTE.paper2, PALETTE.accent, PALETTE.kraftDark];
  const count = 5;
  const each = h / count;
  for (let i = 0; i < count; i += 1) {
    const inset = i % 2 === 0 ? w * 0.04 : w * 0.0;
    const y = h * 0.5 - each * (i + 1);
    roundedRect(g, -w * 0.5 + inset, y + 2, w - inset * 2, each - 3, 3, colors[i % colors.length]);
    g.fillStyle(PALETTE.paper, 0.9);
    g.fillRect(w * 0.5 - inset - 6, y + 5, 4, each - 9);
  }
}

function drawMug(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
  const bodyTop = -h * 0.2;
  const body: Pt[] = [
    { x: -w * 0.32, y: bodyTop },
    { x: w * 0.32, y: bodyTop },
    { x: w * 0.26, y: h * 0.42 },
    { x: -w * 0.26, y: h * 0.42 },
  ];
  poly(g, body, PALETTE.paper, 1, PALETTE.ink, 2);
  g.fillStyle(PALETTE.accent, 1);
  g.fillRect(-w * 0.3, h * 0.1, w * 0.6, h * 0.1);
  g.lineStyle(2, PALETTE.ink, 0.8);
  g.strokeRect(-w * 0.3, h * 0.1, w * 0.6, h * 0.1);
  // handle
  g.lineStyle(w * 0.1, PALETTE.paper, 1);
  g.beginPath();
  g.arc(w * 0.3, h * 0.08, w * 0.22, -Math.PI * 0.6, Math.PI * 0.6);
  g.strokePath();
  g.lineStyle(1.5, PALETTE.ink, 0.6);
  g.beginPath();
  g.arc(w * 0.3, h * 0.08, w * 0.22, -Math.PI * 0.6, Math.PI * 0.6);
  g.strokePath();
  // steam
  g.lineStyle(2, PALETTE.inkSoft, 0.5);
  for (let i = 0; i < 2; i += 1) {
    const x = (i === 0 ? -1 : 1) * w * 0.1;
    g.beginPath();
    g.moveTo(x, bodyTop - 4);
    g.lineTo(x + w * 0.08, bodyTop - h * 0.16);
    g.lineTo(x - w * 0.06, bodyTop - h * 0.28);
    g.strokePath();
  }
}

function drawPlant(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
  const potTop = h * 0.16;
  poly(g, [
    { x: -w * 0.3, y: potTop },
    { x: w * 0.3, y: potTop },
    { x: w * 0.2, y: h * 0.5 },
    { x: -w * 0.2, y: h * 0.5 },
  ], PALETTE.kraft, 1, PALETTE.ink, 2);
  g.fillStyle(PALETTE.kraftDark, 1);
  g.fillRect(-w * 0.32, potTop - h * 0.05, w * 0.64, h * 0.06);
  g.lineStyle(2, PALETTE.ink, 0.8);
  g.strokeRect(-w * 0.32, potTop - h * 0.05, w * 0.64, h * 0.06);
  const leaves: Array<[number, number, number]> = [
    [-0.22, -0.34, -0.42],
    [0.0, -0.46, 0.0],
    [0.24, -0.3, 0.4],
  ];
  leaves.forEach(([dx, dy, bend], i) => {
    const base: Pt = { x: dx * w * 0.3, y: potTop };
    const tip: Pt = { x: dx * w, y: h * (dy + 0.5) };
    const mid: Pt = { x: (base.x + tip.x) / 2 + bend * w * 0.2, y: (base.y + tip.y) / 2 };
    poly(g, [base, mid, tip, { x: mid.x + w * 0.12, y: mid.y + h * 0.02 }],
      i === 1 ? PALETTE.accent2 : 0x3f8f7f, 1, PALETTE.ink, 2);
  });
}

function drawBanner(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
  const top = -h * 0.5;
  rect(g, -w * 0.75, top - 6, w * 1.5, 8, PALETTE.kraftDark);
  const cloth: Pt[] = [
    { x: -w * 0.5, y: top },
    { x: w * 0.5, y: top },
    ...wavyEdge({ x: w * 0.5, y: top + h * 0.92 }, { x: -w * 0.5, y: top + h * 0.92 }, h * 0.03, 2),
  ];
  poly(g, cloth, PALETTE.accent, 1, PALETTE.ink, 2);
  g.fillStyle(PALETTE.paper, 0.85);
  g.fillRect(-w * 0.5, top + h * 0.3, w, h * 0.08);
  g.lineStyle(2, PALETTE.ink, 0.6);
  g.strokeRect(-w * 0.5, top + h * 0.3, w, h * 0.08);
}

function drawSpot(g: Phaser.GameObjects.Graphics, w: number, h: number, spinRad: number): void {
  const cone: Pt[] = [
    { x: -w * 0.16, y: -h * 0.4 },
    { x: w * 0.16, y: -h * 0.4 },
    { x: w * 0.72, y: h * 0.5 },
    { x: -w * 0.72, y: h * 0.5 },
  ];
  g.fillStyle(PALETTE.gold, 0.2);
  g.fillPoints(cone, true);
  g.save();
  g.translateCanvas(0, -h * 0.42);
  g.rotateCanvas(Math.sin(spinRad) * 0.08);
  roundedRect(g, -w * 0.3, -h * 0.12, w * 0.6, h * 0.24, 6, PALETTE.inkSoft);
  circle(g, 0, h * 0.1, w * 0.14, PALETTE.gold);
  g.restore();
}
