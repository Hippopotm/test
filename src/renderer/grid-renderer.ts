import { Camera } from './camera';
import { COLORS } from '../utils/color';

export class GridRenderer {
  render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const w = camera.getWidth();
    const h = camera.getHeight();

    // Calculate grid spacing based on zoom level
    let baseSpacing = 100;
    const worldSpacing = baseSpacing;
    const screenSpacing = worldSpacing * camera.zoom;

    // Adjust spacing if too dense or too sparse
    if (screenSpacing < 30) baseSpacing = 500;
    else if (screenSpacing < 60) baseSpacing = 200;
    else if (screenSpacing > 300) baseSpacing = 50;

    const topLeft = camera.screenToWorld({ x: 0, y: 0 });
    const bottomRight = camera.screenToWorld({ x: w, y: h });

    const startX = Math.floor(topLeft.x / baseSpacing) * baseSpacing;
    const startY = Math.floor(topLeft.y / baseSpacing) * baseSpacing;

    ctx.lineWidth = 1 / camera.zoom;

    // Minor grid
    ctx.strokeStyle = COLORS.grid;
    ctx.beginPath();
    for (let x = startX; x <= bottomRight.x; x += baseSpacing) {
      ctx.moveTo(x, topLeft.y);
      ctx.lineTo(x, bottomRight.y);
    }
    for (let y = startY; y <= bottomRight.y; y += baseSpacing) {
      ctx.moveTo(topLeft.x, y);
      ctx.lineTo(bottomRight.x, y);
    }
    ctx.stroke();

    // Major grid (every 5th line)
    const majorSpacing = baseSpacing * 5;
    const majorStartX = Math.floor(topLeft.x / majorSpacing) * majorSpacing;
    const majorStartY = Math.floor(topLeft.y / majorSpacing) * majorSpacing;

    ctx.strokeStyle = COLORS.gridMajor;
    ctx.lineWidth = 1.5 / camera.zoom;
    ctx.beginPath();
    for (let x = majorStartX; x <= bottomRight.x; x += majorSpacing) {
      ctx.moveTo(x, topLeft.y);
      ctx.lineTo(x, bottomRight.y);
    }
    for (let y = majorStartY; y <= bottomRight.y; y += majorSpacing) {
      ctx.moveTo(topLeft.x, y);
      ctx.lineTo(bottomRight.x, y);
    }
    ctx.stroke();
  }
}
