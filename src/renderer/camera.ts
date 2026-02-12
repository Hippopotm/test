import { Vec2 } from '../types/topology';

export class Camera {
  offsetX: number = 0;
  offsetY: number = 0;
  zoom: number = 1;
  private width: number = 800;
  private height: number = 600;

  setSize(w: number, h: number): void {
    this.width = w;
    this.height = h;
  }

  worldToScreen(world: Vec2): Vec2 {
    return {
      x: (world.x - this.offsetX) * this.zoom + this.width / 2,
      y: (world.y - this.offsetY) * this.zoom + this.height / 2,
    };
  }

  screenToWorld(screen: Vec2): Vec2 {
    return {
      x: (screen.x - this.width / 2) / this.zoom + this.offsetX,
      y: (screen.y - this.height / 2) / this.zoom + this.offsetY,
    };
  }

  fitToBounds(bounds: { min: Vec2; max: Vec2 }): void {
    const bw = bounds.max.x - bounds.min.x;
    const bh = bounds.max.y - bounds.min.y;
    if (bw <= 0 || bh <= 0) return;

    this.offsetX = bounds.min.x + bw / 2;
    this.offsetY = bounds.min.y + bh / 2;
    this.zoom = Math.min(this.width / bw, this.height / bh) * 0.9;
  }

  applyTransform(ctx: CanvasRenderingContext2D): void {
    ctx.translate(this.width / 2, this.height / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.offsetX, -this.offsetY);
  }

  handleZoom(delta: number, screenCenter: Vec2): void {
    const worldBefore = this.screenToWorld(screenCenter);
    const factor = delta > 0 ? 0.9 : 1.1;
    this.zoom = Math.max(0.05, Math.min(20, this.zoom * factor));
    const worldAfter = this.screenToWorld(screenCenter);
    this.offsetX += worldBefore.x - worldAfter.x;
    this.offsetY += worldBefore.y - worldAfter.y;
  }

  handlePan(dx: number, dy: number): void {
    this.offsetX -= dx / this.zoom;
    this.offsetY -= dy / this.zoom;
  }

  getWidth(): number { return this.width; }
  getHeight(): number { return this.height; }
}
