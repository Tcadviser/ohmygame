import Phaser from "phaser";
import { SCENES } from "../app.ts";
import { DESIGN_H, PALETTE, PX_PER_M } from "../game/palette.ts";
import { ROOMS } from "../game/rooms.ts";
import { drawBackdrop, drawForeground } from "../render/backdrop.ts";
import { drawDart } from "../render/dart.ts";
import { clamp, circle, rect } from "../render/paper.ts";

/** The papercraft room behind the title screen, with a dart gliding across it. */
export class MenuScene extends Phaser.Scene {
  private dart!: Phaser.GameObjects.Graphics;
  private trail: Array<{ x: number; y: number; life: number }> = [];
  private elapsed = 0;
  private slice = 13 * PX_PER_M;

  constructor() {
    super(SCENES.menu);
  }

  create(): void {
    const room = ROOMS[0];
    const back = this.add.graphics();
    drawBackdrop(back, room, this.slice);
    back.setDepth(0);
    const fore = this.add.graphics();
    drawForeground(fore, room, this.slice);
    fore.setDepth(20);

    // a sheet of paper waiting on the desk
    const sheet = this.add.graphics();
    sheet.setDepth(6);
    const sx = 5.4 * PX_PER_M;
    const sy = DESIGN_H - 40;
    sheet.fillStyle(PALETTE.ink, 0.16);
    sheet.fillRect(sx + 8, sy - 150, 300, 190);
    rect(sheet, sx, sy - 160, 300, 190, PALETTE.paper);
    sheet.lineStyle(2, PALETTE.inkSoft, 0.5);
    sheet.lineBetween(sx + 150, sy - 160, sx + 150, sy + 30);

    this.dart = this.add.graphics();
    this.dart.setDepth(30);

    const cam = this.cameras.main;
    cam.centerOn(this.slice / 2, DESIGN_H / 2);
    this.layout();
    this.scale.on("resize", this.layout, this);
    this.events.once("shutdown", () => this.scale.off("resize", this.layout, this));
  }

  private layout(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const zoom = clamp(Math.min(w / this.slice, h / DESIGN_H), 0.28, 1.2);
    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn(this.slice / 2, DESIGN_H / 2);
  }

  override update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.elapsed += dt;
    const period = 6.5;
    const t = (this.elapsed % period) / period;
    const x = -260 + t * (this.slice + 520);
    const y = DESIGN_H * 0.46 + Math.sin(this.elapsed * 1.4) * 70 - t * 40;
    const angle = -4 + Math.sin(this.elapsed * 1.9) * 7 - t * 6;

    this.trail.push({ x, y, life: 1 });
    for (const point of this.trail) point.life -= dt * 0.55;
    this.trail = this.trail.filter((p) => p.life > 0).slice(-90);

    this.dart.clear();
    for (const point of this.trail) {
      circle(this.dart, point.x, point.y, 3 + (1 - point.life) * 3, PALETTE.paper, point.life * 0.5, null);
    }
    drawDart(this.dart, x, y, 150, angle, Math.sin(this.elapsed * 6) * 0.4);
  }
}
