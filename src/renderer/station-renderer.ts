import { Camera } from './camera';
import { StationInfo } from '../model/track-network';
import { COLORS, withAlpha } from '../utils/color';

export class StationRenderer {
  render(ctx: CanvasRenderingContext2D, stations: StationInfo[], camera: Camera): void {
    for (const station of stations) {
      this.drawStation(ctx, station, camera);
    }
  }

  private drawStation(ctx: CanvasRenderingContext2D, station: StationInfo, camera: Camera): void {
    const x = station.position.x;
    const y = station.position.y;
    const w = 200;
    const h = 50;

    // Platform area
    ctx.fillStyle = withAlpha(COLORS.stationPlatform, 0.4);
    ctx.strokeStyle = withAlpha(COLORS.stationPlatform, 0.6);
    ctx.lineWidth = 1 / camera.zoom;

    const rx = x - w / 2;
    const ry = y - h * 1.5;
    ctx.fillRect(rx, ry, w, h);
    ctx.strokeRect(rx, ry, w, h);

    // Station name
    const fontSize = Math.max(10, 14 / camera.zoom);
    ctx.fillStyle = COLORS.stationLabel;
    ctx.font = `600 ${fontSize}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(station.name, x, ry + h / 2);

    // Platform edge indicator
    ctx.strokeStyle = withAlpha(COLORS.warning, 0.5);
    ctx.lineWidth = 2 / camera.zoom;
    ctx.setLineDash([5 / camera.zoom, 3 / camera.zoom]);
    ctx.beginPath();
    ctx.moveTo(rx, ry + h);
    ctx.lineTo(rx + w, ry + h);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
