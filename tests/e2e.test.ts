import { describe, it, expect } from 'vitest';
import { DEMO_RAILML, ROUTE_PRESETS } from '../src/data/demo-layout';
import { RailMLParser } from '../src/parser/railml-parser';
import { TopologyBuilder } from '../src/parser/topology-builder';
import { TrackNetwork } from '../src/model/track-network';
import { BrakingModel } from '../src/physics/braking-model';
import { TrainDynamics } from '../src/physics/train-dynamics';
import { DEFAULT_TRAIN_PARAMS } from '../src/types/train';

describe('End-to-end pipeline', () => {
  it('parses demo railML without errors', () => {
    const parser = new RailMLParser();
    const infra = parser.parse(DEMO_RAILML);

    expect(infra.tracks.length).toBe(20);
    expect(infra.signals.length).toBeGreaterThan(0);
    expect(infra.bufferStops.length).toBe(2);
    expect(infra.stations.length).toBe(21);

    console.log(`Parsed: ${infra.tracks.length} tracks, ${infra.signals.length} signals, ${infra.bufferStops.length} buffer stops, ${infra.stations.length} stations`);
  });

  it('builds topology without errors', () => {
    const parser = new RailMLParser();
    const infra = parser.parse(DEMO_RAILML);

    const builder = new TopologyBuilder();
    const { nodes, edges } = builder.build(infra);

    expect(nodes.length).toBe(21);
    expect(edges.length).toBe(20);

    // Every edge should reference valid nodes
    const nodeIds = new Set(nodes.map(n => n.id));
    for (const edge of edges) {
      expect(nodeIds.has(edge.startNodeId)).toBe(true);
      expect(nodeIds.has(edge.endNodeId)).toBe(true);
      expect(edge.polyline.length).toBeGreaterThanOrEqual(2);
      expect(edge.length).toBeGreaterThan(0);
    }

    // Should have buffer nodes
    const bufferNodes = nodes.filter(n => n.type === 'buffer');
    expect(bufferNodes.length).toBe(2);

    // Line 14 is linear — no switches
    const switchNodes = nodes.filter(n => n.type === 'switch');
    expect(switchNodes.length).toBe(0);

    console.log(`Topology: ${nodes.length} nodes (${bufferNodes.length} buffer, ${switchNodes.length} switch), ${edges.length} edges`);
  });

  it('creates a track network and generates a route', () => {
    const parser = new RailMLParser();
    const infra = parser.parse(DEMO_RAILML);
    const builder = new TopologyBuilder();
    const { nodes, edges } = builder.build(infra);

    const network = new TrackNetwork(nodes, edges, infra.stations);

    const bounds = network.getBounds();
    expect(bounds.max.x).toBeGreaterThan(bounds.min.x);
    expect(bounds.max.y).toBeGreaterThan(bounds.min.y);

    const route = network.generateDefaultRoute();
    expect(route.length).toBe(20);

    // All route edges should exist in the network
    for (const seg of route) {
      const edge = network.getEdge(seg.edgeId);
      expect(edge).toBeDefined();
    }

    const totalLen = route.reduce(
      (sum, seg) => sum + Math.abs(seg.endOffset - seg.startOffset), 0
    );
    expect(totalLen).toBeGreaterThan(25000);
    expect(totalLen).toBeLessThan(32000);

    console.log(`Route: ${route.length} segments, total ${totalLen.toFixed(0)}m`);
  });

  it('generates routes between station pairs', () => {
    const parser = new RailMLParser();
    const infra = parser.parse(DEMO_RAILML);
    const builder = new TopologyBuilder();
    const { nodes, edges } = builder.build(infra);
    const network = new TrackNetwork(nodes, edges, infra.stations);

    // Full line route
    const fullRoute = network.generateRouteBetweenStations('STA_SDP', 'STA_ADO');
    expect(fullRoute.length).toBe(20);

    // Original 1998: Madeleine to BFM
    const originalRoute = network.generateRouteBetweenStations('STA_MAD', 'STA_BFM');
    expect(originalRoute.length).toBeGreaterThan(0);
    expect(originalRoute.length).toBeLessThan(20);

    // Mid route: Saint-Lazare to Olympiades
    const midRoute = network.generateRouteBetweenStations('STA_SL', 'STA_OLY');
    expect(midRoute.length).toBeGreaterThan(originalRoute.length);

    // All presets should produce valid routes
    for (const preset of ROUTE_PRESETS) {
      const route = network.generateRouteBetweenStations(
        preset.fromStationId,
        preset.toStationId
      );
      expect(route.length).toBeGreaterThan(0);
      for (const seg of route) {
        expect(network.getEdge(seg.edgeId)).toBeDefined();
      }
    }
  });

  it('runs train dynamics simulation without errors', () => {
    const parser = new RailMLParser();
    const infra = parser.parse(DEMO_RAILML);
    const builder = new TopologyBuilder();
    const { nodes, edges } = builder.build(infra);
    const network = new TrackNetwork(nodes, edges, infra.stations);

    const params = { ...DEFAULT_TRAIN_PARAMS };
    const brakingModel = new BrakingModel(params);
    const dynamics = new TrainDynamics(params, network, brakingModel);

    const route = network.generateDefaultRoute();
    dynamics.setRoute(route);

    // Run 500 simulation steps
    for (let i = 0; i < 500; i++) {
      dynamics.update(0.1);

      const state = dynamics.getState();
      expect(state.speed).toBeGreaterThanOrEqual(0);
      expect(state.totalDistance).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(state.speed)).toBe(true);
      expect(Number.isFinite(state.acceleration)).toBe(true);

      const worldPos = dynamics.getWorldPosition();
      expect(Number.isFinite(worldPos.pos.x)).toBe(true);
      expect(Number.isFinite(worldPos.pos.y)).toBe(true);
      expect(Number.isFinite(worldPos.heading)).toBe(true);

      if (dynamics.isFinished()) break;
    }

    const finalState = dynamics.getState();
    console.log(`Simulation: ran to ${finalState.totalDistance.toFixed(0)}m, final speed ${(finalState.speed * 3.6).toFixed(1)} km/h, finished=${dynamics.isFinished()}`);
  });

  it('computes braking curves without errors', () => {
    const params = { ...DEFAULT_TRAIN_PARAMS };
    const brakingModel = new BrakingModel(params);

    const curves = brakingModel.computeCurves(
      { targetDistance: 2000, targetSpeed: 0, gradient: 0 },
      [{ offset: 0, slope: 0 }]
    );

    expect(curves.emergencyBrake.length).toBeGreaterThan(0);
    expect(curves.serviceBrake.length).toBeGreaterThan(0);
    expect(curves.warning.length).toBeGreaterThan(0);
    expect(curves.permitted.length).toBeGreaterThan(0);
    expect(curves.indication.length).toBeGreaterThan(0);

    // All curve points should have finite values
    for (const curve of [curves.emergencyBrake, curves.serviceBrake, curves.warning, curves.permitted, curves.indication]) {
      for (const pt of curve) {
        expect(Number.isFinite(pt.distance)).toBe(true);
        expect(Number.isFinite(pt.speed)).toBe(true);
        expect(pt.speed).toBeGreaterThanOrEqual(0);
      }
    }

    // Supervision status should return valid values
    const validStatuses = ['normal', 'indication', 'permitted', 'warning', 'intervention'];
    expect(validStatuses).toContain(brakingModel.getSupervisionStatus(5, 2000, curves));
    expect(validStatuses).toContain(brakingModel.getSupervisionStatus(40, 100, curves));
    // Very slow speed, very far from target should be normal
    expect(brakingModel.getSupervisionStatus(0.1, 5000, curves)).toBe('normal');

    console.log(`Braking curves: EBD ${curves.emergencyBrake.length} pts, SBD ${curves.serviceBrake.length} pts`);
  });

  it('runs full simulation to completion', () => {
    const parser = new RailMLParser();
    const infra = parser.parse(DEMO_RAILML);
    const builder = new TopologyBuilder();
    const { nodes, edges } = builder.build(infra);
    const network = new TrackNetwork(nodes, edges, infra.stations);

    const params = { ...DEFAULT_TRAIN_PARAMS };
    const brakingModel = new BrakingModel(params);
    const dynamics = new TrainDynamics(params, network, brakingModel);

    const route = network.generateDefaultRoute();
    dynamics.setRoute(route);

    let steps = 0;
    const maxSteps = 50000; // Longer route (~28.8km) needs more steps
    let maxSpeed = 0;

    while (!dynamics.isFinished() && steps < maxSteps) {
      dynamics.update(0.05);
      steps++;
      const state = dynamics.getState();
      if (state.speed > maxSpeed) maxSpeed = state.speed;

      // Verify the curves are computed each frame
      const curves = dynamics.getCurves();
      if (curves) {
        expect(curves.emergencyBrake.length).toBeGreaterThan(0);
      }
    }

    const finalState = dynamics.getState();
    console.log(`Full sim: ${steps} steps, max speed ${(maxSpeed * 3.6).toFixed(1)} km/h, total ${finalState.totalDistance.toFixed(0)}m, finished=${dynamics.isFinished()}`);

    // Should have moved some distance
    expect(finalState.totalDistance).toBeGreaterThan(1000);
  });
});
