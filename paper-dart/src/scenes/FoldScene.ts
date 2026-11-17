import Phaser from "phaser";
import { EV, SCENES, bus, session } from "../app.ts";
import { audio } from "../game/audio.ts";
import {
  FOLD_STEPS,
  SHEET_H,
  advanceFold,
  commitFold,
  gradeFromQualities,
  newFoldProgress,
  sheetPanels,
  type FoldProgress,
  type FoldQuality,
  type Vec2,
} from "../game/fold.ts";
import { input } from "../game/input.ts";
import { PALETTE } from "../game/palette.ts";
import { roomById } from "../game/rooms.ts";
import { drawDart } from "../render/dart.ts";
import { clamp, poly, type Pt } from "../render/paper.ts";

interface Layout {
  cx: number;
  cy: number;
  sheetW: number;
  sheetH: number;
}

type Phase = "wait" | "crease" | "commit" | "gap" | "reveal";

const SHADES = {
  front: PALETTE.paper,
  back: PALETTE.paperBack,
  wing: PALETTE.paper2,
};

/**
 * The folding phase: five steps of a dart, each graded from how cleanly the
 * player runs the crease and where they let go.
 */
export class FoldScene extends Phaser.Scene {
  private stepIndex = 0;
  private fp: FoldProgress = newFoldProgress();
  private phase: Phase = "wait";
  private qualities: FoldQuality[] = [];
  private sheet!: Phaser.GameObjects.Graphics;
  private commitFrom = 0;
  private commitTo = 0;
  private commitT = 0;
  private revealT = 0;
  private fibres: Array<{ a: Vec2; b: Vec2 }> = [];
  /** creases already made, so the sheet keeps its history */
  private creases: Array<{ line: { a: Vec2; b: Vec2 }; offset: number }> = [];
  private layout: Layout = { cx: 0, cy: 0, sheetW: 320, sheetH: 448 };
  private strayLimitPx = 40;
  /** wait for a fresh press so a held key does not start the first crease */
  private armed = false;

  constructor() {
    super(SCENES.fold);
  }

  create(): void {
    session.qualities = [];
    this.qualities = [];
    this.stepIndex = 0;
    this.fp = newFoldProgress();
    this.phase = "wait";
    this.revealT = 0;
    this.armed = false;
    this.fibres = [];
    this.creases = [];
    for (let i = 0; i < 130; i += 1) {
      const a = { x: Math.random(), y: Math.random() * SHEET_H };
      const len = 0.006 + Math.random() * 0.03;
      const ang = Math.random() * Math.PI;
      this.fibres.push({
        a,
        b: { x: a.x + Math.cos(ang) * len, y: a.y + Math.sin(ang) * len },
      });
    }

    this.addDesk();
    this.sheet = this.add.graphics().setDepth(10);

    this.layoutSheet();
    this.scale.on("resize", this.layoutSheet, this);
    this.events.once("shutdown", () => this.scale.off("resize", this.layoutSheet, this));

    this.publishStep();
    bus.emit(EV.foldStamp, this.qualities);
    bus.emit(EV.foldProgress, 0);
  }

  private addDesk(): void {
    const desk = this.add.graphics().setDepth(0);
    const paint = (): void => {
      const w = this.scale.width;
      const h = this.scale.height;
      desk.clear();
      desk.fillStyle(PALETTE.kraft, 1);
      desk.fillRect(0, 0, w, h);
      desk.fillStyle(PALETTE.kraftDark, 1);
      desk.fillRect(0, h * 0.72, w, h * 0.28);
      desk.lineStyle(3, PALETTE.ink, 0.25);
      for (let x = -100; x < w + 100; x += 96) {
        desk.lineBetween(x, h * 0.72, x + 40, h);
      }
      desk.fillStyle(PALETTE.ink, 0.08);
      desk.fillEllipse(w * 0.5, h * 0.5, Math.min(w, h) * 0.86, Math.min(w, h) * 0.78);
    };
    paint();
    this.scale.on("resize", paint);
    this.events.once("shutdown", () => this.scale.off("resize", paint));
  }

  private layoutSheet(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const sheetW = clamp(Math.min(w * 0.46, h * 0.5), 150, 420);
    this.layout = { cx: w * 0.5, cy: h * 0.52, sheetW, sheetH: sheetW * SHEET_H };
    this.strayLimitPx = clamp(sheetW * 0.1, 26, 46);
  }

  private toScreen(p: Vec2): Pt {
    const { cx, cy, sheetW, sheetH } = this.layout;
    const shift = this.viewShift();
    return { x: cx + (p.x - 0.5) * sheetW + shift, y: cy + (p.y - SHEET_H / 2) * sheetH };
  }

  private toSheet(x: number, y: number): Vec2 {
    const { cx, cy, sheetW, sheetH } = this.layout;
    const shift = this.viewShift();
    return { x: (x - cx - shift) / sheetW + 0.5, y: (y - cy) / sheetH + SHEET_H / 2 };
  }

