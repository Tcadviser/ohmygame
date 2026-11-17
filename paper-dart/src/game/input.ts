/** One action map for keyboard, mouse and touch. Scenes only read named actions. */

export interface PointerInfo {
  x: number;
  y: number;
  down: boolean;
  startX: number;
  startY: number;
  /** vertical drag since the press, in screen pixels, positive is downward */
  dragY: number;
  id: number | null;
}

const PITCH_DRAG_PX = 110;

export class InputState {
  readonly keys = new Set<string>();
  readonly pointer: PointerInfo = {
    x: 0,
    y: 0,
    down: false,
    startX: 0,
    startY: 0,
    dragY: 0,
    id: null,
  };
  private pressed = new Set<string>();
  private target: HTMLElement | null = null;
  /** set while a DOM menu owns the screen */
  locked = false;

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) {
      event.preventDefault();
      return;
    }
    this.keys.add(event.code);
    this.pressed.add(event.code);
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
      event.preventDefault();
    }
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private onBlur = (): void => {
    this.keys.clear();
    this.pointer.down = false;
    this.pointer.id = null;
  };

  private updateFromEvent(event: PointerEvent): void {
    const rect = this.target?.getBoundingClientRect();
    this.pointer.x = rect ? event.clientX - rect.left : event.clientX;
    this.pointer.y = rect ? event.clientY - rect.top : event.clientY;
  }

  private onPointerDown = (event: PointerEvent): void => {
    this.updateFromEvent(event);
    if (this.locked) return;
    this.pointer.down = true;
    this.pointer.id = event.pointerId;
    this.pointer.startX = this.pointer.x;
    this.pointer.startY = this.pointer.y;
    this.pointer.dragY = 0;
    this.pressed.add("Pointer");
    this.target?.setPointerCapture?.(event.pointerId);
  };

  private onPointerMove = (event: PointerEvent): void => {
    this.updateFromEvent(event);
    if (this.pointer.down && event.pointerId === this.pointer.id) {
      this.pointer.dragY = this.pointer.y - this.pointer.startY;
    }
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointer.id) return;
    this.updateFromEvent(event);
    this.pointer.down = false;
    this.pointer.id = null;
    this.pointer.dragY = 0;
  };

  attach(target: HTMLElement): void {
    this.target = target;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    target.addEventListener("pointerdown", this.onPointerDown);
    target.addEventListener("pointermove", this.onPointerMove);
    target.addEventListener("pointerup", this.onPointerUp);
    target.addEventListener("pointercancel", this.onPointerUp);
  }

  detach(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    const target = this.target;
    if (target) {
      target.removeEventListener("pointerdown", this.onPointerDown);
      target.removeEventListener("pointermove", this.onPointerMove);
      target.removeEventListener("pointerup", this.onPointerUp);
      target.removeEventListener("pointercancel", this.onPointerUp);
    }
    this.target = null;
  }

  /** True while Space or the pointer is held: the crease and the launch charge. */
  get hold(): boolean {
    return this.keys.has("Space") || this.keys.has("Enter") || this.pointer.down;
  }

  get pitchUpHeld(): boolean {
    return this.keys.has("ArrowUp") || this.keys.has("KeyW");
  }

  get pitchDownHeld(): boolean {
    return this.keys.has("ArrowDown") || this.keys.has("KeyS");
  }

  /**
   * Pitch request, -1 (nose down) to 1 (nose up). Keys give full deflection;
   * a pointer drag gives a proportional one so touch players can hold a shallow glide.
   */
  pitchAxis(): number {
    let axis = 0;
    if (this.pitchUpHeld) axis += 1;
    if (this.pitchDownHeld) axis -= 1;
    if (axis === 0 && this.pointer.down) {
      axis = Math.max(-1, Math.min(1, -this.pointer.dragY / PITCH_DRAG_PX));
    }
    return axis;
  }

  /** Reads and clears a one-shot key press. */
  take(code: string): boolean {
    if (!this.pressed.has(code)) return false;
    this.pressed.delete(code);
    return true;
  }

  endFrame(): void {
    this.pressed.clear();
  }
}

export const input = new InputState();
