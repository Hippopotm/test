import { TopoNode, TopoEdge, Vec2, PlacedSignal, RouteSegment } from '../types/topology';
import { RailMLStation } from '../types/railml';

export interface StationInfo {
  id: string;
  name: string;
  position: Vec2;
}

export interface StationStop {
  stationId: string;
  name: string;
  distanceAlongRoute: number;
}

export class TrackNetwork {
  readonly nodes: Map<string, TopoNode>;
  readonly edges: Map<string, TopoEdge>;
  readonly stations: StationInfo[];
  private stationNodeMap: Map<string, string>;

  constructor(nodes: TopoNode[], edges: TopoEdge[], stations: RailMLStation[]) {
    this.nodes = new Map(nodes.map(n => [n.id, n]));
    this.edges = new Map(edges.map(e => [e.id, e]));
    this.stations = stations.map(s => ({
      id: s.id,
      name: s.name,
      position: s.pos,
    }));
    this.stationNodeMap = this.buildStationNodeMap();
  }

  private buildStationNodeMap(): Map<string, string> {
    const map = new Map<string, string>();
    for (const station of this.stations) {
      let nearestNodeId = '';
      let nearestDist = Infinity;
      for (const node of this.nodes.values()) {
        const dx = node.position.x - station.position.x;
        const dy = node.position.y - station.position.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < nearestDist) {
          nearestDist = d;
          nearestNodeId = node.id;
        }
      }
      if (nearestNodeId) {
        map.set(station.id, nearestNodeId);
      }
    }
    return map;
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

  generateRouteBetweenStations(fromStationId: string, toStationId: string): RouteSegment[] {
    const fromNodeId = this.stationNodeMap.get(fromStationId);
    const toNodeId = this.stationNodeMap.get(toStationId);
    if (!fromNodeId || !toNodeId) {
      console.warn(`Station node mapping not found for ${fromStationId} or ${toStationId}`);
      return this.generateDefaultRoute();
    }
    const route = this.findPath(fromNodeId, toNodeId);
    if (route.length > 0) return route;
    const reverseRoute = this.findPath(toNodeId, fromNodeId);
    if (reverseRoute.length > 0) return reverseRoute;
    return this.generateDefaultRoute();
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

  findPath(startNodeId: string, endNodeId: string): RouteSegment[] {
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

  getStationStopsAlongRoute(route: RouteSegment[]): StationStop[] {
    if (route.length === 0) return [];

    // Build reverse map: nodeId → station
    const nodeToStation = new Map<string, StationInfo>();
    for (const station of this.stations) {
      const nodeId = this.stationNodeMap.get(station.id);
      if (nodeId) nodeToStation.set(nodeId, station);
    }

    const stops: StationStop[] = [];
    let cumulativeDistance = 0;

    for (let i = 0; i < route.length; i++) {
      const seg = route[i];
      const segLength = Math.abs(seg.endOffset - seg.startOffset);
      const edge = this.edges.get(seg.edgeId);

      // Check station at start of first segment only (origin — skip it, train starts there)
      if (i === 0 && edge) {
        // Don't add the origin station as a stop
      }

      // At end of each segment, check if there's a station
      if (edge) {
        const endNodeId = seg.direction === 'forward' ? edge.endNodeId : edge.startNodeId;
        const station = nodeToStation.get(endNodeId);
        if (station) {
          cumulativeDistance += segLength;
          stops.push({
            stationId: station.id,
            name: station.name,
            distanceAlongRoute: cumulativeDistance,
          });
        } else {
          cumulativeDistance += segLength;
        }
      } else {
        cumulativeDistance += segLength;
      }
    }

    return stops;
  }

  updateSignalAspects(occupiedEdgeId: string | null, routeEdgeIds: string[], direction: 'forward' | 'reverse'): void {
    // Reset all signals to clear
    for (const edge of this.edges.values()) {
      for (const signal of edge.signals) {
        signal.aspect = 'clear';
      }
    }

    if (!occupiedEdgeId) return;

    const occupiedIndex = routeEdgeIds.indexOf(occupiedEdgeId);
    if (occupiedIndex === -1) return;

    const signalDir = direction;

    // Occupied edge: signals facing train direction → stop (RED)
    const occEdge = this.edges.get(occupiedEdgeId);
    if (occEdge) {
      for (const signal of occEdge.signals) {
        if (signal.direction === signalDir) {
          signal.aspect = 'stop';
        }
      }
    }

    // Previous edge: signals facing train direction → caution (YELLOW)
    if (occupiedIndex > 0) {
      const prevEdgeId = routeEdgeIds[occupiedIndex - 1];
      const prevEdge = this.edges.get(prevEdgeId);
      if (prevEdge) {
        for (const signal of prevEdge.signals) {
          if (signal.direction === signalDir) {
            signal.aspect = 'caution';
          }
        }
      }
    }
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
