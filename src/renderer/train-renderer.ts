import { Vec2 } from '../types/topology';
import { Camera } from './camera';
import { COLORS, withAlpha } from '../utils/color';

export class TrainRenderer {
  render(
    ctx: CanvasRenderingContext2D,
    position: Vec2,
    heading: number,
    speed: number,
    brakeMode: 'none' | 'service' | 'emergency',
    camera: Camera,
  ): void {
    ctx.save();
    ctx.translate(position.x, position.y);
    ctx.rotate(heading);

    const length = 40 / camera.zoom;
    const width = 10 / camera.zoom;
    const cornerRadius = 3 / camera.zoom;

    // Train color based on brake mode
    let bodyColor: string;
    let glowColor: string;
    if (brakeMode === 'emergency') {
      bodyColor = COLORS.trainEmergency;
      glowColor = COLORS.trainEmergency;
    } else if (brakeMode === 'service') {
      bodyColor = COLORS.trainBraking;
      glowColor = COLORS.trainBraking;
    } else if (speed < 0.5) {
      bodyColor = COLORS.textSecondary;
      glowColor = COLORS.textSecondary;
    } else {
      bodyColor = COLORS.trainBody;
      glowColor = COLORS.trainBody;
    }

    // Glow
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 12 / camera.zoom;

    // Body — position point is the front of the train, body extends behind
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    this.roundRect(ctx, -length, -width / 2, length, width, cornerRadius);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Outline
    ctx.strokeStyle = withAlpha('#ffffff', 0.3);
    ctx.lineWidth = 0.8 / camera.zoom;
    ctx.beginPath();
    this.roundRect(ctx, -length, -width / 2, length, width, cornerRadius);
    ctx.stroke();

    // Front indicator (direction) — at front (x ≈ 0)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-3 / camera.zoom, 0, 1.5 / camera.zoom, 0, Math.PI * 2);
    ctx.fill();

    // Windows — shifted to match new body position
    ctx.fillStyle = withAlpha('#87ceeb', 0.6);
    const windowW = 3 / camera.zoom;
    const windowH = 4 / camera.zoom;
    for (let i = 0; i < 4; i++) {
      const wx = -length + 8 / camera.zoom + i * 7 / camera.zoom;
      ctx.fillRect(wx, -windowH / 2, windowW, windowH);
    }

    ctx.restore();

    // Speed label above train
    if (camera.zoom > 0.08) {
      const speedKmh = speed * 3.6;
      const labelSize = Math.max(9, 11 / camera.zoom);
      ctx.fillStyle = COLORS.textPrimary;
      ctx.font = `500 ${labelSize}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${speedKmh.toFixed(0)} km/h`, position.x, position.y - 12 / camera.zoom);
    }
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
}
