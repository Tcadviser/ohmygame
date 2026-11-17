import Phaser from "phaser";
import { EV, SCENES, bus, session } from "../app.ts";
import { audio } from "../game/audio.ts";
import { createRun, runProgress, stepRun, type RunState } from "../game/flight.ts";
import { input } from "../game/input.ts";
import { DESIGN_H, PALETTE, PX_PER_M, ROOM_HEIGHT_M } from "../game/palette.ts";
import { roomById, type Pickup, type Prop, type Room } from "../game/rooms.ts";
import { GRADE_MULTIPLIER } from "../game/fold.ts";
import { BESIDE_BONUS, CLIP_POINTS, STAR_POINTS, LANDING_BONUS, scoreRun } from "../game/score.ts";
import { drawBackdrop, drawForeground } from "../render/backdrop.ts";
import { drawDart } from "../render/dart.ts";
import { drawProp } from "../render/props.ts";
import { circle, clamp, poly, roundedRect, type Pt } from "../render/paper.ts";

const FIXED_DT = 1 / 120;
const MIN_VIEW_W = 1000;
const POWER_MIN = 0.72;
const POWER_MAX = 1.15;
const POWER_PERIOD = 1.35;

type Phase = "aim" | "fly" | "end";

export class FlightScene extends Phaser.Scene {
  private room!: Room;
  private run: RunState | null = null;
  private phase: Phase = "aim";
  private power = POWER_MIN;
  private powerT = 0;
  private aimAngle = 12;
  private acc = 0;
  private elapsed = 0;
  private hudTimer = 0;
  private endTimer = 0;
  private zoom = 1;
  /** the charge only starts on a fresh press, so a held key cannot throw by accident */
  private armed = false;
  private trail: Array<{ x: number; y: number; life: number }> = [];
  private previewKey = "";
  private previewPoints: Array<{ x: number; y: number }> = [];
  private pops: Array<{ x: number; y: number; life: number; kind: "clip" | "star" }> = [];

  private dynamic!: Phaser.GameObjects.Graphics;
  private staticProps!: Phaser.GameObjects.Graphics;
  private spinning: Prop[] = [];
  private floorMarks!: Phaser.GameObjects.Graphics;

  constructor() {
    super(SCENES.flight);
  }

  create(): void {
    this.room = roomById(session.roomId);
    this.run = null;
    this.phase = "aim";
    this.power = POWER_MIN;
    this.powerT = 0;
    this.armed = false;
    this.aimAngle = 12;
    this.acc = 0;
    this.elapsed = 0;
    this.trail = [];
    this.pops = [];
    this.endTimer = 0;

    const lengthPx = this.room.lengthM * PX_PER_M;
    const back = this.add.graphics().setDepth(0);
    drawBackdrop(back, this.room, lengthPx);

    this.floorMarks = this.add.graphics().setDepth(2);
    this.drawFloorMarks(lengthPx);

    this.staticProps = this.add.graphics().setDepth(8);
    this.spinning = [];
    for (const prop of this.room.props) {
      if (prop.spin) {
        this.spinning.push(prop);
      } else {
        drawProp(
          this.staticProps,
          prop.kind,
          prop.x * PX_PER_M,
          (ROOM_HEIGHT_M - prop.y) * PX_PER_M,
          prop.w * PX_PER_M,
          prop.h * PX_PER_M,
          0,
        );
      }
    }
    this.drawTarget();

    const fore = this.add.graphics().setDepth(40);
    drawForeground(fore, this.room, lengthPx);

    this.dynamic = this.add.graphics().setDepth(60);

    this.layout();
    this.scale.on("resize", this.layout, this);
    this.events.once("shutdown", () => this.scale.off("resize", this.layout, this));

    bus.emit(EV.flightPhase, "aim");
    this.pushHud();
  }

  private drawFloorMarks(lengthPx: number): void {
    const g = this.floorMarks;
    g.clear();
    g.lineStyle(2, PALETTE.ink, 0.28);
    for (let m = 0; m <= this.room.lengthM; m += 1) {
      const x = m * PX_PER_M;
      const tall = m % 5 === 0;
      g.lineBetween(x, DESIGN_H, x, DESIGN_H - (tall ? 26 : 12));
    }
    g.lineStyle(3, PALETTE.ink, 0.35);
    g.lineBetween(lengthPx, 0, lengthPx, DESIGN_H);
  }

