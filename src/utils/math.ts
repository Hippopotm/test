import { Vec2 } from '../types/topology';

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function distance(a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angle(a: Vec2, b: Vec2): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

export function lerpVec2(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

export function addVec2(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function subVec2(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scaleVec2(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

export function normalizeVec2(v: Vec2): Vec2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function perpendicularVec2(v: Vec2): Vec2 {
  return { x: -v.y, y: v.x };
}

export function polylineLength(points: Vec2[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += distance(points[i - 1], points[i]);
  }
  return total;
}

export function pointAlongPolyline(points: Vec2[], dist: number): { pos: Vec2; heading: number } {
  if (points.length === 0) return { pos: { x: 0, y: 0 }, heading: 0 };
  if (points.length === 1) return { pos: points[0], heading: 0 };

  let remaining = dist;
  for (let i = 1; i < points.length; i++) {
    const segLen = distance(points[i - 1], points[i]);
    if (remaining <= segLen || i === points.length - 1) {
      const t = segLen > 0 ? clamp(remaining / segLen, 0, 1) : 0;
      return {
        pos: lerpVec2(points[i - 1], points[i], t),
        heading: angle(points[i - 1], points[i]),
      };
    }
    remaining -= segLen;
  }

  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  return { pos: last, heading: angle(prev, last) };
}

export function msToKmh(ms: number): number {
  return ms * 3.6;
}

export function kmhToMs(kmh: number): number {
  return kmh / 3.6;
}
