export interface Vec2 {
  x: number;
  y: number;
}

export interface TopoNode {
  id: string;
  position: Vec2;
  type: 'endpoint' | 'switch' | 'buffer';
  connectedEdges: string[];
}

export interface TopoEdge {
  id: string;
  startNodeId: string;
  endNodeId: string;
  length: number;
  polyline: Vec2[];
  gradientProfile: GradientPoint[];
  signals: PlacedSignal[];
  speedLimits: SpeedLimit[];
}

export interface GradientPoint {
  offset: number;
  slope: number;
}

export interface PlacedSignal {
  signalId: string;
  offset: number;
  direction: 'forward' | 'reverse';
  type: 'main' | 'distant' | 'shunting' | 'speed';
  aspect: 'clear' | 'caution' | 'stop';
}

export interface SpeedLimit {
  startOffset: number;
  endOffset: number;
  speedMs: number;
}

export interface RouteSegment {
  edgeId: string;
  direction: 'forward' | 'reverse';
  startOffset: number;
  endOffset: number;
}
