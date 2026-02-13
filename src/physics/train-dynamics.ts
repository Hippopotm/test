import { TrainState, TrainParameters } from '../types/train';
import { RouteSegment, GradientPoint, Vec2 } from '../types/topology';
import { BrakingCurveSet } from '../types/braking';
import { TrackNetwork } from '../model/track-network';
import { StationStop } from '../model/track-network';
import { BrakingModel } from './braking-model';
import { clamp } from '../utils/math';
import { pointAlongPolyline, polylineLength } from '../utils/math';

export class TrainDynamics {
  private state: TrainState;
  private params: TrainParameters;
  private route: RouteSegment[] = [];
  private routeEdgeIds: string[] = [];
  private network: TrackNetwork;
  private brakingModel: BrakingModel;
  private _lastCurves: BrakingCurveSet | null = null;
  private _finished = false;
  private routeTotalLength = 0;

  // Station stopping
  private stationStops: StationStop[] = [];
  private dwellTime = 20; // seconds dwell at each station

  constructor(params: TrainParameters, network: TrackNetwork, brakingModel: BrakingModel) {
    this.params = params;
    this.network = network;
    this.brakingModel = brakingModel;
    this.state = this.createInitialState();
  }

  private createInitialState(): TrainState {
    return {
      routeEdgeIndex: 0,
      edgeOffset: 0,
      speed: 0,
      acceleration: 0,
      throttle: 0,
      brakeMode: 'none',
      totalDistance: 0,
      distanceToTarget: 0,
      supervisionStatus: 'normal',
      dwellRemaining: 0,
      currentStopIndex: 0,
      nextStationName: '',
    };
  }

  setRoute(route: RouteSegment[]): void {
    this.route = route;
    this.routeEdgeIds = route.map(r => r.edgeId);
    this.routeTotalLength = 0;
    for (const seg of route) {
      this.routeTotalLength += Math.abs(seg.endOffset - seg.startOffset);
    }
    this.stationStops = this.network.getStationStopsAlongRoute(route);
    this.reset();
  }

  setDwellTime(seconds: number): void {
    this.dwellTime = seconds;
  }

  reset(): void {
    this.state = this.createInitialState();
    if (this.stationStops.length > 0) {
      this.state.nextStationName = this.stationStops[0].name;
    }
    this._lastCurves = null;
    this._finished = false;
    // Reset signals
    if (this.route.length > 0) {
      const dir = this.route[0].direction;
      this.network.updateSignalAspects(this.route[0].edgeId, this.routeEdgeIds, dir);
    }
  }

  updateParams(params: TrainParameters): void {
    this.params = params;
    this.brakingModel.updateParams(params);
  }

  update(dt: number): void {
    if (this._finished || this.route.length === 0) return;

    // Handle dwell at station
    if (this.state.dwellRemaining > 0) {
      this.state.dwellRemaining -= dt;
      this.state.speed = 0;
      this.state.acceleration = 0;
      this.state.brakeMode = 'none';
      this.state.throttle = 0;
      if (this.state.dwellRemaining <= 0) {
        this.state.dwellRemaining = 0;
        this.state.currentStopIndex++;
        if (this.state.currentStopIndex >= this.stationStops.length) {
          this._finished = true;
          return;
        }
        this.state.nextStationName = this.stationStops[this.state.currentStopIndex].name;
      }
      return;
    }

    // Compute control (braking/throttle decisions)
    this.computeControl();

    // Check if we've arrived at the next station
    if (this.checkStationArrival()) {
      return;
    }

    // Integrate motion (semi-implicit Euler)
    this.state.speed += this.state.acceleration * dt;
    this.state.speed = clamp(this.state.speed, 0, this.params.maxSpeed);

    const displacement = this.state.speed * dt;
    this.state.totalDistance += displacement;

    // Advance along route
    this.advanceAlongRoute(displacement);

    // Update signal aspects based on current position
    this.updateSignals();
  }

  private checkStationArrival(): boolean {
    if (this.stationStops.length === 0) return false;
    if (this.state.currentStopIndex >= this.stationStops.length) return false;

    const nextStop = this.stationStops[this.state.currentStopIndex];
    const distToStop = nextStop.distanceAlongRoute - this.state.totalDistance;

    // Arrived: close enough and nearly stopped
    if (distToStop < 2.0 && this.state.speed < 0.3) {
      this.state.speed = 0;
      this.state.acceleration = 0;
      this.state.totalDistance = nextStop.distanceAlongRoute;
      this.state.brakeMode = 'none';
      this.state.distanceToTarget = 0;

      if (this.dwellTime > 0) {
        this.state.dwellRemaining = this.dwellTime;
      } else {
        // No dwell: advance to next stop immediately
        this.state.currentStopIndex++;
        if (this.state.currentStopIndex >= this.stationStops.length) {
          this._finished = true;
        } else {
          this.state.nextStationName = this.stationStops[this.state.currentStopIndex].name;
        }
      }
      return true;
    }
    return false;
  }

  private updateSignals(): void {
    if (this.route.length === 0) return;
    const segIndex = Math.min(this.state.routeEdgeIndex, this.route.length - 1);
    const seg = this.route[segIndex];
    this.network.updateSignalAspects(seg.edgeId, this.routeEdgeIds, seg.direction);
  }