  private drawTarget(): void {
    const g = this.staticProps;
    const target = this.room.target;
    const h = target.topY * PX_PER_M;
    const w = target.width * 1.15 * PX_PER_M;
    const cx = target.x * PX_PER_M;
    const cy = DESIGN_H - h / 2;

    // a soft spotlight on the floor so the goal reads from far away
    g.fillStyle(PALETTE.gold, 0.18);
    g.fillEllipse(cx, DESIGN_H - 6, w * 2.1, 34);

    const body: Pt[] = [
      { x: cx - w / 2, y: cy - h / 2 },
      { x: cx + w / 2, y: cy - h / 2 },
      { x: cx + w * 0.38, y: cy + h / 2 },
      { x: cx - w * 0.38, y: cy + h / 2 },
    ];
    g.fillStyle(PALETTE.ink, 0.16);
    g.fillPoints(body.map((p) => ({ x: p.x + 8, y: p.y + 10 })), true);
    poly(g, body, PALETTE.kraft, 1, PALETTE.ink, 3);
    g.fillStyle(PALETTE.kraftDark, 0.5);
    for (let i = 1; i < 5; i += 1) {
      g.fillRect(cx - w / 2 + (w / 5) * i, cy - h / 2, 4, h);
    }
    // rim
    g.fillStyle(PALETTE.paper2, 1);
    g.fillRect(cx - w / 2 - 4, cy - h / 2 - 10, w + 8, 12);
    g.lineStyle(3, PALETTE.ink, 0.9);
    g.strokeRect(cx - w / 2 - 4, cy - h / 2 - 10, w + 8, 12);
    // a crumpled ball inside, hinting at where to aim
    circle(g, cx - w * 0.12, cy + h * 0.16, w * 0.16, PALETTE.paper);
    circle(g, cx + w * 0.18, cy + h * 0.24, w * 0.12, PALETTE.paper2);
  }

  private layout(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.zoom = clamp(Math.min(w / MIN_VIEW_W, h / DESIGN_H), 0.4, 1.05);
    this.cameras.main.setZoom(this.zoom);
    this.updateCamera(1);
  }

  private updateCamera(dt: number): void {
    const cam = this.cameras.main;
    const viewW = this.scale.width / this.zoom;
    const viewH = this.scale.height / this.zoom;
    const lengthPx = this.room.lengthM * PX_PER_M;
    const dartX = this.dartPx().x;
    const dartY = this.dartPx().y;

    const lookahead = this.phase === "aim" ? 0 : viewW * 0.16;
    let cx = dartX + lookahead;
    cx = clamp(cx, viewW / 2 - 120, lengthPx - viewW / 2 + 260);
    if (lengthPx < viewW) cx = lengthPx / 2;

    let cy = dartY;
    if (viewH >= DESIGN_H) cy = DESIGN_H / 2;
    else cy = clamp(cy, viewH / 2, DESIGN_H - viewH / 2);

    const lerp = this.phase === "aim" ? 1 : clamp(dt * 9, 0, 1);
    cam.scrollX += (cx - viewW / 2 - cam.scrollX) * lerp;
    cam.scrollY += (cy - viewH / 2 - cam.scrollY) * lerp;
  }

  private dartPx(): { x: number; y: number } {
    const dart = this.run?.dart;
    if (!dart) {
      return {
        x: 0.6 * PX_PER_M,
        y: (ROOM_HEIGHT_M - this.room.launchY) * PX_PER_M,
      };
    }
    return { x: dart.x * PX_PER_M, y: (ROOM_HEIGHT_M - dart.y) * PX_PER_M };
  }

  private currentScore(): number {
    if (!this.run) return 0;
    const raw =
      this.run.distanceM * 10 +
      this.run.clips * CLIP_POINTS +
      this.run.stars * STAR_POINTS +
      (this.run.landing === "basket"
        ? LANDING_BONUS
        : this.run.landing === "beside"
          ? BESIDE_BONUS
          : 0);
    return Math.round(raw * GRADE_MULTIPLIER[session.grade]);
  }

