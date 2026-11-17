import Phaser from "phaser";
import { PALETTE } from "../game/palette.ts";
import { DESIGN_H } from "../game/palette.ts";
import type { Room } from "../game/rooms.ts";
import { circle, grid, poly, rect, roundedRect, wavyEdge, type Pt } from "./paper.ts";

/**
 * Room backdrops are drawn as flat papercraft dioramas. Coordinates here are world
 * pixels with Y = 0 at the ceiling and Y = DESIGN_H at the floor.
 */

interface WallTint {
  wall: number;
  floor: number;
  accent: number;
}

const WALL_TINT: Record<string, WallTint> = {
  nook: { wall: 0xf6eeda, floor: 0xd9bd8e, accent: PALETTE.accent2 },
  study: { wall: 0xefe3ca, floor: 0xc9a97a, accent: PALETTE.accent },
  classroom: { wall: 0xf2ead6, floor: 0xd2b183, accent: 0x3f8f7f },
  auditorium: { wall: 0xe9dcc2, floor: 0xb98f5f, accent: 0x8c3b2a },
};

function windowWithCurtains(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
): void {
  rect(g, x - 10, y - 10, w + 20, h + 20, PALETTE.paper2);
  rect(g, x, y, w, h, PALETTE.glass);
  g.fillStyle(0xffffff, 0.5);
  g.fillTriangle(x + w * 0.1, y + h, x + w * 0.62, y, x + w * 0.9, y);
  g.lineStyle(2, PALETTE.ink, 0.7);
  g.lineBetween(x + w / 2, y, x + w / 2, y + h);
  g.lineBetween(x, y + h / 2, x + w, y + h / 2);
  // curtains
  const left: Pt[] = [
    { x: x - 26, y: y - 22 },
    { x: x + w * 0.3, y: y - 22 },
    ...wavyEdge({ x: x + w * 0.3, y: y + h + 16 }, { x: x - 26, y: y + h + 16 }, 7, 2),
    { x: x - 26, y: y + h + 16 },
  ];
  poly(g, left, accent, 0.95, PALETTE.ink, 2);
  const right: Pt[] = [
    { x: x + w * 0.7, y: y - 22 },
    { x: x + w + 26, y: y - 22 },
    { x: x + w + 26, y: y + h + 16 },
    ...wavyEdge({ x: x + w + 26, y: y + h + 16 }, { x: x + w * 0.7, y: y + h + 16 }, 7, 2, 1.4),
  ];
  poly(g, right, accent, 0.95, PALETTE.ink, 2);
}

function pinboard(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
  roundedRect(g, x, y, w, h, 8, PALETTE.kraft);
  g.lineStyle(2, PALETTE.kraftDark, 0.8);
  g.strokeRoundedRect(x + 8, y + 8, w - 16, h - 16, 6);
  const notes = 7;
  for (let i = 0; i < notes; i += 1) {
    const nx = x + 24 + ((i * 97) % (w - 80));
    const ny = y + 26 + ((i * 53) % (h - 90));
    const nw = 60 + ((i * 31) % 34);
    const nh = 48 + ((i * 17) % 26);
    g.save();
    g.translateCanvas(nx + nw / 2, ny + nh / 2);
    g.rotateCanvas((((i * 37) % 13) - 6) * 0.012);
    g.translateCanvas(-nw / 2, -nh / 2);
    rect(g, 0, 0, nw, nh, i % 3 === 0 ? PALETTE.gold : PALETTE.paper);
    g.fillStyle(PALETTE.accent, 0.9);
    g.fillCircle(nw / 2, 6, 4);
    g.lineStyle(2, PALETTE.inkSoft, 0.4);
    g.lineBetween(8, nh * 0.5, nw - 10, nh * 0.5);
    g.lineBetween(8, nh * 0.72, nw - 22, nh * 0.72);
    g.restore();
  }
}

function shelf(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
  rect(g, x, y, w, h, PALETTE.kraftDark);
  const rows = 3;
  const rowH = h / rows;
  for (let r = 0; r < rows; r += 1) {
    const ry = y + rowH * (r + 1) - 10;
    rect(g, x + 6, ry, w - 12, 10, PALETTE.kraft);
    let bx = x + 16;
    let i = 0;
    while (bx < x + w - 30) {
      const bw = 14 + ((i * 13 + r * 7) % 16);
      const bh = rowH - 34 - ((i * 5) % 12);
      const colors = [PALETTE.accent, PALETTE.accent2, PALETTE.paper, PALETTE.gold, PALETTE.kraft];
      rect(g, bx, ry - bh, bw, bh, colors[(i + r) % colors.length]);
      bx += bw + 4;
      i += 1;
    }
  }
}

function deskRow(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  tint: number = PALETTE.kraft,
): void {
  rect(g, x, y, w, 16, PALETTE.kraftDark);
  rect(g, x + 8, y + 16, w - 16, h - 16, tint);
  g.fillStyle(PALETTE.kraftDark, 0.35);
  g.fillRect(x + 8, y + 16, w - 16, 10);
  g.lineStyle(2, PALETTE.ink, 0.5);
  g.lineBetween(x + 24, y + 26, x + 24, y + h);
  g.lineBetween(x + w - 24, y + 26, x + w - 24, y + h);
}

