import type { OhMyGame } from "../ohmygame/index.ts";
import type { FoldGrade } from "./fold.ts";
import { ROOMS } from "./rooms.ts";
import type { RunResult } from "./score.ts";

export interface RoomRecord {
  bestDistanceM: number;
  bestScore: number;
  stars: number;
  clears: number;
  bestGrade: FoldGrade;
}

export interface Progress {
  version: 1;
  unlocked: string[];
  rooms: Record<string, RoomRecord>;
  runs: number;
}

export const emptyProgress = (): Progress => ({
  version: 1,
  unlocked: [ROOMS[0].id],
  rooms: {},
  runs: 0,
});

export const emptyRecord = (): RoomRecord => ({
  bestDistanceM: 0,
  bestScore: 0,
  stars: 0,
  clears: 0,
  bestGrade: "C",
});

const GRADE_ORDER: FoldGrade[] = ["C", "B", "A", "S"];

const SAVE_KEY = "paper-dart.progress.v1";
export const boardFor = (roomId: string): string => `best-score-${roomId}`;

function isProgress(value: unknown): value is Progress {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<Progress>;
  return p.version === 1 && Array.isArray(p.unlocked) && typeof p.rooms === "object";
}

/** Progress is kept through the OhMyGame SDK so it follows the player between devices. */
export class ProgressStore {
  private game: OhMyGame | null;
  private data: Progress = emptyProgress();

  constructor(game: OhMyGame | null) {
    this.game = game;
  }

  get value(): Progress {
    return this.data;
  }

  get cloudSaves(): boolean {
    return this.game?.storage.cloud ?? false;
  }

  get signedIn(): boolean {
    return Boolean(this.game?.auth.player);
  }

  get canSignIn(): boolean {
    return Boolean(this.game?.auth.available) && !this.game?.auth.player;
  }

  get leaderboardReady(): boolean {
    return Boolean(this.game?.leaderboard.available);
  }

  async load(): Promise<Progress> {
    if (!this.game) return this.data;
    try {
      const stored = await this.game.storage.get(SAVE_KEY);
      if (isProgress(stored)) {
        this.data = { ...emptyProgress(), ...stored };
        // a room unlocked in a newer build should not be missing from an old save
        if (!this.data.unlocked.includes(ROOMS[0].id)) this.data.unlocked.push(ROOMS[0].id);
      }
    } catch (error) {
      console.warn("Could not read the save", error);
    }
    return this.data;
  }

  isUnlocked(roomId: string): boolean {
    return this.data.unlocked.includes(roomId);
  }

  record(roomId: string, result: RunResult): { record: RoomRecord; newBest: boolean } {
    const prev = this.data.rooms[roomId] ?? emptyRecord();
    const next: RoomRecord = { ...prev };
    let newBest = false;
    if (result.distanceM > prev.bestDistanceM) next.bestDistanceM = result.distanceM;
    if (result.score > prev.bestScore) {
      next.bestScore = result.score;
      newBest = true;
    }
    next.stars = Math.max(prev.stars, result.starCount);
    if (result.cleared) next.clears = prev.clears + 1;
    if (GRADE_ORDER.indexOf(result.foldGrade) > GRADE_ORDER.indexOf(prev.bestGrade)) {
      next.bestGrade = result.foldGrade;
    }
    this.data.rooms[roomId] = next;
    this.data.runs += 1;

    if (result.cleared) {
      const index = ROOMS.findIndex((r) => r.id === roomId);
      const nextRoom = ROOMS[index + 1];
      if (nextRoom && !this.data.unlocked.includes(nextRoom.id)) {
        this.data.unlocked.push(nextRoom.id);
      }
    }
    return { record: next, newBest };
  }

  async save(): Promise<void> {
    if (!this.game) return;
    try {
      await this.game.storage.set(SAVE_KEY, this.data);
    } catch (error) {
      console.warn("Could not write the save", error);
    }
  }

  async submitScore(roomId: string, score: number): Promise<void> {
    if (!this.game?.leaderboard.available) return;
    try {
      await this.game.leaderboard.submit(boardFor(roomId), score);
    } catch (error) {
      console.warn("Score not submitted", error);
    }
  }

  async topScores(roomId: string, limit = 5) {
    if (!this.game?.leaderboard.available) return [];
    try {
      return await this.game.leaderboard.top(boardFor(roomId), { limit });
    } catch (error) {
      console.warn("Leaderboard unavailable", error);
      return [];
    }
  }

  async signIn(): Promise<boolean> {
    if (!this.game?.auth.available) return false;
    try {
      await this.game.auth.signIn();
      await this.load();
      return true;
    } catch (error) {
      console.warn("Sign-in cancelled", error);
      return false;
    }
  }
}