  private pushHud(): void {
    const run = this.run;
    const dart = run?.dart;
    const speed = dart?.speed ?? 0;
    let state = "Ready";
    if (this.phase === "aim") state = "Aim";
    else if (run?.status === "cleared") state = "Landed!";
    else if (run?.status === "crashed") state = "Crumpled";
    else if (run && run.stallTime > 0.25) state = "Stalling";
    else if (dart && dart.angle > 5) state = "Climbing";
    else if (dart && dart.angle < -7) state = "Diving";
    else if (this.phase === "fly") state = "Glide";
    bus.emit(EV.flightHud, {
      phase: this.phase,
      distance: run?.distanceM ?? 0,
      goal: this.room.lengthM,
      score: this.currentScore(),
      clips: run?.clips ?? 0,
      stars: run?.stars ?? 0,
      speed,
      pitch: this.phase === "aim" ? this.aimAngle / 30 : (dart?.angle ?? 0) / 30,
      power: this.power,
      state,
    });
  }

  private release(): void {
    const angle = this.aimAngle;
    const power = this.power;
    session.launchAngle = angle;
    session.power = power;
    this.run = createRun(this.room, angle, power, session.grade, session.seed);
    session.run = this.run;
    this.phase = "fly";
    this.trail = [];
    audio.unlock();
    audio.launch(power);
    audio.flutterStart();
    audio.setFlutter(11);
    bus.emit(EV.flightPhase, "fly");
    this.pushHud();
  }

  private handleEvents(events: ReturnType<typeof stepRun>): void {
    for (const event of events) {
      if (event.type === "pickup") {
        audio.pickup(event.pickup.kind);
        this.pops.push({
          x: event.pickup.x * PX_PER_M,
          y: (ROOM_HEIGHT_M - event.pickup.y) * PX_PER_M,
          life: 1,
          kind: event.pickup.kind,
        });
        if (event.pickup.kind === "star") bus.emit(EV.toast, "Sticker! +150");
      } else if (event.type === "end") {
        this.finish();
      }
    }
  }

  /** Test-only: run the simulation without input, for deterministic checks. */
  simulate(ms: number, pitch = 0): void {
    let remaining = ms / 1000;
    while (remaining > 0 && this.run && this.run.status === "flying") {
      const dt = Math.min(FIXED_DT, remaining);
      this.handleEvents(stepRun(this.run, dt, pitch));
      remaining -= dt;
    }
    this.pushHud();
  }

  stateSnapshot(): Record<string, unknown> {
    const run = this.run;
    return {
      scene: SCENES.flight,
      phase: this.phase,
      roomId: this.room.id,
      grade: session.grade,
      aimAngle: Number(this.aimAngle.toFixed(2)),
      power: Number(this.power.toFixed(3)),
      status: run?.status ?? "aim",
      distanceM: run ? Number(run.distanceM.toFixed(2)) : 0,
      speed: run ? Number(run.dart.speed.toFixed(2)) : 0,
      angle: run ? Number(run.dart.angle.toFixed(1)) : 0,
      altitudeM: run ? Number(run.dart.y.toFixed(2)) : this.room.launchY,
      clips: run?.clips ?? 0,
      stickers: run?.stars ?? 0,
      score: this.currentScore(),
      progress: run ? Number(runProgress(run).toFixed(3)) : 0,
      stalling: (run?.stallTime ?? 0) > 0.25,
    };
  }