function chair(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
  rect(g, x, y, w, 12, PALETTE.accent2);
  rect(g, x + 4, y - h * 0.55, w - 8, h * 0.55, PALETTE.accent2);
  g.lineStyle(2, PALETTE.ink, 0.55);
  g.lineBetween(x + 8, y + 12, x + 8, y + 26);
  g.lineBetween(x + w - 8, y + 12, x + w - 8, y + 26);
}

function chalkboard(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
  rect(g, x - 12, y - 12, w + 24, h + 24, PALETTE.kraft);
  rect(g, x, y, w, h, 0x2f4438);
  g.lineStyle(2.5, 0xf4f0e2, 0.7);
  g.lineBetween(x + 40, y + 70, x + w * 0.55, y + 70);
  g.lineBetween(x + 40, y + 110, x + w * 0.42, y + 110);
  g.strokeCircle(x + w * 0.72, y + 96, 42);
  g.lineBetween(x + w * 0.72 - 60, y + 96, x + w * 0.72 + 60, y + 96);
  g.lineBetween(x + w * 0.72, y + 36, x + w * 0.72, y + 156);
  g.lineStyle(2, 0xf4f0e2, 0.45);
  g.lineBetween(x + 40, y + h - 60, x + w * 0.7, y + h - 60);
}

function poster(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
  rect(g, x - 8, y - 8, w + 16, h + 16, PALETTE.paper);
  rect(g, x, y, w, h, 0xcfe0d6);
  g.fillStyle(PALETTE.accent2, 0.55);
  g.fillPoints(
    [
      { x: x + w * 0.1, y: y + h * 0.7 },
      { x: x + w * 0.3, y: y + h * 0.32 },
      { x: x + w * 0.48, y: y + h * 0.62 },
      { x: x + w * 0.68, y: y + h * 0.24 },
      { x: x + w * 0.92, y: y + h * 0.7 },
    ],
    true,
  );
  g.lineStyle(2, PALETTE.ink, 0.5);
  g.strokeRect(x, y, w, h);
}

function radiator(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
  rect(g, x, y, w, h, PALETTE.paper2);
  for (let i = 0; i < Math.floor(w / 22); i += 1) {
    rect(g, x + 10 + i * 22, y + 8, 12, h - 16, PALETTE.paper3, 1, null);
  }
  g.lineStyle(2, PALETTE.ink, 0.6);
  g.strokeRect(x, y, w, h);
}

function curtain(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
  const body: Pt[] = [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    ...wavyEdge({ x: x + w, y: y + h }, { x, y: y + h }, 16, 4),
  ];
  poly(g, body, 0x8c3b2a, 1, PALETTE.ink, 3);
  g.lineStyle(3, PALETTE.ink, 0.25);
  for (let i = 1; i < 5; i += 1) {
    g.lineBetween(x + (w / 5) * i, y + 10, x + (w / 5) * i, y + h - 20);
  }
}

function lightBeam(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
  g.fillStyle(0xfff3cf, 0.3);
  g.fillPoints(
    [
      { x, y },
      { x: x + w, y },
      { x: x + w + h * 0.5, y: y + h },
      { x: x + h * 0.5, y: y + h },
    ],
    true,
  );
}

function archWindow(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
  rect(g, x - 10, y - 10, w + 20, h + 20, PALETTE.paper2);
  g.fillStyle(PALETTE.glass, 1);
  g.fillRoundedRect(x, y, w, h, { tl: w / 2, tr: w / 2, bl: 0, br: 0 });
  g.lineStyle(2, PALETTE.ink, 0.6);
  g.strokeRoundedRect(x, y, w, h, { tl: w / 2, tr: w / 2, bl: 0, br: 0 });
  g.lineBetween(x + w / 2, y + 10, x + w / 2, y + h);
  g.lineBetween(x, y + h * 0.6, x + w, y + h * 0.6);
}

function mobile(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
  g.lineStyle(1.5, PALETTE.ink, 0.4);
  g.lineBetween(x, 0, x, y);
  g.lineBetween(x - w * 0.5, y + h * 0.3, x + w * 0.5, y + h * 0.3);
  circle(g, x - w * 0.5, y + h * 0.42, w * 0.13, PALETTE.accent);
  circle(g, x + w * 0.5, y + h * 0.42, w * 0.13, PALETTE.accent2);
  poly(
    g,
    [
      { x: x, y: y + h * 0.25 },
      { x: x + w * 0.22, y: y + h * 0.62 },
      { x: x - w * 0.22, y: y + h * 0.62 },
    ],
    PALETTE.gold,
  );
}

