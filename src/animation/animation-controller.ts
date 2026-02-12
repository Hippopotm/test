import { TrainDynamics } from '../physics/train-dynamics';
import { CanvasRenderer } from '../renderer/canvas-renderer';

import { BrakingOverlay } from '../renderer/braking-overlay';

export interface AnimationState {
  isPlaying: boolean;
  speedMultiplier: number;
}

export class AnimationController {
  private isPlaying = false;
  private speedMultiplier = 1.0;
  private lastTimestamp = 0;
  private rafId = 0;

  private trainDynamics: TrainDynamics;
  private renderer: CanvasRenderer;
  private brakingOverlay: BrakingOverlay;
  private onFrame: (() => void) | null = null;

  constructor(
    dynamics: TrainDynamics,
    renderer: CanvasRenderer,
    brakingOverlay: BrakingOverlay,
  ) {
    this.trainDynamics = dynamics;
    this.renderer = renderer;
    this.brakingOverlay = brakingOverlay;
  }

  setOnFrame(cb: () => void): void {
    this.onFrame = cb;
  }

  play(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.lastTimestamp = performance.now();
    this.rafId = requestAnimationFrame(this.loop.bind(this));
  }

  pause(): void {
    this.isPlaying = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  stop(): void {
    this.pause();
    this.trainDynamics.reset();
    this.renderFrame();
  }

  step(): void {
    this.trainDynamics.update(0.1 * this.speedMultiplier);
    this.renderFrame();
  }

  setSpeed(multiplier: number): void {
    this.speedMultiplier = multiplier;
  }

  getState(): AnimationState {
    return {
      isPlaying: this.isPlaying,
      speedMultiplier: this.speedMultiplier,
    };
  }

  renderFrame(): void {
    const worldPos = this.trainDynamics.getWorldPosition();
    const state = this.trainDynamics.getState();
    const curves = this.trainDynamics.getCurves();

    this.renderer.render(
      worldPos.pos,
      worldPos.heading,
      state.speed,
      state.brakeMode,
    );

    this.brakingOverlay.resize();
    this.brakingOverlay.render(
      curves,
      state.speed,
      state.distanceToTarget,
      this.trainDynamics.getRouteTotalLength(),
      state.speed + 20,
    );

    if (this.onFrame) this.onFrame();
  }

  private loop(timestamp: number): void {
    const dt = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;

    // Cap dt to prevent physics blowup
    const simDt = Math.min(dt, 0.05) * this.speedMultiplier;

    if (!this.trainDynamics.isFinished()) {
      this.trainDynamics.update(simDt);
    }

    this.renderFrame();

    if (this.trainDynamics.isFinished()) {
      this.isPlaying = false;
      if (this.onFrame) this.onFrame();
      return;
    }

    if (this.isPlaying) {
      this.rafId = requestAnimationFrame(this.loop.bind(this));
    }
  }
}