  /** After the spine fold the visible half slides to the middle of the screen. */
  private viewShift(): number {
    const { sheetW } = this.layout;
    if (this.stepIndex < 3) return 0;
    const narrowT = this.stepIndex === 4 ? clamp(this.fp.progress, 0, 1) : 0;
    const k = 1 - 0.42 * narrowT;
    const target = 0.25 * k * sheetW;
    if (this.stepIndex === 3) {
      return target * clamp(this.fp.progress / 0.9, 0, 1);
    }
    return target;
  }

  private publishStep(): void {
    const step = FOLD_STEPS[this.stepIndex];
    bus.emit(EV.foldStep, {
      index: this.stepIndex,
      total: FOLD_STEPS.length,
      title: step.title,
      hint: step.hint,
    });
  }

  private band(): { centre: number; half: number } {
    return roomById(session.roomId).creaseBand;
  }

  private pointerStray(): number {
    const step = FOLD_STEPS[this.stepIndex];
    const { sheetW } = this.layout;
    const limit = this.strayLimitPx / sheetW;
    if (!input.pointer.down) return limit * 0.2;
    const p = this.toSheet(input.pointer.x, input.pointer.y);
    const a = step.line.a;
    const b = step.line.b;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const dist = Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
    return dist;
  }

  private startCrease(): void {
    this.phase = "crease";
    bus.emit(EV.foldPrompt, "Keep the crease on the line…");
  }

  private releaseCrease(): void {
    const limit = this.strayLimitPx / this.layout.sheetW;
    const band = this.band();
    const committed = commitFold(this.fp, limit, band);
    const quality = committed.quality ?? "rough";
    this.fp = committed;
    this.qualities[this.stepIndex] = quality;
    session.qualities = [...this.qualities];
    const stepLine = FOLD_STEPS[this.stepIndex].line;
    this.creases[this.stepIndex] = { line: stepLine, offset: this.fp.creaseOffset };
    audio.unlock();
    audio.crease(quality);
    bus.emit(EV.foldStamp, this.qualities);
    bus.emit(
      EV.foldPrompt,
      quality === "perfect" ? "Perfect crease" : quality === "good" ? "Good fold" : "Rough fold",
    );
    this.phase = "commit";
    this.commitFrom = this.fp.progress;
    this.commitTo = 1;
    this.commitT = 0;
  }

  private nextStep(): void {
    if (this.stepIndex >= FOLD_STEPS.length - 1) {
      this.phase = "reveal";
      this.revealT = 0;
      audio.launch(1);
      audio.flutterStart();
      audio.setFlutter(9);
      return;
    }
    this.stepIndex += 1;
    this.fp = newFoldProgress();
    this.phase = "wait";
    this.armed = false;
    this.publishStep();
    bus.emit(EV.foldProgress, 0);
  }