/** The whole room behind the gameplay, drawn once. */
export function drawBackdrop(
  g: Phaser.GameObjects.Graphics,
  room: Room,
  lengthPx: number,
): void {
  const tint = WALL_TINT[room.id] ?? WALL_TINT.nook;
  const top = -900;
  const bottom = DESIGN_H + 900;
  g.fillStyle(tint.wall, 1);
  g.fillRect(-400, top, lengthPx + 1600, bottom - top);
  grid(g, -400, top, lengthPx + 1600, bottom - top, 48, PALETTE.ink, 0.05);

  // ceiling and floor bands
  g.fillStyle(PALETTE.paper2, 1);
  g.fillRect(-400, -60, lengthPx + 1600, 60);
  g.lineStyle(3, PALETTE.ink, 0.35);
  g.lineBetween(-400, 0, lengthPx + 1600, 0);

  g.fillStyle(tint.floor, 1);
  g.fillRect(-400, DESIGN_H, lengthPx + 1600, 900);
  g.lineStyle(3, PALETTE.ink, 0.4);
  g.lineBetween(-400, DESIGN_H, lengthPx + 1600, DESIGN_H);
  g.lineStyle(1.5, PALETTE.ink, 0.12);
  for (let x = -400; x < lengthPx + 1600; x += 120) {
    g.lineBetween(x, DESIGN_H + 12, x + 60, DESIGN_H + 300);
  }

  // room specific dressing
  if (room.id === "nook") {
    windowWithCurtains(g, 180, 90, 420, 300, PALETTE.accent2);
    pinboard(g, 820, 130, 560, 380);
    shelf(g, 1560, 120, 460, 420);
    deskRow(g, 200, DESIGN_H - 130, 900, 130);
    deskRow(g, 1500, DESIGN_H - 120, 760, 120, PALETTE.paper2);
    chair(g, 1250, DESIGN_H - 40, 90, 150);
  } else if (room.id === "study") {
    shelf(g, 160, 70, 620, 520);
    windowWithCurtains(g, 980, 110, 360, 260, PALETTE.accent);
    circle(g, 1560, 220, 74, PALETTE.paper);
    g.lineStyle(3, PALETTE.ink, 0.7);
    g.strokeCircle(1560, 220, 74);
    g.lineBetween(1560, 220, 1560, 176);
    g.lineBetween(1560, 220, 1596, 240);
    poster(g, 1780, 150, 300, 220);
    radiator(g, 2200, DESIGN_H - 170, 420, 170);
    deskRow(g, 700, DESIGN_H - 130, 900, 130);
    deskRow(g, 2700, DESIGN_H - 130, 900, 130, PALETTE.paper2);
    chair(g, 1900, DESIGN_H - 40, 90, 150);
    chair(g, 3300, DESIGN_H - 40, 90, 150);
  } else if (room.id === "classroom") {
    chalkboard(g, 240, 90, 900, 460);
    windowWithCurtains(g, 1320, 110, 340, 250, PALETTE.accent);
    poster(g, 1800, 140, 420, 300);
    poster(g, 2400, 160, 320, 240);
    mobile(g, 3100, 120, 200, 220);
    mobile(g, 3900, 110, 180, 200);
    for (let x = 200; x < lengthPx - 200; x += 520) {
      deskRow(g, x, DESIGN_H - 120, 400, 120, PALETTE.kraft);
    }
    chair(g, 1000, DESIGN_H - 40, 90, 150);
    chair(g, 2900, DESIGN_H - 40, 90, 150);
    chair(g, 4600, DESIGN_H - 40, 90, 150);
  } else {
    for (let i = 0; i < 4; i += 1) {
      const x = 180 + i * 400;
      archWindow(g, x, 60, 260, 420);
      lightBeam(g, x + 40, 470, 180, 320);
    }
    for (let x = 1700; x < lengthPx - 900; x += 620) {
      mobile(g, x, 90, 220, 260);
    }
    for (let x = 300; x < lengthPx - 600; x += 460) {
      deskRow(g, x, DESIGN_H - 110, 360, 110, 0xc9a06a);
    }
    curtain(g, lengthPx - 620, 0, 620, DESIGN_H);
    g.fillStyle(PALETTE.paper2, 1);
    g.fillRect(lengthPx - 620, DESIGN_H - 30, 620, 30);
  }
}

/** The near edge of the room: moves faster than the wall for a little depth. */
export function drawForeground(
  g: Phaser.GameObjects.Graphics,
  room: Room,
  lengthPx: number,
): void {
  const floorTop = DESIGN_H - 26;
  g.fillStyle(0xb08a5c, 1);
  g.fillRect(-1600, floorTop + 26, lengthPx + 4000, 600);
  g.lineStyle(3, PALETTE.ink, 0.5);
  g.lineBetween(-1600, floorTop + 26, lengthPx + 2400, floorTop + 26);
  g.fillStyle(0xa37c50, 1);
  g.fillRect(-1600, floorTop + 26, lengthPx + 4000, 10);

  const step = room.id === "auditorium" ? 380 : 620;
  for (let x = -1200; x < lengthPx + 2000; x += step) {
    g.fillStyle(PALETTE.ink, 0.13);
    g.fillRect(x + 16, floorTop + 20, 420, 26);
    g.fillStyle(0x8f6a44, 1);
    g.fillRect(x, floorTop + 10, 420, 26);
    g.lineStyle(2, PALETTE.ink, 0.45);
    g.strokeRect(x, floorTop + 10, 420, 26);
  }
}
