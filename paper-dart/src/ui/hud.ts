import type { FoldQuality } from "../game/fold.ts";
import type { Room } from "../game/rooms.ts";
import { ROOMS } from "../game/rooms.ts";
import type { Progress } from "../game/save.ts";
import type { RunResult } from "../game/score.ts";
import type { FlightHud } from "../app.ts";

export interface UiHandlers {
  onPlay: () => void;
  onRooms: () => void;
  onHelp: () => void;
  onBack: () => void;
  onRetry: () => void;
  onNext: () => void;
  onPause: () => void;
  onResume: () => void;
  onSound: () => void;
  onSignIn: () => void;
}

const SCREENS = [
  "boot-status",
  "screen-title",
  "screen-rooms",
  "screen-help",
  "screen-pause",
  "screen-result",
] as const;

export type ScreenName = (typeof SCREENS)[number] | null;

const byId = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
};

/** Owns every DOM surface: menus, the fold HUD and the flight HUD. */
export class Ui {
  readonly hud = {
    fold: byId<HTMLDivElement>("hud-fold"),
    flight: byId<HTMLDivElement>("hud-flight"),
  };

  private currentScreen: ScreenName = "boot-status";
  private toastTimer: number | null = null;
  private soundOn = true;

  constructor(handlers: UiHandlers) {
    byId("btn-play").addEventListener("click", () => handlers.onPlay());
    byId("btn-rooms").addEventListener("click", () => handlers.onRooms());
    byId("btn-help").addEventListener("click", () => handlers.onHelp());
    byId("btn-help-2").addEventListener("click", () => handlers.onHelp());
    byId("btn-pause").addEventListener("click", () => handlers.onPause());
    byId("btn-resume").addEventListener("click", () => handlers.onResume());
    byId("btn-restart").addEventListener("click", () => handlers.onRetry());
    byId("btn-retry").addEventListener("click", () => handlers.onRetry());
    byId("btn-next").addEventListener("click", () => handlers.onNext());
    byId("btn-pause-rooms").addEventListener("click", () => handlers.onRooms());
    byId("btn-result-rooms").addEventListener("click", () => handlers.onRooms());
    byId("btn-sound").addEventListener("click", () => handlers.onSound());
    byId("btn-sound-2").addEventListener("click", () => handlers.onSound());
    byId("btn-signin").addEventListener("click", () => handlers.onSignIn());
    document.querySelectorAll<HTMLButtonElement>("[data-back]").forEach((el) => {
      el.addEventListener("click", () => handlers.onBack());
    });
  }

  showScreen(name: ScreenName, hud: "fold" | "flight" | null = null): void {
    this.currentScreen = name;
    for (const id of SCREENS) {
      byId(id).classList.toggle("active", id === name);
    }
    this.hud.fold.classList.toggle("active", hud === "fold");
    this.hud.flight.classList.toggle("active", hud === "flight");
  }

  get screen(): ScreenName {
    return this.currentScreen;
  }

  showHud(which: "fold" | "flight" | null): void {
    this.hud.fold.classList.toggle("active", which === "fold");
    this.hud.flight.classList.toggle("active", which === "flight");
  }

  setBoot(text: string): void {
    byId("boot-text").textContent = text;
  }

  setSoundLabel(muted: boolean): void {
    this.soundOn = !muted;
    const label = muted ? "Sound off" : "Sound on";
    for (const id of ["btn-sound", "btn-sound-2"]) {
      const el = byId<HTMLButtonElement>(id);
      el.textContent = label;
      el.setAttribute("aria-pressed", String(muted));
    }
  }

  get soundEnabled(): boolean {
    return this.soundOn;
  }

  // --- fold HUD

  setFoldStep(index: number, total: number, title: string, hint: string): void {
    byId("fold-step").textContent = `${index + 1} / ${total}`;
    byId("fold-title").textContent = title;
    byId("fold-hint").textContent = hint;
    byId("fold-prompt").textContent = "Press and hold to crease";
  }

  setFoldProgress(progress: number, band: { centre: number; half: number }): void {
    byId<HTMLDivElement>("crease-fill").style.width = `${Math.min(100, progress * 100)}%`;
    const el = byId<HTMLDivElement>("crease-fill");
    el.style.background =
      progress >= band.centre - band.half && progress <= band.centre + band.half
        ? "linear-gradient(90deg, var(--accent-2), var(--gold))"
        : "linear-gradient(90deg, var(--gold), var(--accent))";
  }

  setFoldPrompt(text: string): void {
    byId("fold-prompt").textContent = text;
  }

  setStamps(qualities: FoldQuality[]): void {
    const wrap = byId("fold-stamps");
    wrap.innerHTML = "";
    for (let i = 0; i < 5; i += 1) {
      const q = qualities[i];
      const el = document.createElement("div");
      el.className = `stamp${q ? ` ${q} pop` : ""}`;
      el.textContent = q === "perfect" ? "S" : q === "good" ? "A" : q === "rough" ? "C" : "·";
      wrap.appendChild(el);
    }
  }

  // --- flight HUD

