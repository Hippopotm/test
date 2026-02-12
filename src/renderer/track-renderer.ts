import { TopoEdge } from '../types/topology';
import { Camera } from './camera';
import { COLORS, withAlpha } from '../utils/color';
import { normalizeVec2, perpendicularVec2, subVec2, distance } from '../utils/math';

export class TrackRenderer {
  private highlightEdges: Set<string> = new Set();

  setHighlight(edgeIds: string[]): void {
    this.highlightEdges = new Set(edgeIds);
  }

  render(ctx: CanvasRenderingContext2D, edges: TopoEdge[], camera: Camera): void {
    for (const edge of edges) {
      this.drawEdge(ctx, edge, camera);
    }
  }

  private drawEdge(ctx: CanvasRenderingContext2D, edge: TopoEdge, camera: Camera): void {
    const points = edge.polyline;
    if (points.length < 2) return;

    const isHighlighted = this.highlightEdges.has(edge.id);
    const gaugeHalf = 3.5 / camera.zoom;

    // Draw track bed (wide background)
    ctx.strokeStyle = isHighlighted
      ? withAlpha(COLORS.trackRailHighlight, 0.15)
      : withAlpha(COLORS.trackBed, 0.3);
    ctx.lineWidth = 14 / camera.zoom;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    // Draw sleepers
    if (camera.zoom > 0.15) {
      const sleeperSpacing = Math.max(15, 30 / camera.zoom);
      ctx.strokeStyle = COLORS.trackSleeper;
      ctx.lineWidth = 2.5 / camera.zoom;
      ctx.lineCap = 'butt';

      let accumulated = 0;
      for (let i = 1; i < points.length; i++) {
        const segLen = distance(points[i - 1], points[i]);
        const dir = normalizeVec2(subVec2(points[i], points[i - 1]));
        const perp = perpendicularVec2(dir);

        let pos = (sleeperSpacing - accumulated % sleeperSpacing) % sleeperSpacing;
        while (pos < segLen) {
          const px = points[i - 1].x + dir.x * pos;
          const py = points[i - 1].y + dir.y * pos;

          ctx.beginPath();
          ctx.moveTo(px - perp.x * gaugeHalf * 1.6, py - perp.y * gaugeHalf * 1.6);
          ctx.lineTo(px + perp.x * gaugeHalf * 1.6, py + perp.y * gaugeHalf * 1.6);
          ctx.stroke();

          pos += sleeperSpacing;
        }
        accumulated += segLen;
      }
    }

    // Draw rails (two parallel lines)
    const railColor = isHighlighted ? COLORS.trackRailHighlight : COLORS.trackRail;
    ctx.strokeStyle = railColor;
    ctx.lineWidth = 1.5 / camera.zoom;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const side of [-1, 1]) {
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        let perpX = 0, perpY = 0;
        if (i < points.length - 1) {
          const dir = normalizeVec2(subVec2(points[i + 1], points[i]));
          const perp = perpendicularVec2(dir);
          perpX = perp.x;
          perpY = perp.y;
        } else if (i > 0) {
          const dir = normalizeVec2(subVec2(points[i], points[i - 1]));
          const perp = perpendicularVec2(dir);
          perpX = perp.x;
          perpY = perp.y;
        }

        const px = points[i].x + perpX * gaugeHalf * side;
        const py = points[i].y + perpY * gaugeHalf * side;

        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Glow effect for highlighted track
    if (isHighlighted) {
      ctx.strokeStyle = withAlpha(COLORS.trackRailHighlight, 0.3);
      ctx.lineWidth = 8 / camera.zoom;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
    }
  }
}
