export interface TrainState {
  routeEdgeIndex: number;
  edgeOffset: number;
  speed: number;
  acceleration: number;
  throttle: number;
  brakeMode: 'none' | 'service' | 'emergency';
  totalDistance: number;
  distanceToTarget: number;
  supervisionStatus: 'normal' | 'indication' | 'permitted' | 'warning' | 'intervention';
}

export interface TrainParameters {
  length: number;
  mass: number;
  maxSpeed: number;
  maxAcceleration: number;
  serviceBrakeDecel: number;
  emergencyBrakeDecel: number;
  rotatingMassFactor: number;
  reactionTimeService: number;
  reactionTimeEmergency: number;
}

export const DEFAULT_TRAIN_PARAMS: TrainParameters = {
  length: 200,
  mass: 400000,
  maxSpeed: 44.4,           // 160 km/h
  maxAcceleration: 0.6,
  serviceBrakeDecel: 0.6,
  emergencyBrakeDecel: 1.0,
  rotatingMassFactor: 1.06,
  reactionTimeService: 3.0,
  reactionTimeEmergency: 1.5,
};

export const TRAIN_PRESETS: Record<string, TrainParameters> = {
  'High-Speed Passenger': {
    length: 200,
    mass: 400000,
    maxSpeed: 83.3,          // 300 km/h
    maxAcceleration: 0.5,
    serviceBrakeDecel: 0.7,
    emergencyBrakeDecel: 1.15,
    rotatingMassFactor: 1.04,
    reactionTimeService: 2.5,
    reactionTimeEmergency: 1.0,
  },
  'Regional Passenger': {
    length: 100,
    mass: 150000,
    maxSpeed: 44.4,          // 160 km/h
    maxAcceleration: 0.8,
    serviceBrakeDecel: 0.8,
    emergencyBrakeDecel: 1.2,
    rotatingMassFactor: 1.06,
    reactionTimeService: 3.0,
    reactionTimeEmergency: 1.5,
  },
  'Heavy Freight': {
    length: 500,
    mass: 2000000,
    maxSpeed: 27.8,          // 100 km/h
    maxAcceleration: 0.2,
    serviceBrakeDecel: 0.3,
    emergencyBrakeDecel: 0.6,
    rotatingMassFactor: 1.10,
    reactionTimeService: 5.0,
    reactionTimeEmergency: 2.5,
  },
};
