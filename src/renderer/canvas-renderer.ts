import { Camera } from './camera';
import { GridRenderer } from './grid-renderer';
import { TrackRenderer } from './track-renderer';
import { SignalRenderer } from './signal-renderer';
import { SwitchRenderer } from './switch-renderer';
import { StationRenderer } from './station-renderer';
import { TrainRenderer } from './train-renderer';
import { TrackNetwork } from '../model/track-network';
import { Vec2 } from '../types/topology';
import { COLORS } from '../utils/color';

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  readonly camera: Camera;
  private gridRenderer: GridRenderer;
  private trackRenderer: TrackRenderer;
  private signalRenderer: SignalRenderer;
  private switchRenderer: SwitchRenderer;
  private stationRenderer: StationRenderer;
  private trainRenderer: TrainRenderer;
  private network: TrackNetwork | null = null;

  private isPanning = false;
  private lastMouse: Vec2 = { x: 0, y: 0 };

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.canvas.style.cursor = 'grab';
    container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d')!;
    this.camera = new Camera();
    this.gridRenderer = new GridRenderer();
    this.trackRenderer = new TrackRenderer();
    this.signalRenderer = new SignalRenderer();
    this.switchRenderer = new SwitchRenderer();
    this.stationRenderer = new StationRenderer();
    this.trainRenderer = new TrainRenderer();

    this.setupInteraction();
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());
  }

  setNetwork(network: TrackNetwork): void {
    this.network = network;
    const bounds = network.getBounds();
    this.camera.fitToBounds(bounds);
  }

  setRouteHighlight(edgeIds: string[]): void {
    this.trackRenderer.setHighlight(edgeIds);
  }

  render(
    trainPos: Vec2 | null = null,
    trainHeading: number = 0,
    trainSpeed: number = 0,
    trainBrakeMode: 'none' | 'service' | 'emergency' = 'none',
  ): void {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;

    this.ctx.save();
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clear
    this.ctx.fillStyle = COLORS.background;
    this.ctx.fillRect(0, 0, w, h);

    // Apply camera
    this.ctx.save();
    this.camera.applyTransform(this.ctx);

    if (this.network) {
      const edges = Array.from(this.network.edges.values());
      const nodes = Array.from(this.network.nodes.values());

      // Draw layers back to front
      this.gridRenderer.render(this.ctx, this.camera);
      this.stationRenderer.render(this.ctx, this.network.stations, this.camera);
      this.trackRenderer.render(this.ctx, edges, this.camera);
      this.switchRenderer.render(this.ctx, nodes, this.camera);
      this.signalRenderer.render(this.ctx, edges, this.camera);

      // Draw train
      if (trainPos) {
        this.trainRenderer.render(this.ctx, trainPos, trainHeading, trainSpeed, trainBrakeMode, this.camera);
      }
    }

    this.ctx.restore();

    // Draw HUD elements (screen space)
    this.drawScaleBar(w, h);

    this.ctx.restore();
  }

  handleResize(): void {
    const rect = this.canvas.parentElement!.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.camera.setSize(rect.width, rect.height);
  }

  fitToView(): void {
    if (this.network) {
      this.camera.fitToBounds(this.network.getBounds());
    }
  }

  private setupInteraction(): void {
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.camera.handleZoom(e.deltaY, { x: e.offsetX, y: e.offsetY });
    }, { passive: false });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0 || e.button === 1) {
        this.isPanning = true;
        this.lastMouse = { x: e.offsetX, y: e.offsetY };
        this.canvas.style.cursor = 'grabbing';
      }
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        const dx = e.offsetX - this.lastMouse.x;
        const dy = e.offsetY - this.lastMouse.y;
        this.camera.handlePan(dx, dy);
        this.lastMouse = { x: e.offsetX, y: e.offsetY };
      }
    });

    this.canvas.addEventListener('mouseup', () => {
      this.isPanning = false;
      this.canvas.style.cursor = 'grab';
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.isPanning = false;
      this.canvas.style.cursor = 'grab';
    });
  }

  private drawScaleBar(w: number, h: number): void {
    const barWorldLen = this.calculateNiceScaleLength();
    const barScreenLen = barWorldLen * this.camera.zoom;

    const x = w - barScreenLen - 20;
    const y = h - 25;

    this.ctx.strokeStyle = COLORS.textMuted;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(x + barScreenLen, y);
    this.ctx.moveTo(x, y - 4);
    this.ctx.lineTo(x, y + 4);
    this.ctx.moveTo(x + barScreenLen, y - 4);
    this.ctx.lineTo(x + barScreenLen, y + 4);
    this.ctx.stroke();

    const label = barWorldLen >= 1000 ? `${barWorldLen / 1000} km` : `${barWorldLen} m`;
    this.ctx.fillStyle = COLORS.textMuted;
    this.ctx.font = '10px JetBrains Mono, monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(label, x + barScreenLen / 2, y - 8);
  }

  private calculateNiceScaleLength(): number {
    const targetPixels = 100;
    const worldLen = targetPixels / this.camera.zoom;
    const magnitude = Math.pow(10, Math.floor(Math.log10(worldLen)));
    const normalized = worldLen / magnitude;

    if (normalized < 1.5) return magnitude;
    if (normalized < 3.5) return 2 * magnitude;
    if (normalized < 7.5) return 5 * magnitude;
    return 10 * magnitude;
  }
}