  setFlightHud(hud: FlightHud): void {
    const pct = Math.max(0, Math.min(1, hud.distance / hud.goal)) * 100;
    byId<HTMLDivElement>("tape-fill").style.width = `${pct}%`;
    byId<HTMLDivElement>("tape-dart").style.left = `${pct}%`;
    byId("hud-distance").textContent = `${hud.distance.toFixed(1)} m`;
    byId("hud-goal").textContent = `/ ${hud.goal} m`;
    byId("hud-score").textContent = String(hud.score);
    byId("hud-clips").textContent = String(hud.clips + hud.stars);
    byId("hud-state").textContent = hud.state;
    byId<HTMLDivElement>("gauge-needle").style.transform = `rotate(${(-hud.pitch * 70).toFixed(1)}deg)`;
    const speedPct = Math.max(0, Math.min(1, (hud.speed - 2) / 12)) * 100;
    byId<HTMLDivElement>("speed-fill").style.width = `${speedPct}%`;

    const power = byId<HTMLDivElement>("hud-power");
    const aiming = hud.phase === "aim";
    power.style.opacity = aiming ? "1" : "0";
    power.style.transition = "opacity 0.2s ease";
    if (aiming) {
      byId<HTMLDivElement>("power-fill").style.width = `${((hud.power - 0.7) / 0.45) * 100}%`;
    }
  }

  setPowerHint(text: string): void {
    byId("power-hint").textContent = text;
  }

  toast(text: string): void {
    const el = byId<HTMLDivElement>("toast");
    el.textContent = text;
    el.classList.add("show");
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => el.classList.remove("show"), 1800);
  }

  // --- title & rooms

  setTitleProgress(progress: Progress): void {
    const clears = ROOMS.filter((r) => (progress.rooms[r.id]?.stars ?? 0) > 0).length;
    const best = Math.max(0, ...Object.values(progress.rooms).map((r) => r.bestScore));
    byId("title-progress").textContent =
      progress.runs === 0
        ? "No flights yet"
        : `${clears}/${ROOMS.length} rooms cleared · best ${best}`;
  }

  setSaveNote(text: string, canSignIn: boolean): void {
    const note = byId("title-save-note");
    note.textContent = text;
    byId("btn-signin").classList.toggle("hidden", !canSignIn);
  }

  renderRooms(progress: Progress, onPick: (roomId: string) => void, activeId: string): void {
    const list = byId<HTMLDivElement>("room-list");
    list.innerHTML = "";
    ROOMS.forEach((room, index) => {
      const record = progress.rooms[room.id];
      const unlocked = progress.unlocked.includes(room.id);
      const card = document.createElement("button");
      card.type = "button";
      card.className = `room-card${unlocked ? "" : " locked"}${room.id === activeId ? " current" : ""}`;
      card.disabled = !unlocked;
      const stars = record?.stars ?? 0;
      card.innerHTML = `
        <span class="room-name">${index + 1}. ${room.name}</span>
        <span class="room-blurb">${unlocked ? room.blurb : "Clear the room before it to unlock."}</span>
        <span class="room-stats">
          <span>${(record?.bestDistanceM ?? 0).toFixed(1)} m</span>
          <span>best ${record?.bestScore ?? 0}</span>
          <span>grade ${record?.bestGrade ?? "–"}</span>
        </span>
        <span class="room-stars">${"★".repeat(stars)}${"☆".repeat(Math.max(0, 3 - stars))}</span>
        ${unlocked ? "" : '<span class="room-lock">locked</span>'}
      `;
      if (unlocked) card.addEventListener("click", () => onPick(room.id));
      list.appendChild(card);
    });
  }

  // --- result

  showResult(
    result: RunResult,
    room: Room,
    record: { bestDistanceM: number; bestScore: number },
    isNewBest: boolean,
    nextRoom: Room | null,
  ): void {
    byId("result-headline").textContent = result.cleared
      ? "In the basket!"
      : result.status === "crashed"
        ? "Ouch — crumpled"
        : "Short of the basket";
    byId("result-detail").textContent = result.cleared
      ? "Clean landing. That one counts."
      : result.status === "crashed"
        ? "The paper lost that argument."
        : "Steeper dives buy distance — watch the speed.";
    const starWrap = byId("result-stars");
    starWrap.innerHTML =
      "★".repeat(result.starCount) + `<span class="empty">${"★".repeat(3 - result.starCount)}</span>`;
    byId("result-distance").textContent = `${result.distanceM.toFixed(1)} m of ${room.lengthM} m`;
    byId("result-picks").textContent = `${result.clips} clips · ${result.stars} stickers`;
    byId("result-grade").textContent = result.foldGrade;
    byId("result-landing").textContent = result.cleared
      ? "in the basket"
      : result.status === "crashed"
        ? "hit a prop"
        : "on the floor";
    byId("result-score").textContent = String(result.score);
    byId("result-best").textContent = isNewBest
      ? `New best for ${room.name}! Best ${record.bestScore} · ${record.bestDistanceM.toFixed(1)} m`
      : `Best ${record.bestScore} · ${record.bestDistanceM.toFixed(1)} m`;
    const next = byId<HTMLButtonElement>("btn-next");
    next.classList.toggle("hidden", !(result.cleared && nextRoom));
  }

  renderBoard(entries: Array<{ rank: number; name: string; score: number }>): void {
    const wrap = byId("result-board");
    const list = byId<HTMLOListElement>("board-list");
    if (entries.length === 0) {
      wrap.classList.add("hidden");
      return;
    }
    wrap.classList.remove("hidden");
    list.innerHTML = "";
    for (const entry of entries) {
      const li = document.createElement("li");
      li.textContent = `${entry.name} — ${entry.score}`;
      list.appendChild(li);
    }
  }
}
