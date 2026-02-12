import {
  RailMLInfrastructure,
  RailMLTrack,
  RailMLSignal,
  RailMLBufferStop,
  RailMLStation,
  RailMLGeoSegment,
  RailMLGradientChange,
  RailMLSpeedChange,
  RailMLSwitch,
} from '../types/railml';
import { getAttr, getFloatAttr, getFirstChild, getAllDescendants } from '../utils/xml-helpers';

export class RailMLParser {
  parse(xmlString: string): RailMLInfrastructure {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'application/xml');

    const errorNode = doc.querySelector('parsererror');
    if (errorNode) {
      throw new Error('Invalid XML: ' + errorNode.textContent);
    }

    const infraEl = this.findElement(doc, 'infrastructure');
    if (!infraEl) {
      throw new Error('No <infrastructure> element found in railML document');
    }

    return this.parseInfrastructure(infraEl);
  }

  private findElement(doc: Document, tagName: string): Element | null {
    const el = doc.querySelector(tagName);
    if (el) return el;
    const allElements = doc.getElementsByTagName('*');
    for (let i = 0; i < allElements.length; i++) {
      if (allElements[i].localName === tagName) {
        return allElements[i];
      }
    }
    return null;
  }

  private parseInfrastructure(infraEl: Element): RailMLInfrastructure {
    const tracks = this.parseTracks(infraEl);
    const switches = this.parseSwitches(infraEl);
    const signals = this.collectAllSignals(tracks);
    const bufferStops = this.parseBufferStops(infraEl);
    const stations = this.parseStations(infraEl);
    return { tracks, switches, signals, bufferStops, stations };
  }

  private parseTracks(infraEl: Element): RailMLTrack[] {
    const tracks: RailMLTrack[] = [];
    const trackElements = getAllDescendants(infraEl, 'track');

    for (const trackEl of trackElements) {
      const id = getAttr(trackEl, 'id') || `track_${tracks.length}`;
      const name = getAttr(trackEl, 'name') || id;

      const topoEl = getFirstChild(trackEl, 'trackTopology');
      let beginPos = { x: 0, y: 0 };
      let endPos = { x: 0, y: 0 };
      let length = 0;

      if (topoEl) {
        const beginEl = getFirstChild(topoEl, 'trackBegin');
        const endEl = getFirstChild(topoEl, 'trackEnd');

        if (beginEl) {
          const geoEl = getFirstChild(beginEl, 'geoCoord');
          if (geoEl) beginPos = this.parseGeoCoord(geoEl);
        }

        if (endEl) {
          const geoEl = getFirstChild(endEl, 'geoCoord');
          if (geoEl) endPos = this.parseGeoCoord(geoEl);
          length = getFloatAttr(endEl, 'pos', 0);
        }
      }

      const geometrySegments = this.buildGeometry(beginPos, endPos, length);
      const gradientChanges = this.parseGradients(trackEl);
      const signals = this.parseSignals(trackEl, id);
      const speedChanges = this.parseSpeedChanges(trackEl);

      tracks.push({
        id, name, length, beginPos, endPos,
        geometrySegments, gradientChanges, signals, speedChanges,
      });
    }

    return tracks;
  }

  private parseGeoCoord(el: Element): { x: number; y: number } {
    const coord = getAttr(el, 'coord');
    if (coord) {
      const parts = coord.split(/\s+/);
      if (parts.length >= 2) {
        return { x: parseFloat(parts[0]) || 0, y: parseFloat(parts[1]) || 0 };
      }
    }
    return { x: getFloatAttr(el, 'x', 0), y: getFloatAttr(el, 'y', 0) };
  }

  private buildGeometry(begin: { x: number; y: number }, end: { x: number; y: number }, length: number): RailMLGeoSegment[] {
    return [
      { pos: 0, x: begin.x, y: begin.y },
      { pos: length, x: end.x, y: end.y },
    ];
  }

  private parseGradients(trackEl: Element): RailMLGradientChange[] {
    const gradients: RailMLGradientChange[] = [];
    const els = getAllDescendants(trackEl, 'gradientChange');
    for (const el of els) {
      gradients.push({
        id: getAttr(el, 'id') || `grad_${gradients.length}`,
        pos: getFloatAttr(el, 'pos', 0),
        slope: getFloatAttr(el, 'slope', 0),
      });
    }
    gradients.sort((a, b) => a.pos - b.pos);
    return gradients;
  }

  private parseSignals(trackEl: Element, trackId: string): RailMLSignal[] {
    const signals: RailMLSignal[] = [];
    const els = getAllDescendants(trackEl, 'signal');
    for (const el of els) {
      signals.push({
        id: getAttr(el, 'id') || `sig_${signals.length}`,
        trackRef: trackId,
        pos: getFloatAttr(el, 'pos', 0),
        type: (getAttr(el, 'type') || 'main') as RailMLSignal['type'],
        dir: (getAttr(el, 'dir') || 'both') as RailMLSignal['dir'],
      });
    }
    return signals;
  }

  private parseSpeedChanges(trackEl: Element): RailMLSpeedChange[] {
    const speeds: RailMLSpeedChange[] = [];
    const els = getAllDescendants(trackEl, 'speedChange');
    for (const el of els) {
      speeds.push({
        id: getAttr(el, 'id') || `spd_${speeds.length}`,
        pos: getFloatAttr(el, 'pos', 0),
        vMax: getFloatAttr(el, 'vMax', 33.3),
        dir: (getAttr(el, 'dir') || 'both') as RailMLSpeedChange['dir'],
      });
    }
    speeds.sort((a, b) => a.pos - b.pos);
    return speeds;
  }

  private parseSwitches(infraEl: Element): RailMLSwitch[] {
    const switches: RailMLSwitch[] = [];
    const seen = new Set<string>();
    const switchEls = getAllDescendants(infraEl, 'switch');

    for (const el of switchEls) {
      const id = getAttr(el, 'id');
      if (!id || seen.has(id)) continue;
      seen.add(id);

      let trackRef = '';
      let parentEl: Element | null = el.parentElement;
      while (parentEl) {
        if (parentEl.localName === 'track') {
          trackRef = getAttr(parentEl, 'id') || '';
          break;
        }
        parentEl = parentEl.parentElement;
      }

      switches.push({
        id,
        pos: getFloatAttr(el, 'pos', 0),
        trackRef,
        continueCourse: trackRef,
        branchCourse: '',
        orientation: 'outgoing',
      });
    }

    return switches;
  }

  private parseBufferStops(infraEl: Element): RailMLBufferStop[] {
    const bufferStops: RailMLBufferStop[] = [];
    const els = getAllDescendants(infraEl, 'bufferStop');

    for (const el of els) {
      const id = getAttr(el, 'id') || `bs_${bufferStops.length}`;
      let trackRef = '';
      let pos = 0;

      let parentEl: Element | null = el.parentElement;
      while (parentEl) {
        if (parentEl.localName === 'trackBegin') {
          pos = 0;
        } else if (parentEl.localName === 'trackEnd') {
          pos = getFloatAttr(parentEl, 'pos', 0);
        } else if (parentEl.localName === 'track') {
          trackRef = getAttr(parentEl, 'id') || '';
          break;
        }
        parentEl = parentEl.parentElement;
      }

      bufferStops.push({ id, trackRef, pos });
    }

    return bufferStops;
  }

  private parseStations(infraEl: Element): RailMLStation[] {
    const stations: RailMLStation[] = [];
    const ocpEls = getAllDescendants(infraEl, 'ocp');

    for (const el of ocpEls) {
      const propEl = getFirstChild(el, 'propOperational');
      if (!propEl || getAttr(propEl, 'operationalType') !== 'station') continue;

      const geoEl = getFirstChild(el, 'geoCoord');
      const pos = geoEl ? this.parseGeoCoord(geoEl) : { x: 0, y: 0 };

      stations.push({
        id: getAttr(el, 'id') || `sta_${stations.length}`,
        name: getAttr(el, 'name') || 'Unknown',
        tracks: [],
        pos,
      });
    }

    return stations;
  }

  private collectAllSignals(tracks: RailMLTrack[]): RailMLSignal[] {
    return tracks.flatMap(t => t.signals);
  }
}
