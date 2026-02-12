import { TopoNode } from '../types/topology';
import { Camera } from './camera';
import { COLORS, withAlpha } from '../utils/color';

export class SwitchRenderer {
  render(ctx: CanvasRenderingContext2D, nodes: TopoNode[], camera: Camera): void {
    for (const node of nodes) {
      if (node.type === 'switch') {
        this.drawSwitch(ctx, node, camera);
      } else if (node.type === 'buffer') {
        this.drawBuffer(ctx, node, camera);
      }
    }
  }

  private drawSwitch(ctx: CanvasRenderingContext2D, node: TopoNode, camera: Camera): void {
    const size = Math.max(4, 6 / camera.zoom);

    // Outer ring
    ctx.strokeStyle = COLORS.switchNormal;
    ctx.lineWidth = 1.5 / camera.zoom;
    ctx.beginPath();
    ctx.arc(node.position.x, node.position.y, size, 0, Math.PI * 2);
    ctx.stroke();

    // Inner dot
    ctx.fillStyle = withAlpha(COLORS.accent, 0.8);
    ctx.beginPath();
    ctx.arc(node.position.x, node.position.y, size * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Label
    if (camera.zoom > 0.25) {
      ctx.fillStyle = COLORS.textMuted;
      ctx.font = `${Math.max(7, 9 / camera.zoom)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(node.id.replace(/_begin|_end/g, '').substring(0, 8), node.position.x, node.position.y - size * 2);
    }
  }

  private drawBuffer(ctx: CanvasRenderingContext2D, node: TopoNode, camera: Camera): void {
    const size = Math.max(4, 6 / camera.zoom);

    // Buffer stop: thick bar
    ctx.strokeStyle = COLORS.danger;
    ctx.lineWidth = 3 / camera.zoom;
    ctx.beginPath();
    ctx.moveTo(node.position.x, node.position.y - size);
    ctx.lineTo(node.position.x, node.position.y + size);
    ctx.stroke();

    // Small cross
    ctx.lineWidth = 1.5 / camera.zoom;
    ctx.beginPath();
    ctx.moveTo(node.position.x - size * 0.5, node.position.y - size * 0.5);
    ctx.lineTo(node.position.x + size * 0.5, node.position.y + size * 0.5);
    ctx.moveTo(node.position.x + size * 0.5, node.position.y - size * 0.5);
    ctx.lineTo(node.position.x - size * 0.5, node.position.y + size * 0.5);
    ctx.stroke();
  }
}
