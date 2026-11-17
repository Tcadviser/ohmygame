import Phaser from "phaser";
import { SCENES } from "../app.ts";
import { ensurePaperTexture } from "../render/paper.ts";

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  create(): void {
    ensurePaperTexture(this);
    this.scene.start(SCENES.menu);
  }
}
