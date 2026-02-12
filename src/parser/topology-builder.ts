import { RailMLInfrastructure } from '../types/railml';
import { TopoNode, TopoEdge, Vec2, GradientPoint, PlacedSignal, SpeedLimit } from '../types/topology';
import { distance } from '../utils/math';

export class TopologyBuilder {
  build(infra: RailMLInfrastructure): { nodes: TopoNode[]; edges: TopoEdge[] } {
    const nodeMap = new Map<string, TopoNode>();
    const edges: TopoEdge[] = [];

    // Create nodes from track endpoints
    for (const track of infra.tracks) {
      const beginNodeId = `${track.id}_begin`;
      const endNodeId = `${track.id}_end`;

      if (!nodeMap.has(beginNodeId)) {
        nodeMap.set(beginNodeId, {
          id: beginNodeId,
          position: { x: track.beginPos.x, y: track.beginPos.y },
          type: 'endpoint',
          connectedEdges: [],
        });
      }

      if (!nodeMap.has(endNodeId)) {
        nodeMap.set(endNodeId, {
          id: endNodeId,
          position: { x: track.endPos.x, y: track.endPos.y },
          type: 'endpoint',
          connectedEdges: [],
        });
      }

      // Determine node types from buffer stops
      for (const bs of infra.bufferStops) {
        if (bs.trackRef === track.id) {
          if (bs.pos === 0) {
            const node = nodeMap.get(beginNodeId)!;
            node.type = 'buffer';
          } else {
            const node = nodeMap.get(endNodeId)!;
            node.type = 'buffer';
          }
        }
      }

      // Build polyline from geometry
      const polyline = this.buildPolyline(track.geometrySegments, track.length);

      // Build gradient profile
      const gradientProfile: GradientPoint[] = track.gradientChanges.map(gc => ({
        offset: gc.pos,
        slope: gc.slope,
      }));
      if (gradientProfile.length === 0) {
        gradientProfile.push({ offset: 0, slope: 0 });
      }

      // Build signals
      const signals: PlacedSignal[] = track.signals.map(sig => ({
        signalId: sig.id,
        offset: sig.pos,
        direction: sig.dir === 'down' ? 'reverse' as const : 'forward' as const,
        type: sig.type,
        aspect: 'clear' as const,
      }));

      // Build speed limits
      const speedLimits: SpeedLimit[] = [];
      for (let i = 0; i < track.speedChanges.length; i++) {
        const sc = track.speedChanges[i];
        const nextPos = i + 1 < track.speedChanges.length
          ? track.speedChanges[i + 1].pos
          : track.length;
        speedLimits.push({
          startOffset: sc.pos,
          endOffset: nextPos,
          speedMs: sc.vMax,
        });
      }
      if (speedLimits.length === 0) {
        speedLimits.push({ startOffset: 0, endOffset: track.length, speedMs: 33.3 });
      }

      const edgeId = track.id;
      edges.push({
        id: edgeId,
        startNodeId: beginNodeId,
        endNodeId: endNodeId,
        length: track.length,
        polyline,
        gradientProfile,
        signals,
        speedLimits,
      });

      nodeMap.get(beginNodeId)!.connectedEdges.push(edgeId);
      nodeMap.get(endNodeId)!.connectedEdges.push(edgeId);
    }

    // Merge nodes that are at the same position (connection points / switches)
    this.mergeColocatedNodes(nodeMap, edges);

    return {
      nodes: Array.from(nodeMap.values()),
      edges,
    };
  }

  private buildPolyline(geoSegments: { pos: number; x: number; y: number }[], length: number): Vec2[] {
    if (geoSegments.length < 2) {
      return [{ x: 0, y: 0 }, { x: length, y: 0 }];
    }

    const points: Vec2[] = [];
    for (const seg of geoSegments) {
      points.push({ x: seg.x, y: seg.y });
    }

    // Add intermediate points for smoother rendering
    const refined: Vec2[] = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const segDist = distance(points[i - 1], points[i]);
      const steps = Math.max(1, Math.floor(segDist / 50));
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        refined.push({
          x: points[i - 1].x + (points[i].x - points[i - 1].x) * t,
          y: points[i - 1].y + (points[i].y - points[i - 1].y) * t,
        });
      }
    }

    return refined;
  }

  private mergeColocatedNodes(nodeMap: Map<string, TopoNode>, edges: TopoEdge[]): void {
    const nodes = Array.from(nodeMap.values());
    const mergeThreshold = 5.0;
    const mergeMap = new Map<string, string>();

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dist = distance(nodes[i].position, nodes[j].position);
        if (dist < mergeThreshold) {
          const keepId = nodes[i].id;
          const removeId = nodes[j].id;
          mergeMap.set(removeId, keepId);

          // Merge connected edges
          const keepNode = nodeMap.get(keepId)!;
          const removeNode = nodeMap.get(removeId)!;
          for (const edgeId of removeNode.connectedEdges) {
            if (!keepNode.connectedEdges.includes(edgeId)) {
              keepNode.connectedEdges.push(edgeId);
            }
          }

          // Mark as switch if connecting multiple tracks
          if (keepNode.connectedEdges.length > 2) {
            keepNode.type = 'switch';
          }

          // Update edges referencing removed node
          for (const edge of edges) {
            if (edge.startNodeId === removeId) edge.startNodeId = keepId;
            if (edge.endNodeId === removeId) edge.endNodeId = keepId;
          }

          nodeMap.delete(removeId);
        }
      }
    }
  }
}
