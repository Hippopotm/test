import { TopoEdge, PlacedSignal, Vec2 } from '../types/topology';
import { Camera } from './camera';
import { COLORS } from '../utils/color';
import { pointAlongPolyline } from '../utils/math';

export class SignalRenderer {
  render(ctx: CanvasRenderingContext2D, edges: TopoEdge[], camera: Camera): void {
    for (const edge of edges) {
      for (const signal of edge.signals) {
        const { pos, heading } = pointAlongPolyline(edge.polyline, signal.offset / edge.length * this.polylineLen(edge.polyline));
        this.drawSignal(ctx, pos, heading, signal, camera);
      }
    }
  }

  private polylineLen(pts: Vec2[]): number {
    let len = 0;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x;
      const dy = pts[i].y - pts[i - 1].y;
      len += Math.sqrt(dx * dx + dy * dy);
    }
    return len;
  }

  private drawSignal(ctx: CanvasRenderingContext2D, pos: Vec2, heading: number, signal: PlacedSignal, camera: Camera): void {
    const size = Math.max(6, 10 / camera.zoom);
    const dir = signal.direction === 'forward' ? 1 : -1;

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(heading);

    // Post
    const postLen = size * 2.5;
    ctx.strokeStyle = COLORS.signalPost;
    ctx.lineWidth = 1.5 / camera.zoom;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -dir * postLen);
    ctx.stroke();

    // Signal head
    const headY = -dir * postLen;
    if (signal.type === 'main') {
      // Main signal: circle
      const radius = size * 0.6;

      // Background
      ctx.fillStyle = '#1a1a2e';
      ctx.strokeStyle = COLORS.signalPost;
      ctx.lineWidth = 1 / camera.zoom;
      ctx.beginPath();
      ctx.arc(0, headY, radius * 1.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Aspect light
      const aspectColor = signal.aspect === 'stop' ? COLORS.signalRed
        : signal.aspect === 'caution' ? COLORS.signalYellow
        : COLORS.signalGreen;

      ctx.fillStyle = aspectColor;
      ctx.shadowColor = aspectColor;
      ctx.shadowBlur = 6 / camera.zoom;
      ctx.beginPath();
      ctx.arc(0, headY, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (signal.type === 'distant') {
      // Distant signal: diamond
      const s = size * 0.6;
      ctx.fillStyle = '#1a1a2e';
      ctx.strokeStyle = COLORS.signalPost;
      ctx.lineWidth = 1 / camera.zoom;
      ctx.beginPath();
      ctx.moveTo(0, headY - s * 1.3);
      ctx.lineTo(s * 1.0, headY);
      ctx.lineTo(0, headY + s * 1.3);
      ctx.lineTo(-s * 1.0, headY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      const aspectColor = signal.aspect === 'stop' ? COLORS.signalYellow
        : COLORS.signalGreen;
      ctx.fillStyle = aspectColor;
      ctx.shadowColor = aspectColor;
      ctx.shadowBlur = 4 / camera.zoom;
      ctx.beginPath();
      ctx.moveTo(0, headY - s);
      ctx.lineTo(s * 0.7, headY);
      ctx.lineTo(0, headY + s);
      ctx.lineTo(-s * 0.7, headY);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Signal ID label
    if (camera.zoom > 0.2) {
      ctx.fillStyle = COLORS.textMuted;
      ctx.font = `${Math.max(8, 10 / camera.zoom)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(signal.signalId, 0, headY - size * 1.5);
    }

    ctx.restore();
  }
}