  override update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.05);

    if (this.phase === "wait" || this.phase === "crease") {
      if (!this.armed && !input.hold) this.armed = true;
      if (input.hold && this.armed) {
        if (this.phase === "wait") this.startCrease();
        audio.unlock();
        const limit = this.strayLimitPx / this.layout.sheetW;
        this.fp = advanceFold(this.fp, dt, true, this.pointerStray(), limit, this.band());
        bus.emit(EV.foldProgress, this.fp.progress);
        const band = this.band();
        if (this.fp.progress >= 1.12) {
          this.releaseCrease();
        } else if (this.fp.progress > band.centre + band.half) {
          bus.emit(EV.foldPrompt, "Past the band — let go!");
        }
      } else if (this.phase === "crease") {
        this.releaseCrease();
      }
    } else if (this.phase === "commit") {
      this.commitT = Math.min(1, this.commitT + dt / 0.26);
      this.fp = {
        ...this.fp,
        progress: this.commitFrom + (this.commitTo - this.commitFrom) * easeOut(this.commitT),
      };
      bus.emit(EV.foldProgress, this.fp.progress);
      if (this.commitT >= 1) {
        this.phase = "gap";
        this.fp = { ...this.fp, quality: null, progress: this.commitTo };
        this.publishStepIdle();
        this.time.delayedCall(430, () => this.nextStep());
      }
    } else if (this.phase === "reveal") {
      this.revealT = Math.min(1, this.revealT + dt / 1.05);
      if (this.revealT >= 1) {
        const grade = gradeFromQualities(this.qualities);
        session.grade = grade;
        audio.flutterStop();
        bus.emit(EV.foldDone, grade);
        this.scene.stop();
      }
    }
    this.draw();
  }

  private publishStepIdle(): void {
    bus.emit(EV.foldPrompt, "Nice.");
  }

  private draw(): void {
    const g = this.sheet;
    g.clear();
    const reveal = this.phase === "reveal" ? this.revealT : 0;

    if (reveal < 1) {
      const panels = sheetPanels(this.stepIndex, this.fp.progress);
      const alpha = 1 - reveal * 1.1;
      for (const panel of panels) {
        if (!panel.visible) continue;
        const pts = panel.poly.map((p) => this.toScreen(p));
        g.fillStyle(PALETTE.ink, 0.16 * alpha);
        g.fillPoints(
          pts.map((p) => ({ x: p.x + 6, y: p.y + 8 })),
          true,
        );
      }
      for (const panel of panels) {
        if (!panel.visible) continue;
        const pts = panel.poly.map((p) => this.toScreen(p));
        poly(g, pts, SHADES[panel.shade], alpha, PALETTE.ink, 2.5);
      }
      // paper fibres, drawn inside the base sheet rectangle
      if (alpha > 0.3) {
        g.lineStyle(1, PALETTE.kraftDark, 0.13 * alpha);
        const rectTL = this.toScreen({ x: 0, y: 0 });
        const rectBR = this.toScreen({ x: 1, y: SHEET_H });
        for (const fibre of this.fibres) {
          const a = this.toScreen(fibre.a);
          const b = this.toScreen(fibre.b);
          if (a.x < rectTL.x - 4 || a.x > rectBR.x + 4) continue;
          if (a.y < rectTL.y - 4 || a.y > rectBR.y + 4) continue;
          g.lineBetween(a.x, a.y, b.x, b.y);
        }
      }
    }

    this.drawGuides(g, reveal);

    if (reveal > 0) {
      const dartScale = 0.5 + reveal * 0.6;
      const x = this.layout.cx + reveal * this.scale.width * 0.45;
      const y = this.layout.cy - reveal * this.scale.height * 0.22;
      g.setAlpha(Math.min(1, reveal * 1.6));
      drawDart(g, x, y, this.layout.sheetW * dartScale, -8 - reveal * 12, Math.sin(this.revealT * 20) * 0.5);
      g.setAlpha(1);
    }
  }

  private drawGuides(g: Phaser.GameObjects.Graphics, reveal: number): void {
    if (reveal > 0.05) return;
    const step = FOLD_STEPS[this.stepIndex];
    const a = this.toScreen(step.line.a);
    const b = this.toScreen(step.line.b);
    const band = this.band();

    // the green crease band
    const bandA = pointOnLine(a, b, band.centre - band.half);
    const bandB = pointOnLine(a, b, band.centre + band.half);
    g.lineStyle(16, PALETTE.accent2, 0.4);
    g.lineBetween(bandA.x, bandA.y, bandB.x, bandB.y);
    g.lineStyle(16, PALETTE.accent2, 0.35);
    g.lineBetween(bandB.x, bandB.y, pointOnLine(a, b, Math.min(1.12, band.centre + band.half * 2.4)).x, pointOnLine(a, b, Math.min(1.12, band.centre + band.half * 2.4)).y);

    // dashed guide
    const dashes = 16;
    for (let i = 0; i < dashes; i += 1) {
      if (i % 2 === 1) continue;
      const p0 = pointOnLine(a, b, i / dashes);
      const p1 = pointOnLine(a, b, (i + 1) / dashes);
      g.lineStyle(3, PALETTE.ink, 0.45);
      g.lineBetween(p0.x, p0.y, p1.x, p1.y);
    }

    // the crease already run, nudged off the line by the fold quality
    const offsetPx = this.fp.creaseOffset * this.layout.sheetW;
    const bead = pointOnLine(a, b, this.fp.progress);
    const perp = perpendicular(a, b);
    const creaseEnd = { x: bead.x + perp.x * offsetPx, y: bead.y + perp.y * offsetPx };
    g.lineStyle(4, PALETTE.ink, 0.8);
    g.lineBetween(a.x, a.y, creaseEnd.x, creaseEnd.y);
    g.fillStyle(PALETTE.ink, 0.9);
    g.fillCircle(creaseEnd.x, creaseEnd.y, 8);
    g.fillStyle(PALETTE.paper, 1);
    g.fillCircle(creaseEnd.x, creaseEnd.y, 4.5);

    // start marker
    g.fillStyle(PALETTE.paper, 0.9);
    g.fillCircle(a.x, a.y, 6);
    g.lineStyle(2, PALETTE.ink, 0.6);
    g.strokeCircle(a.x, a.y, 6);

    // creases from the steps already folded, slightly off the guide where the fold was rough
    for (const crease of this.creases) {
      if (!crease) continue;
      const ca = this.toScreen(crease.line.a);
      const cb = this.toScreen(crease.line.b);
      const perp = perpendicular(ca, cb);
      const off = crease.offset * this.layout.sheetW;
      g.lineStyle(2.5, PALETTE.ink, 0.22);
      g.lineBetween(ca.x + perp.x * off, ca.y + perp.y * off, cb.x + perp.x * off, cb.y + perp.y * off);
    }
  }
}

const pointOnLine = (a: Pt, b: Pt, t: number): Pt => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

const perpendicular = (a: Pt, b: Pt): Pt => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
};

const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3);
