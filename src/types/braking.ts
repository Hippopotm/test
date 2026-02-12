export interface BrakingCurvePoint {
  distance: number;
  speed: number;
}

export type BrakingCurve = BrakingCurvePoint[];

export interface BrakingTarget {
  targetDistance: number;
  targetSpeed: number;
  gradient: number;
}

export interface BrakingCurveSet {
  emergencyBrake: BrakingCurve;
  serviceBrake: BrakingCurve;
  warning: BrakingCurve;
  permitted: BrakingCurve;
  indication: BrakingCurve;
}
