export interface RailMLInfrastructure {
  tracks: RailMLTrack[];
  switches: RailMLSwitch[];
  signals: RailMLSignal[];
  bufferStops: RailMLBufferStop[];
  stations: RailMLStation[];
}

export interface RailMLTrack {
  id: string;
  name: string;
  length: number;
  beginPos: { x: number; y: number };
  endPos: { x: number; y: number };
  geometrySegments: RailMLGeoSegment[];
  gradientChanges: RailMLGradientChange[];
  signals: RailMLSignal[];
  speedChanges: RailMLSpeedChange[];
}

export interface RailMLGeoSegment {
  pos: number;
  x: number;
  y: number;
  radius?: number;
}

export interface RailMLGradientChange {
  id: string;
  pos: number;
  slope: number;
}

export interface RailMLSpeedChange {
  id: string;
  pos: number;
  vMax: number;
  dir: 'up' | 'down' | 'both';
}

export interface RailMLSwitch {
  id: string;
  pos: number;
  trackRef: string;
  continueCourse: string;
  branchCourse: string;
  orientation: 'incoming' | 'outgoing';
}

export interface RailMLSignal {
  id: string;
  trackRef: string;
  pos: number;
  type: 'main' | 'distant' | 'shunting' | 'speed';
  dir: 'up' | 'down' | 'both';
}

export interface RailMLBufferStop {
  id: string;
  trackRef: string;
  pos: number;
}

export interface RailMLStation {
  id: string;
  name: string;
  tracks: string[];
  pos: { x: number; y: number };
}
