import Phaser from "phaser";
import { PALETTE } from "../game/palette.ts";
import type { Pt } from "./paper.ts";

const NOSE: Pt = { x: 0.5, y: 0 };
const TAIL_TOP: Pt = { x: -0.5, y: -0.1 };
const TAIL_BOTTOM: Pt = { x: -0.45, y: 0.1 };
const WING_TIP: Pt = { x: -0.32, y: -0.25 };

/**
 * The player's dart, seen from the side, nose pointing right. `angle` is degrees
 * of pitch; `flap` (-1..1) flexes the far wing as the paper flutters.
 */
export function drawDart(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  lengthPx: number,
  angleDeg: number,
  flap = 0,
): void {
  g.save();
  g.translateCanvas(cx, cy);
  g.rotateCanvas((angleDeg * Math.PI) / 180);
  g.scaleCanvas(lengthPx, lengthPx);
  const line = (2 / lengthPx) * 1;

  const wing: Pt[] = [
    NOSE,
    TAIL_TOP,
    { x: WING_TIP.x, y: WING_TIP.y + flap * 0.03 },
    { x: 0.1, y: -0.02 },
  ];
  const body: Pt[] = [NOSE, TAIL_BOTTOM, TAIL_TOP];
  const keel: Pt[] = [NOSE, TAIL_BOTTOM, { x: -0.46, y: 0.17 }];
  const highlight: Pt[] = [
    { x: 0.42, y: -0.02 },
    { x: -0.2, y: -0.06 },
    { x: 0.06, y: 0.0 },
  ];

  // soft paper shadow, offset downward
  g.fillStyle(PALETTE.ink, 0.14);
  g.fillPoints(
    [...body, ...wing].map((p) => ({ x: p.x + 0.02, y: p.y + 0.035 })),
    true,
  );

  g.fillStyle(PALETTE.paper3, 1);
  g.fillPoints(keel, true);

  g.fillStyle(PALETTE.paper2, 1);
  g.fillPoints(wing, true);

  g.fillStyle(PALETTE.paper, 1);
  g.fillPoints(body, true);

  g.fillStyle(0xffffff, 0.5);
  g.fillPoints(highlight, true);

  g.lineStyle(line, PALETTE.ink, 0.9);
  g.strokePoints(body, true);
  g.strokePoints(wing, true);
  g.strokePoints(keel, true);

  g.lineStyle(line * 0.7, PALETTE.ink, 0.35);
  g.lineBetween(NOSE.x, NOSE.y, TAIL_BOTTOM.x, TAIL_BOTTOM.y);
  g.restore();
}

/** A crumpled ball of paper for crashes and stalls. */
export function drawCrumple(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  radiusPx: number,
): void {
  const points: Pt[] = [];
  const count = 11;
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    const r = radiusPx * (0.78 + ((i * 37) % 11) / 40);
    points.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.92 });
  }
  g.save();
  g.translateCanvas(cx, cy);
  g.fillStyle(PALETTE.ink, 0.16);
  g.fillPoints(
    points.map((p) => ({ x: p.x + radiusPx * 0.12, y: p.y + radiusPx * 0.16 })),
    true,
  );
  g.fillStyle(PALETTE.paper, 1);
  g.fillPoints(points, true);
  g.lineStyle(2, PALETTE.ink, 0.85);
  g.strokePoints(points, true);
  g.lineStyle(1.5, PALETTE.inkSoft, 0.6);
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    g.lineBetween(0, 0, Math.cos(a) * radiusPx * 0.8, Math.sin(a) * radiusPx * 0.8);
  }
  g.fillStyle(PALETTE.paper2, 1);
  g.fillTriangle(-radiusPx * 0.5, -radiusPx * 0.2, 0, -radiusPx * 0.5, radiusPx * 0.2, -radiusPx * 0.1);
  g.restore();
}
