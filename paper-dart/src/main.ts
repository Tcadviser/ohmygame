import "@fontsource-variable/fredoka";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./theme.css";

import Phaser from "phaser";
import { EV, SCENES, bus, session } from "./app.ts";
import { audio } from "./game/audio.ts";
import { input } from "./game/input.ts";
import { ROOMS, roomById } from "./game/rooms.ts";
import { ProgressStore, boardFor } from "./game/save.ts";
import type { RunResult } from "./game/score.ts";
import { init, type OhMyGame } from "./ohmygame/client.js";
import { BootScene } from "./scenes/BootScene.ts";
import { FlightScene } from "./scenes/FlightScene.ts";
import { FoldScene } from "./scenes/FoldScene.ts";
import { MenuScene } from "./scenes/MenuScene.ts";
import { Ui } from "./ui/hud.ts";

const start = async (): Promise<void> => {
  let booted = false;
  const reportFailure = (what: string, error: unknown): void => {
    if (booted) return;
    const message = error instanceof Error ? error.message : String(error);
    const el = document.getElementById("boot-text");
    if (el) el.textContent = `${what}: ${message}`;
    console.error(what, error);
  };
  window.addEventListener("error", (event) => reportFailure("The game hit an error", event.error ?? event.message));
  window.addEventListener("unhandledrejection", (event) => reportFailure("The game hit an error", event.reason));

  const ui = new Ui({
    onPlay: () => {
      const first = ROOMS.find((r) => store.isUnlocked(r.id)) ?? ROOMS[0];
      void startRoom(first.id);
    },
    onRooms: () => showRooms(),
    onHelp: () => ui.showScreen("screen-help"),
    onBack: () => showTitle(),
    onRetry: () => void retry(),
    onNext: () => void nextRoom(),
    onPause: () => void pause(),
    onResume: () => void resume(),
    onSound: () => {
      audio.unlock();
      audio.setMuted(ui.soundEnabled);
      ui.setSoundLabel(ui.soundEnabled);
    },
    onSignIn: () => {
      void (async () => {
        const ok = await store.signIn();
        ui.toast(ok ? "Signed in — progress follows you" : "Sign-in unavailable here");
        refreshTitle();
      })();
    },
  });

  ui.setSoundLabel(audio.isMuted);

  let sdk: OhMyGame | null = null;
  try {
    sdk = await init({ allowLocalhost: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ui.setBoot("Playing offline — progress stays in this browser. (" + message + ")");
    console.warn("OhMyGame services unavailable", error);
  }
  const store = new ProgressStore(sdk);
  await store.load();

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    backgroundColor: "#22303f",
    audio: { noAudio: true },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: "100%",
      height: "100%",
    },
    render: { antialias: true, powerPreference: "high-performance" },
    scene: [BootScene, MenuScene, FoldScene, FlightScene],
  });

  game.events.once(Phaser.Core.Events.READY, () => {
    input.attach(game.canvas);
  });

  const flightScene = (): FlightScene | null => {
    const scene = game.scene.getScene(SCENES.flight) as unknown as FlightScene | null;
    return scene && game.scene.isActive(SCENES.flight) ? scene : null;
  };

  // --- flow ---------------------------------------------------------------

  function showTitle(): void {
    ui.showScreen("screen-title");
    ui.showHud(null);
    refreshTitle();
    if (!game.scene.isActive(SCENES.menu)) game.scene.start(SCENES.menu);
  }

  function showRooms(): void {
    if (game.scene.isActive(SCENES.fold)) game.scene.stop(SCENES.fold);
    if (game.scene.isActive(SCENES.flight)) game.scene.stop(SCENES.flight);
    ui.renderRooms(store.value, (roomId) => void startRoom(roomId), session.roomId);
    ui.showScreen("screen-rooms");
    ui.showHud(null);
  }

  function refreshTitle(): void {
    ui.setTitleProgress(store.value);
    if (store.signedIn) {
      ui.setSaveNote("Signed in — rooms and scores follow you.", false);
    } else if (store.canSignIn) {
      ui.setSaveNote("Sign in to keep your progress on every device.", true);
    } else if (store.cloudSaves) {
      ui.setSaveNote("Progress is saved to your OhMyGame account.", false);
    } else {
      ui.setSaveNote("Progress is saved in this browser.", false);
    }
  }

  async function startRoom(roomId: string): Promise<void> {
    session.roomId = roomId;
    session.seed = Math.floor(Math.random() * 10000);
    session.result = null;
    session.run = null;
    audio.unlock();
    if (game.scene.isActive(SCENES.menu)) game.scene.stop(SCENES.menu);
    if (game.scene.isActive(SCENES.flight)) game.scene.stop(SCENES.flight);
    if (game.scene.isActive(SCENES.fold)) game.scene.stop(SCENES.fold);
    ui.showScreen(null, "fold");
    ui.setStamps([]);
    game.scene.start(SCENES.fold);
  }

  function startFlight(): void {
    if (game.scene.isActive(SCENES.fold)) game.scene.stop(SCENES.fold);
    if (game.scene.isActive(SCENES.flight)) game.scene.stop(SCENES.flight);
    ui.showScreen(null, "flight");
    ui.setPowerHint("Hold to charge · release to throw");
    game.scene.start(SCENES.flight);
  }

  async function retry(): Promise<void> {
    audio.unlock();
    session.result = null;
    session.run = null;
    ui.showScreen(null, "flight");
    ui.renderBoard([]);
    game.scene.stop(SCENES.flight);
    game.scene.start(SCENES.flight);
  }

  async function nextRoom(): Promise<void> {
    const index = ROOMS.findIndex((r) => r.id === session.roomId);
    const next = ROOMS[index + 1];
    if (next) await startRoom(next.id);
    else showRooms();
  }

  async function pause(): Promise<void> {
    const scene = flightScene();
    if (!scene) return;
    game.scene.pause(SCENES.flight);
    audio.flutterStop();
    ui.showScreen("screen-pause");
  }

  async function resume(): Promise<void> {
    ui.showScreen(null, "flight");
    if (game.scene.isPaused(SCENES.flight)) {
      game.scene.resume(SCENES.flight);
      audio.flutterStart();
    }
  }

  // --- scene events -------------------------------------------------------

  bus.on(EV.foldStep, (info: { index: number; total: number; title: string; hint: string }) => {
    ui.setFoldStep(info.index, info.total, info.title, info.hint);
  });
  bus.on(EV.foldProgress, (progress: number) => {
    ui.setFoldProgress(progress, roomById(session.roomId).creaseBand);
  });
  bus.on(EV.foldPrompt, (text: string) => {
    if (text) ui.setFoldPrompt(text);
  });
  bus.on(EV.foldStamp, (qualities: Parameters<Ui["setStamps"]>[0]) => {
    ui.setStamps(qualities);
  });
  bus.on(EV.foldDone, () => {
    ui.toast(`Dart folded — grade ${session.grade}`);
    startFlight();
  });
  bus.on(EV.flightHud, (hud: Parameters<Ui["setFlightHud"]>[0]) => {
    if (ui.screen === null) ui.setFlightHud(hud);
  });
  bus.on(EV.toast, (text: string) => ui.toast(text));
  let steeringHintShown = false;
  bus.on(EV.flightPhase, (phase: string) => {
    if (phase !== "fly" || steeringHintShown) return;
    steeringHintShown = true;
    ui.toast("Drag up or down to steer · W / S on keyboard");
  });

  bus.on(EV.runEnd, (result: RunResult) => {
    void (async () => {
      const room = roomById(session.roomId);
      const { record, newBest } = store.record(room.id, result);
      await store.save();
      void store.submitScore(room.id, result.score);
      const index = ROOMS.findIndex((r) => r.id === room.id);
      const next = ROOMS[index + 1] ?? null;
      ui.showResult(result, room, record, newBest, next);
      ui.showScreen("screen-result");
      if (newBest && result.cleared) ui.toast("New best score!");
      const entries = await store.topScores(room.id, 5);
      ui.renderBoard(
        entries.map((entry) => ({ rank: entry.rank, name: entry.name ?? "guest", score: entry.score })),
      );
    })();
  });

  // --- global keys --------------------------------------------------------

  window.addEventListener("keydown", (event) => {
    if (event.code === "Escape" || event.code === "KeyP") {
      if (ui.screen === "screen-pause") void resume();
      else if (game.scene.isActive(SCENES.flight) && ui.screen === null) void pause();
    }
    if (event.code === "KeyM") {
      audio.unlock();
      audio.setMuted(ui.soundEnabled);
      ui.setSoundLabel(ui.soundEnabled);
    }
    if (event.code === "Enter" && ui.screen === "screen-result") {
      const button = document.getElementById("btn-retry") as HTMLButtonElement | null;
      button?.click();
    }
  });

  // --- test bridge --------------------------------------------------------

  const bridge = {
    snapshot() {
      const scene = flightScene();
      const base = {
        screen: ui.screen,
        roomId: session.roomId,
        grade: session.grade,
        qualities: session.qualities,
        lastResult: session.result,
      };
      return scene ? { ...base, ...scene.stateSnapshot() } : { ...base, scene: "menu-or-fold" };
    },
    reset() {
      session.result = null;
      session.run = null;
      session.qualities = [];
      session.roomId = ROOMS[0].id;
      game.scene.stop(SCENES.flight);
      game.scene.stop(SCENES.fold);
      showTitle();
      return true;
    },
    setSeed(seed: number) {
      session.seed = seed;
      return session.seed;
    },
    step(ms: number, pitch = 0) {
      const scene = flightScene();
      if (!scene) return false;
      scene.simulate(ms, pitch);
      return true;
    },
    startRoom(roomId: string) {
      void startRoom(roomId);
      return true;
    },
    foldAuto() {
      // deterministic perfect fold for automated checks
      session.qualities = ["perfect", "perfect", "perfect", "perfect", "perfect"];
      session.grade = "S";
      startFlight();
      return session.grade;
    },
  };
  (globalThis as unknown as Record<string, unknown>).__OHMYGAME_PLAYTEST__ = bridge;

  // --- boot ---------------------------------------------------------------

  if (document.fonts) await document.fonts.ready.catch(() => undefined);
  booted = true;
  ui.showScreen("screen-title");
  refreshTitle();
  console.info("Paper Dart ready", { boards: ROOMS.map((r) => r.id), leaderboard: boardFor(ROOMS[0].id) });
};

void start();
