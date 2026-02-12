import { BrakingCurve, BrakingCurveSet, BrakingTarget } from '../types/braking';
import { TrainParameters } from '../types/train';
import { GradientPoint } from '../types/topology';

const G = 9.81;

export class BrakingModel {
  private params: TrainParameters;

  constructor(params: TrainParameters) {
    this.params = params;
  }

  updateParams(params: TrainParameters): void {
    this.params = params;
  }

  computeCurves(target: BrakingTarget, gradientProfile: GradientPoint[]): BrakingCurveSet {
    const { targetDistance, targetSpeed } = target;

    // EBD: Emergency Brake Deceleration
    const emergencyBrake = this.computeBrakingCurve(
      targetSpeed, targetDistance, this.params.emergencyBrakeDecel,
      this.params.reactionTimeEmergency * 0.5, gradientProfile
    );

    // SBD: Service Brake Deceleration
    const serviceBrake = this.computeBrakingCurve(
      targetSpeed, targetDistance, this.params.serviceBrakeDecel,
      this.params.reactionTimeService * 0.5, gradientProfile
    );

    // Warning curve: offset from EBD by warning reaction time
    const warning = this.computeBrakingCurve(
      targetSpeed, targetDistance, this.params.emergencyBrakeDecel,
      this.params.reactionTimeEmergency, gradientProfile
    );

    // Permitted speed curve: SBD offset by driver reaction time
    const permitted = this.computeBrakingCurve(
      targetSpeed, targetDistance, this.params.serviceBrakeDecel,
      this.params.reactionTimeService, gradientProfile
    );

    // Indication curve: furthest from target
    const indication = this.computeBrakingCurve(
      targetSpeed, targetDistance, this.params.serviceBrakeDecel,
      this.params.reactionTimeService + 4.0, gradientProfile
    );

    return { emergencyBrake, serviceBrake, warning, permitted, indication };
  }

  computeBrakingCurve(
    targetSpeed: number,
    targetDistance: number,
    deceleration: number,
    reactionTime: number,
    gradientProfile: GradientPoint[],
  ): BrakingCurve {
    const stepSize = Math.max(1, targetDistance / 500);
    const curve: BrakingCurve = [];

    let d = targetDistance;
    let v = targetSpeed;

    // Integrate backward from target
    curve.push({ distance: d, speed: v });

    while (d > 0) {
      const grad = this.getGradientAt(gradientProfile, d);
      const aEff = this.effectiveDeceleration(deceleration, grad);
      const step = Math.min(stepSize, d);

      // v^2 = v0^2 + 2*a*ds
      const vSquared = v * v + 2 * aEff * step;
      if (vSquared < 0) break;
      v = Math.sqrt(vSquared);

      d -= step;
      curve.unshift({ distance: Math.max(0, d), speed: v });

      // Cap at very high speeds to prevent runaway
      if (v > 120) break;
    }

    // Add reaction time offset: shift all distances backward
    if (reactionTime > 0 && curve.length > 0) {
      const topSpeed = curve[0].speed;
      const reactionDist = topSpeed * reactionTime;
      for (const pt of curve) {
        pt.distance = Math.max(0, pt.distance - reactionDist);
      }
      // Prepend constant speed segment during reaction
      if (curve[0].distance > 0) {
        curve.unshift({ distance: 0, speed: topSpeed });
      }
    }

    return curve;
  }

  private effectiveDeceleration(baseDecel: number, gradientPermille: number): number {
    // Positive gradient (uphill) assists braking; negative (downhill) opposes
    const gradComponent = (G * gradientPermille) / 1000;
    let aEff = (baseDecel + gradComponent) / this.params.rotatingMassFactor;
    return Math.max(0.01, aEff); // Minimum deceleration for safety
  }

  private getGradientAt(profile: GradientPoint[], offset: number): number {
    if (profile.length === 0) return 0;
    let slope = profile[0].slope;
    for (const gp of profile) {
      if (gp.offset <= offset) slope = gp.slope;
      else break;
    }
    return slope;
  }

  getSupervisionStatus(
    currentSpeed: number,
    distanceToTarget: number,
    curves: BrakingCurveSet,
  ): 'normal' | 'indication' | 'permitted' | 'warning' | 'intervention' {
    const speedAtDist = (curve: BrakingCurve): number => {
      if (curve.length === 0) return Infinity;
      for (let i = 0; i < curve.length - 1; i++) {
        if (distanceToTarget >= curve[i].distance && distanceToTarget <= curve[i + 1].distance) {
          const t = (distanceToTarget - curve[i].distance) / (curve[i + 1].distance - curve[i].distance);
          return curve[i].speed + t * (curve[i + 1].speed - curve[i].speed);
        }
      }
      // Extrapolate: if beyond curve, use last or first value
      if (distanceToTarget <= curve[0].distance) return curve[0].speed;
      return curve[curve.length - 1].speed;
    };

    const ebdSpeed = speedAtDist(curves.emergencyBrake);
    const warningSpeed = speedAtDist(curves.warning);
    const permittedSpeed = speedAtDist(curves.permitted);
    const indicationSpeed = speedAtDist(curves.indication);

    if (currentSpeed >= ebdSpeed) return 'intervention';
    if (currentSpeed >= warningSpeed) return 'warning';
    if (currentSpeed >= permittedSpeed) return 'permitted';
    if (currentSpeed >= indicationSpeed) return 'indication';
    return 'normal';
  }

  brakingDistance(fromSpeed: number, toSpeed: number, deceleration: number, gradientPermille: number): number {
    const aEff = this.effectiveDeceleration(deceleration, gradientPermille);
    if (aEff <= 0) return Infinity;
    return Math.max(0, (fromSpeed * fromSpeed - toSpeed * toSpeed) / (2 * aEff));
  }
}