  private computeControl(): void {
    if (this.route.length === 0) return;

    const currentSeg = this.route[this.state.routeEdgeIndex];
    if (!currentSeg) {
      this._finished = true;
      return;
    }

    // Calculate distance to target (next station or route end)
    let targetDistance: number;

    if (this.stationStops.length > 0 && this.state.currentStopIndex < this.stationStops.length) {
      const nextStop = this.stationStops[this.state.currentStopIndex];
      targetDistance = Math.max(0, nextStop.distanceAlongRoute - this.state.totalDistance);
    } else {
      // Fallback: target end of route
      let remainingDist = 0;
      const isForward = currentSeg.direction === 'forward';
      remainingDist += isForward
        ? currentSeg.endOffset - this.state.edgeOffset
        : this.state.edgeOffset - currentSeg.endOffset;

      for (let i = this.state.routeEdgeIndex + 1; i < this.route.length; i++) {
        remainingDist += Math.abs(this.route[i].endOffset - this.route[i].startOffset);
      }
      targetDistance = Math.max(0, remainingDist);
    }

    const targetSpeed = 0;

    this.state.distanceToTarget = targetDistance;

    // Get gradient at current position
    const gradient = this.network.getGradientAt(currentSeg.edgeId, this.state.edgeOffset);

    // Get current speed limit
    const speedLimit = this.network.getSpeedLimitAt(currentSeg.edgeId, this.state.edgeOffset);

    // Build gradient profile for braking calculation
    const gradientProfile: GradientPoint[] = [{ offset: 0, slope: gradient }];

    // Compute braking curves
    this._lastCurves = this.brakingModel.computeCurves(
      { targetDistance, targetSpeed, gradient },
      gradientProfile
    );

    // Get supervision status
    const status = this.brakingModel.getSupervisionStatus(
      this.state.speed,
      targetDistance,
      this._lastCurves
    );

    this.state.supervisionStatus = status;

    // Control logic based on supervision status
    const maxReachableSpeed = Math.min(this.params.maxSpeed, speedLimit);

    switch (status) {
      case 'normal':
        // Accelerate toward max speed
        if (this.state.speed < maxReachableSpeed * 0.98) {
          this.state.acceleration = this.params.maxAcceleration;
          this.state.brakeMode = 'none';
          this.state.throttle = 1;
        } else {
          // Maintain speed
          this.state.acceleration = 0;
          this.state.brakeMode = 'none';
          this.state.throttle = 0;
        }
        break;

      case 'indication':
        // Coast
        this.state.acceleration = -0.05; // mild drag
        this.state.brakeMode = 'none';
        this.state.throttle = 0;
        break;

      case 'permitted':
        // Light braking
        this.state.acceleration = -this.params.serviceBrakeDecel * 0.4;
        this.state.brakeMode = 'service';
        this.state.throttle = 0;
        break;

      case 'warning':
        // Full service brake
        this.state.acceleration = -this.params.serviceBrakeDecel;
        this.state.brakeMode = 'service';
        this.state.throttle = 0;
        break;

      case 'intervention':
        // Emergency brake
        this.state.acceleration = -this.params.emergencyBrakeDecel;
        this.state.brakeMode = 'emergency';
        this.state.throttle = 0;
        break;
    }
  }

  private advanceAlongRoute(displacement: number): void {
    if (this.route.length === 0) return;

    let remaining = displacement;
    while (remaining > 0 && this.state.routeEdgeIndex < this.route.length) {
      const seg = this.route[this.state.routeEdgeIndex];
      const isForward = seg.direction === 'forward';
      const distToEnd = isForward
        ? seg.endOffset - this.state.edgeOffset
        : this.state.edgeOffset - seg.endOffset;

      if (remaining >= distToEnd) {
        remaining -= distToEnd;
        this.state.routeEdgeIndex++;
        if (this.state.routeEdgeIndex < this.route.length) {
          this.state.edgeOffset = this.route[this.state.routeEdgeIndex].startOffset;
        } else {
          this.state.edgeOffset = seg.endOffset;
          this.state.speed = 0;
          this._finished = true;
          return;
        }
      } else {
        this.state.edgeOffset += isForward ? remaining : -remaining;
        remaining = 0;
      }
    }
  }

  getWorldPosition(): { pos: Vec2; heading: number } {
    if (this.route.length === 0) return { pos: { x: 0, y: 0 }, heading: 0 };

    const segIndex = Math.min(this.state.routeEdgeIndex, this.route.length - 1);
    const seg = this.route[segIndex];
    const edge = this.network.getEdge(seg.edgeId);
    if (!edge) return { pos: { x: 0, y: 0 }, heading: 0 };

    const polyLen = polylineLength(edge.polyline);
    const t = edge.length > 0 ? this.state.edgeOffset / edge.length : 0;
    const dist = t * polyLen;

    const result = pointAlongPolyline(edge.polyline, dist);

    // Reverse heading if going in reverse direction
    if (seg.direction === 'reverse') {
      result.heading += Math.PI;
    }

    return { pos: result.pos, heading: result.heading };
  }

  getState(): TrainState {
    return { ...this.state };
  }

  getCurves(): BrakingCurveSet | null {
    return this._lastCurves;
  }

  isFinished(): boolean {
    return this._finished;
  }

  getRouteTotalLength(): number {
    return this.routeTotalLength;
  }

  getOccupiedEdgeId(): string | null {
    if (this.route.length === 0) return null;
    const segIndex = Math.min(this.state.routeEdgeIndex, this.route.length - 1);
    return this.route[segIndex].edgeId;
  }

  getStationStops(): StationStop[] {
    return this.stationStops;
  }
}