  override update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.05);
    this.elapsed += dt;

    if (this.phase === "aim") {
      if (!this.armed && !input.hold) this.armed = true;
      if (input.hold && this.armed) {
        audio.unlock();
        this.powerT += dt;
        const t = (this.powerT % POWER_PERIOD) / POWER_PERIOD;
        const wave = t < 0.5 ? t * 2 : 2 - t * 2;
        this.power = POWER_MIN + wave * (POWER_MAX - POWER_MIN);
        this.aimAngle = clamp(12 + input.pitchAxis() * 16, -5, 29);
      } else if (this.armed && this.powerT > 0.18) {
        this.release();
      }
    } else if (this.phase === "fly" && this.run) {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= FIXED_DT && steps < 12 && this.run.status === "flying") {
        const events = stepRun(this.run, FIXED_DT, input.pitchAxis());
        this.acc -= FIXED_DT;
        steps += 1;
        this.handleEvents(events);
      }
      audio.setFlutter(this.run.dart.speed);
      const px = this.dartPx();
      this.trail.push({ x: px.x, y: px.y, life: 1 });
    } else if (this.phase === "end") {
      this.endTimer += dt;
      if (this.endTimer > 0.55) {
        this.phase = "aim";
        this.run = null;
        this.powerT = 0;
        this.power = POWER_MIN;
        this.armed = false;
      }
    }

    for (const point of this.trail) point.life -= dt * 0.7;
    this.trail = this.trail.filter((p) => p.life > 0).slice(-120);
    for (const pop of this.pops) pop.life -= dt * 1.4;
    this.pops = this.pops.filter((p) => p.life > 0);

    this.updateCamera(dt);
    this.draw();

    this.hudTimer += dt;
    if (this.hudTimer > 0.06) {
      this.hudTimer = 0;
      this.pushHud();
    }
  }

  private finish(): void {
    if (!this.run) return;
    this.phase = "end";
    this.endTimer = 0;
    audio.flutterStop();
    if (this.run.status === "cleared") audio.clear();
    else audio.crumple();
    const result = scoreRun(this.run, session.grade, this.room);
    session.result = result;
    session.run = this.run;
    this.pushHud();
    bus.emit(EV.flightPhase, "end");
    bus.emit(EV.runEnd, result);
  }

  private draw(): void {
    const g = this.dynamic;
    g.clear();

    this.drawAir(g);
    this.drawPickups(g);
    this.drawPops(g);

    for (const prop of this.spinning) {
      const t = this.elapsed * ((prop.spin ?? 0) / 360) * Math.PI * 2;
      drawProp(
        g,
        prop.kind,
        prop.x * PX_PER_M,
        (ROOM_HEIGHT_M - prop.y) * PX_PER_M,
        prop.w * PX_PER_M,
        prop.h * PX_PER_M,
        prop.spin === 0 ? 0 : t,
      );
    }

    const target = this.room.target;
    const pulse = 0.5 + Math.sin(this.elapsed * 3) * 0.5;
    g.lineStyle(3, PALETTE.accent, 0.35 + pulse * 0.4);
    g.strokeEllipse(
      target.x * PX_PER_M,
      DESIGN_H - target.topY * PX_PER_M - 16,
      target.width * 1.3 * PX_PER_M,
      26,
    );

    // trail
    for (const point of this.trail) {
      circle(g, point.x, point.y, 2 + (1 - point.life) * 5, PALETTE.paper, point.life * 0.5, null);
    }

    const px = this.dartPx();
    const dart = this.run?.dart;

    if (this.phase === "aim") {
      this.drawAim(g, px);
    } else if (dart) {
      const flap = Math.sin(this.elapsed * 9) * clamp((dart.speed - 4) / 10, 0, 1);
      drawDart(g, px.x, px.y, 1.15 * PX_PER_M, -dart.angle, flap);
      if (this.run?.status === "crashed") {
        circle(g, px.x, px.y, 22 + pulse * 8, PALETTE.accent, 0.2, PALETTE.accent, 3);
      }
    }
  }

  private drawAim(g: Phaser.GameObjects.Graphics, px: { x: number; y: number }): void {
    // the hand holding the dart, and the launch arc
    const bounce = Math.sin(this.elapsed * 3) * 3;
    g.fillStyle(PALETTE.ink, 0.14);
    g.fillEllipse(px.x - 66, px.y + 46, 150, 34);
    roundedRect(g, px.x - 118, px.y - 4 + bounce, 110, 74, 22, PALETTE.paper2);
    for (let i = 0; i < 3; i += 1) {
      roundedRect(g, px.x - 96 + i * 26, px.y - 34 + bounce, 20, 44, 9, PALETTE.paper);
    }
    drawDart(g, px.x + 40, px.y + bounce, 1.15 * PX_PER_M, -this.aimAngle, 0.2);

    // dotted glide preview, recomputed only when the aim or the power changes
    const key = `${this.aimAngle.toFixed(1)}|${this.power.toFixed(2)}|${session.grade}`;
    if (key !== this.previewKey) {
      this.previewKey = key;
      this.previewPoints = [];
      const preview = createRun(this.room, this.aimAngle, this.power, session.grade, session.seed);
      for (let i = 0; i < 70; i += 1) {
        for (let k = 0; k < 6; k += 1) stepRun(preview, FIXED_DT, 0);
        if (preview.status !== "flying") break;
        this.previewPoints.push({
          x: preview.dart.x * PX_PER_M,
          y: (ROOM_HEIGHT_M - preview.dart.y) * PX_PER_M,
        });
      }
    }
    g.fillStyle(PALETTE.ink, 0.35);
    this.previewPoints.forEach((p, i) => {
      if (i % 2 !== 0) return;
      g.fillCircle(p.x, p.y, Math.max(1.4, 3.4 - i * 0.03));
    });
  }

  private drawAir(g: Phaser.GameObjects.Graphics): void {
    const viewLeft = this.cameras.main.scrollX - 200;
    const viewRight = viewLeft + this.scale.width / this.zoom + 400;
    for (const zone of this.room.air) {
      const x = zone.x * PX_PER_M;
      const w = zone.width * PX_PER_M;
      if (x + w < viewLeft || x - w > viewRight) continue;
      const up = zone.kind === "up";
      const top = (ROOM_HEIGHT_M - zone.yMax) * PX_PER_M;
      const bottom = (ROOM_HEIGHT_M - zone.yMin) * PX_PER_M;
      g.fillStyle(up ? PALETTE.accent2 : PALETTE.accent, 0.1);
      g.fillRect(x - w / 2, top, w, bottom - top);
      g.lineStyle(2, up ? PALETTE.accent2 : PALETTE.accent, 0.4);
      g.lineBetween(x - w / 2, top, x - w / 2, bottom);
      g.lineBetween(x + w / 2, top, x + w / 2, bottom);

      const arrows = Math.max(3, Math.floor((bottom - top) / 130));
      for (let i = 0; i < arrows; i += 1) {
        const lane = -w / 2 + 16 + ((i * 47) % Math.max(1, w - 32));
        const phase = ((this.elapsed * (up ? -1 : 1) * 120 + i * 60) % (bottom - top) + (bottom - top)) %
          (bottom - top);
        const y = up ? bottom - phase : top + phase;
        g.lineStyle(3, up ? PALETTE.accent2 : PALETTE.accent, 0.55);
        const dir = up ? -1 : 1;
        g.lineBetween(x + lane, y, x + lane, y + dir * 34);
        poly(
          g,
          [
            { x: x + lane - 8, y: y + dir * 22 },
            { x: x + lane + 8, y: y + dir * 22 },
            { x: x + lane, y: y + dir * 40 },
          ],
          up ? PALETTE.accent2 : PALETTE.accent,
          0.7,
          null,
        );
      }
    }
  }

  private drawPickups(g: Phaser.GameObjects.Graphics): void {
    for (const pickup of this.room.pickups) {
      if (this.run?.collected.includes(pickup.id)) continue;
      const bob = Math.sin(this.elapsed * 2.2 + pickup.x) * 6;
      const x = pickup.x * PX_PER_M;
      const y = (ROOM_HEIGHT_M - pickup.y) * PX_PER_M + bob;
      this.drawPickup(g, pickup, x, y, 1);
    }
  }

  private drawPickup(
    g: Phaser.GameObjects.Graphics,
    pickup: Pickup,
    x: number,
    y: number,
    scale: number,
  ): void {
    g.fillStyle(PALETTE.gold, 0.16);
    g.fillCircle(x, y, 26 * scale);
    if (pickup.kind === "clip") {
      g.lineStyle(5 * scale, PALETTE.gold, 1);
      g.strokeRoundedRect(x - 10 * scale, y - 15 * scale, 20 * scale, 30 * scale, 10 * scale);
      g.lineStyle(5 * scale, PALETTE.gold, 1);
      g.strokeRoundedRect(x - 5 * scale, y - 9 * scale, 10 * scale, 22 * scale, 5 * scale);
      g.lineStyle(1.5 * scale, PALETTE.kraftDark, 0.7);
      g.strokeRoundedRect(x - 10 * scale, y - 15 * scale, 20 * scale, 30 * scale, 10 * scale);
    } else {
      const points: Pt[] = [];
      for (let i = 0; i < 10; i += 1) {
        const r = i % 2 === 0 ? 17 * scale : 7.5 * scale;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        points.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
      }
      poly(g, points, PALETTE.gold, 1, PALETTE.kraftDark, 2);
      g.fillStyle(0xfff3cf, 0.55);
      g.fillCircle(x - 4 * scale, y - 5 * scale, 4 * scale);
    }
  }

  private drawPops(g: Phaser.GameObjects.Graphics): void {
    for (const pop of this.pops) {
      const t = 1 - pop.life;
      const x = pop.x;
      const y = pop.y - t * 40;
      g.setAlpha(pop.life);
      if (pop.kind === "clip") {
        this.drawPickup(
          g,
          { id: "pop", kind: "clip", x: 0, y: 0 },
          x,
          y,
          1 + t * 0.8,
        );
      } else {
        this.drawPickup(g, { id: "pop", kind: "star", x: 0, y: 0 }, x, y, 1 + t * 0.8);
      }
      g.setAlpha(1);
    }
  }
}
