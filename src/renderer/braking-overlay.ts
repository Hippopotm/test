import { BrakingCurveSet } from '../types/braking';
import { COLORS, withAlpha } from '../utils/color';

export class BrakingOverlay {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
  }

  resize(): void {
    const rect = this.canvas.parentElement!.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
  }

  render(
    curves: BrakingCurveSet | null,
    currentSpeed: number,
    distanceToTarget: number,
    maxDistance: number,
    maxSpeed: number,
  ): void {
    const rect = this.canvas.parentElement!.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    // Clear
    this.ctx.clearRect(0, 0, w, h);

    // Background
    this.ctx.fillStyle = 'rgba(15, 25, 35, 0.95)';
    this.ctx.fillRect(0, 0, w, h);

    const margin = { top: 20, right: 15, bottom: 35, left: 50 };
    const chartW = w - margin.left - margin.right;
    const chartH = h - margin.top - margin.bottom;

    if (chartW <= 0 || chartH <= 0) return;

    const maxD = maxDistance > 0 ? maxDistance : 3000;
    const maxV = maxSpeed > 0 ? maxSpeed * 3.6 : 200;

    const toX = (d: number) => margin.left + (d / maxD) * chartW;
    const toY = (v: number) => margin.top + chartH - (v / maxV) * chartH;

    // Grid lines
    this.ctx.strokeStyle = COLORS.grid;
    this.ctx.lineWidth = 0.5;
    for (let d = 0; d <= maxD; d += maxD / 5) {
      const x = toX(d);
      this.ctx.beginPath();
      this.ctx.moveTo(x, margin.top);
      this.ctx.lineTo(x, margin.top + chartH);
      this.ctx.stroke();
    }
    for (let v = 0; v <= maxV; v += maxV / 5) {
      const y = toY(v);
      this.ctx.beginPath();
      this.ctx.moveTo(margin.left, y);
      this.ctx.lineTo(margin.left + chartW, y);
      this.ctx.stroke();
    }

    // Axes
    this.ctx.strokeStyle = COLORS.textMuted;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(margin.left, margin.top);
    this.ctx.lineTo(margin.left, margin.top + chartH);
    this.ctx.lineTo(margin.left + chartW, margin.top + chartH);
    this.ctx.stroke();

    // Axis labels
    this.ctx.fillStyle = COLORS.textMuted;
    this.ctx.font = '10px JetBrains Mono, monospace';

    // X axis labels
    this.ctx.textAlign = 'center';
    for (let d = 0; d <= maxD; d += maxD / 5) {
      this.ctx.fillText(`${(d / 1000).toFixed(1)}`, toX(d), margin.top + chartH + 15);
    }
    this.ctx.fillText('Distance (km)', margin.left + chartW / 2, h - 3);

    // Y axis labels
    this.ctx.textAlign = 'right';
    for (let v = 0; v <= maxV; v += maxV / 5) {
      this.ctx.fillText(`${v.toFixed(0)}`, margin.left - 5, toY(v) + 3);
    }
    this.ctx.save();
    this.ctx.translate(12, margin.top + chartH / 2);
    this.ctx.rotate(-Math.PI / 2);
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Speed (km/h)', 0, 0);
    this.ctx.restore();

    // Draw curves
    if (curves) {
      this.drawCurve(this.ctx, curves.indication, COLORS.curveIndication, toX, toY, maxD, 1.5);
      this.drawCurve(this.ctx, curves.permitted, COLORS.curvePermitted, toX, toY, maxD, 1.5);
      this.drawCurve(this.ctx, curves.warning, COLORS.curveWarning, toX, toY, maxD, 1.5);
      this.drawCurve(this.ctx, curves.serviceBrake, COLORS.curveSBD, toX, toY, maxD, 2);
      this.drawCurve(this.ctx, curves.emergencyBrake, COLORS.curveEBD, toX, toY, maxD, 2);
    }

    // Current position dot
    const cpx = toX(distanceToTarget);
    const cpy = toY(currentSpeed * 3.6);
    if (cpx >= margin.left && cpx <= margin.left + chartW) {
      // Crosshairs
      this.ctx.strokeStyle = withAlpha(COLORS.textPrimary, 0.3);
      this.ctx.lineWidth = 0.5;
      this.ctx.setLineDash([3, 3]);
      this.ctx.beginPath();
      this.ctx.moveTo(cpx, margin.top);
      this.ctx.lineTo(cpx, margin.top + chartH);
      this.ctx.moveTo(margin.left, cpy);
      this.ctx.lineTo(margin.left + chartW, cpy);
      this.ctx.stroke();
      this.ctx.setLineDash([]);

      // Dot
      this.ctx.fillStyle = '#ffffff';
      this.ctx.shadowColor = '#ffffff';
      this.ctx.shadowBlur = 6;
      this.ctx.beginPath();
      this.ctx.arc(cpx, cpy, 4, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
    }

    // Legend
    const legendItems = [
      { label: 'EBD', color: COLORS.curveEBD },
      { label: 'SBD', color: COLORS.curveSBD },
      { label: 'Warning', color: COLORS.curveWarning },
      { label: 'Permitted', color: COLORS.curvePermitted },
      { label: 'Indication', color: COLORS.curveIndication },
    ];

    const legendX = margin.left + 8;
    const legendY = margin.top + 8;
    this.ctx.font = '9px Inter, sans-serif';
    this.ctx.textAlign = 'left';
    legendItems.forEach((item, i) => {
      const y = legendY + i * 14;
      this.ctx.fillStyle = item.color;
      this.ctx.fillRect(legendX, y - 4, 12, 3);
      this.ctx.fillStyle = COLORS.textSecondary;
      this.ctx.fillText(item.label, legendX + 16, y);
    });
  }

  private drawCurve(
    ctx: CanvasRenderingContext2D,
    curve: { distance: number; speed: number }[],
    color: string,
    toX: (d: number) => number,
    toY: (v: number) => number,
    _maxD: number,
    lineWidth: number,
  ): void {
    if (curve.length < 2) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();

    let started = false;
    for (const pt of curve) {
      const x = toX(pt.distance);
      const y = toY(pt.speed * 3.6);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }
}
