import { TopoNode, TopoEdge, Vec2, PlacedSignal, RouteSegment } from '../types/topology';
import { RailMLStation } from '../types/railml';

export interface StationInfo {
  id: string;
  name: string;
  position: Vec2;
}

export class TrackNetwork {
  readonly nodes: Map<string, TopoNode>;
  readonly edges: Map<string, TopoEdge>;
  readonly stations: StationInfo[];

  constructor(nodes: TopoNode[], edges: TopoEdge[], stations: RailMLStation[]) {
    this.nodes = new Map(nodes.map(n => [n.id, n]));
    this.edges = new Map(edges.map(e => [e.id, e]));
    this.stations = stations.map(s => ({
      id: s.id,
      name: s.name,
      position: s.pos,
    }));
  }

  getEdge(id: string): TopoEdge | undefined {
    return this.edges.get(id);
  }

  getNode(id: string): TopoNode | undefined {
    return this.nodes.get(id);
  }

  getAdjacentEdges(nodeId: string): TopoEdge[] {
    const node = this.nodes.get(nodeId);
    if (!node) return [];
    return node.connectedEdges
      .map(id => this.edges.get(id))
      .filter((e): e is TopoEdge => e !== undefined);
  }

  getBounds(): { min: Vec2; max: Vec2 } {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const edge of this.edges.values()) {
      for (const pt of edge.polyline) {
        if (pt.x < minX) minX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y > maxY) maxY = pt.y;
      }
    }

    if (minX === Infinity) {
      return { min: { x: 0, y: 0 }, max: { x: 1000, y: 500 } };
    }

    const padding = 100;
    return {
      min: { x: minX - padding, y: minY - padding },
      max: { x: maxX + padding, y: maxY + padding },
    };
  }

  getGradientAt(edgeId: string, offset: number): number {
    const edge = this.edges.get(edgeId);
    if (!edge) return 0;
    const profile = edge.gradientProfile;
    if (profile.length === 0) return 0;

    let slope = profile[0].slope;
    for (const gp of profile) {
      if (gp.offset <= offset) slope = gp.slope;
      else break;
    }
    return slope;
  }

  getSpeedLimitAt(edgeId: string, offset: number): number {
    const edge = this.edges.get(edgeId);
    if (!edge) return 33.3;
    for (const sl of edge.speedLimits) {
      if (offset >= sl.startOffset && offset <= sl.endOffset) {
        return sl.speedMs;
      }
    }
    return 33.3;
  }

  getSignalsOnEdge(edgeId: string, direction: 'forward' | 'reverse'): PlacedSignal[] {
    const edge = this.edges.get(edgeId);
    if (!edge) return [];
    return edge.signals.filter(s => s.direction === direction);
  }

  getNextSignalAhead(edgeId: string, offset: number, _direction: 'forward'): { signal: PlacedSignal; distance: number } | null {
    const edge = this.edges.get(edgeId);
    if (!edge) return null;

    const forwardSignals = edge.signals
      .filter(s => s.direction === 'forward' && s.offset > offset)
      .sort((a, b) => a.offset - b.offset);

    if (forwardSignals.length > 0) {
      return {
        signal: forwardSignals[0],
        distance: forwardSignals[0].offset - offset,
      };
    }
    return null;
  }

  generateDefaultRoute(): RouteSegment[] {
    // Find the longest path through the network using buffer-to-buffer
    const edgeList = Array.from(this.edges.values());
    if (edgeList.length === 0) return [];

    // Try to find a path from a buffer node to another buffer node
    const bufferNodes = Array.from(this.nodes.values()).filter(n => n.type === 'buffer');

    if (bufferNodes.length >= 2) {
      const route = this.findPath(bufferNodes[0].id, bufferNodes[bufferNodes.length - 1].id);
      if (route.length > 0) return route;
    }

    // Fallback: just use all edges in order by connected topology
    return this.buildSequentialRoute();
  }

  private findPath(startNodeId: string, endNodeId: string): RouteSegment[] {
    const visited = new Set<string>();
    const queue: { nodeId: string; path: RouteSegment[] }[] = [
      { nodeId: startNodeId, path: [] },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.nodeId === endNodeId && current.path.length > 0) {
        return current.path;
      }

      if (visited.has(current.nodeId)) continue;
      visited.add(current.nodeId);

      const adjacentEdges = this.getAdjacentEdges(current.nodeId);
      for (const edge of adjacentEdges) {
        const isForward = edge.startNodeId === current.nodeId;
        const nextNodeId = isForward ? edge.endNodeId : edge.startNodeId;

        if (!visited.has(nextNodeId)) {
          queue.push({
            nodeId: nextNodeId,
            path: [
              ...current.path,
              {
                edgeId: edge.id,
                direction: isForward ? 'forward' as const : 'reverse' as const,
                startOffset: isForward ? 0 : edge.length,
                endOffset: isForward ? edge.length : 0,
              },
            ],
          });
        }
      }
    }

    return [];
  }

  private buildSequentialRoute(): RouteSegment[] {
    const route: RouteSegment[] = [];
    const visited = new Set<string>();

    // Start with the first edge
    const firstEdge = Array.from(this.edges.values())[0];
    if (!firstEdge) return [];

    const stack = [firstEdge];
    while (stack.length > 0) {
      const edge = stack.pop()!;
      if (visited.has(edge.id)) continue;
      visited.add(edge.id);

      route.push({
        edgeId: edge.id,
        direction: 'forward',
        startOffset: 0,
        endOffset: edge.length,
      });

      // Follow connected edges
      const nextEdges = this.getAdjacentEdges(edge.endNodeId);
      for (const next of nextEdges) {
        if (!visited.has(next.id)) {
          stack.push(next);
        }
      }
    }

    return route;
  }
}
