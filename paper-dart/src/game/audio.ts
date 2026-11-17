/**
 * All sound is synthesised in the browser: paper creases, whooshes, chimes and a
 * small generative ukulele-and-marimba loop. No audio files are needed.
 */

type Osc = OscillatorType;

const midi = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private flutterSource: AudioBufferSourceNode | null = null;
  private flutterGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private nextNoteTime = 0;
  private musicStep = 0;
  private muted = false;

  get ready(): boolean {
    return this.ctx !== null;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Creates the audio graph. Must be called from a user gesture on most browsers. */
  unlock(): boolean {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return true;
    }
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return false;
    try {
      this.ctx = new Ctor();
    } catch {
      return false;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.85;
    this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.4;
    this.musicBus.connect(this.master);

    const length = Math.floor(ctx.sampleRate * 1.5);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    this.noise = buffer;
    return true;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.9, this.ctx.currentTime, 0.02);
    }
  }

  private noiseSource(): AudioBufferSourceNode | null {
    if (!this.ctx || !this.noise) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    return src;
  }

  private tone(
    freq: number,
    start: number,
    duration: number,
    gain: number,
    type: Osc = "triangle",
    destination?: AudioNode,
  ): void {
    if (!this.ctx || !this.sfxBus) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(env);
    env.connect(destination ?? this.sfxBus);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  /** A dry crease running along the paper, with a snap when the fold lands. */
  crease(quality: "perfect" | "good" | "rough"): void {
    if (!this.ctx || !this.sfxBus) return;
    const t = this.ctx.currentTime;
    const src = this.noiseSource();
    if (!src) return;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(900, t);
    filter.frequency.exponentialRampToValueAtTime(3200, t + 0.32);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.16, t + 0.06);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    src.connect(filter);
    filter.connect(env);
    env.connect(this.sfxBus);
    src.start(t);
    src.stop(t + 0.5);

    const snap = quality === "perfect" ? 2100 : quality === "good" ? 1500 : 900;
    const snapGain = quality === "perfect" ? 0.18 : quality === "good" ? 0.13 : 0.08;
    this.tone(snap, t + 0.3, 0.14, snapGain, "square");
    if (quality === "perfect") this.tone(snap * 1.5, t + 0.36, 0.16, 0.1, "triangle");
  }

  launch(power: number): void {
    if (!this.ctx || !this.sfxBus) return;
    const t = this.ctx.currentTime;
    const src = this.noiseSource();
    if (!src) return;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 0.9;
    filter.frequency.setValueAtTime(320, t);
    filter.frequency.exponentialRampToValueAtTime(2600, t + 0.3);
    const env = this.ctx.createGain();
    const peak = 0.12 + power * 0.12;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(peak, t + 0.05);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    src.connect(filter);
    filter.connect(env);
    env.connect(this.sfxBus);
    src.start(t);
    src.stop(t + 0.5);
  }

  pickup(kind: "clip" | "star"): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (kind === "clip") {
      this.tone(midi(84), t, 0.12, 0.14, "triangle");
      this.tone(midi(91), t + 0.07, 0.16, 0.12, "triangle");
    } else {
      this.tone(midi(81), t, 0.12, 0.13, "triangle");
      this.tone(midi(85), t + 0.06, 0.12, 0.12, "triangle");
      this.tone(midi(88), t + 0.12, 0.2, 0.13, "triangle");
      this.tone(midi(93), t + 0.18, 0.3, 0.1, "sine");
    }
  }

  crumple(): void {
    if (!this.ctx || !this.sfxBus) return;
    const t = this.ctx.currentTime;
    const src = this.noiseSource();
    if (!src) return;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2600, t);
    filter.frequency.exponentialRampToValueAtTime(600, t + 0.5);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    // crackle: a handful of quick amplitude spikes
    let time = t;
    for (let i = 0; i < 7; i += 1) {
      const at = time + Math.random() * 0.05;
      env.gain.linearRampToValueAtTime(0.06 + Math.random() * 0.14, at);
      env.gain.linearRampToValueAtTime(0.02, at + 0.03);
      time = at + 0.04;
    }
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
    src.connect(filter);
    filter.connect(env);
    env.connect(this.sfxBus);
    src.start(t);
    src.stop(t + 0.7);
    this.tone(110, t + 0.55, 0.2, 0.16, "sine");
  }

  clear(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = [72, 76, 79, 84];
    notes.forEach((n, i) => {
      this.tone(midi(n), t + i * 0.11, 0.5, 0.15, "triangle");
      this.tone(midi(n + 12), t + i * 0.11, 0.25, 0.05, "sine");
    });
    this.tone(midi(60), t, 0.7, 0.12, "sine");
  }

  flutterStart(): void {
    if (!this.ctx || !this.sfxBus || this.flutterSource) return;
    const src = this.noiseSource();
    if (!src) return;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 1.6;
    filter.frequency.value = 1400;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.0;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus);
    src.start();
    this.flutterSource = src;
    this.flutterGain = gain;
  }

  /** speed in m/s, mapped to a flutter bed that swells as the dart goes faster */
  setFlutter(speed: number): void {
    if (!this.ctx || !this.flutterGain) return;
    const level = Math.max(0, Math.min(1, (speed - 3.5) / 9));
    this.flutterGain.gain.setTargetAtTime(0.015 + level * 0.11, this.ctx.currentTime, 0.08);
  }

  flutterStop(): void {
    if (!this.ctx || !this.flutterGain) return;
    this.flutterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    const src = this.flutterSource;
    this.flutterSource = null;
    this.flutterGain = null;
    if (src) {
      window.setTimeout(() => {
        try {
          src.stop();
        } catch {
          /* already stopped */
        }
      }, 300);
    }
  }

  // --- music: a small loop, scheduled a little ahead of the clock

  private static readonly CHORDS = [
    [53, 57, 60, 65],
    [50, 53, 57, 62],
    [46, 50, 53, 58],
    [48, 52, 55, 60],
  ];

  private scheduleStep(step: number, time: number): void {
    if (!this.ctx || !this.musicBus) return;
    const chord = GameAudio.CHORDS[Math.floor(step / 8) % GameAudio.CHORDS.length];
    const inBar = step % 8;
    if (inBar === 0 || inBar === 3 || inBar === 6) {
      const note = chord[inBar === 0 ? 0 : inBar === 3 ? 2 : 3];
      this.pluck(midi(note + 12), time, 0.5, 0.16);
      this.pluck(midi(note + 24), time + 0.01, 0.35, 0.06);
    }
    if (inBar === 0 || inBar === 4) this.bass(midi(chord[0] - 12), time, 0.6, 0.2);
    if (inBar % 2 === 1) this.shaker(time, 0.035);
    if (step % 16 === 14) this.pluck(midi(chord[1] + 12), time, 0.4, 0.09);
  }

  private pluck(freq: number, start: number, duration: number, gain: number): void {
    if (!this.ctx || !this.musicBus) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(3200, start);
    filter.frequency.exponentialRampToValueAtTime(900, start + duration);
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, start);
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(gain, start + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(filter);
    filter.connect(env);
    env.connect(this.musicBus);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  private bass(freq: number, start: number, duration: number, gain: number): void {
    if (!this.ctx || !this.musicBus) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, start);
    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(gain, start + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(env);
    env.connect(this.musicBus);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  private shaker(start: number, gain: number): void {
    if (!this.ctx || !this.musicBus) return;
    const src = this.noiseSource();
    if (!src) return;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 5200;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(gain, start + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, start + 0.09);
    src.connect(filter);
    filter.connect(env);
    env.connect(this.musicBus);
    src.start(start);
    src.stop(start + 0.12);
  }

  musicStart(): void {
    if (!this.ctx || this.musicTimer !== null) return;
    const secondsPerStep = 60 / 90 / 2;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.musicStep = 0;
    const tick = (): void => {
      if (!this.ctx) return;
      while (this.nextNoteTime < this.ctx.currentTime + 0.35) {
        this.scheduleStep(this.musicStep, this.nextNoteTime);
        this.musicStep = (this.musicStep + 1) % 32;
        this.nextNoteTime += secondsPerStep;
      }
    };
    tick();
    this.musicTimer = window.setInterval(tick, 90);
  }

  musicStop(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

export const audio = new GameAudio();
