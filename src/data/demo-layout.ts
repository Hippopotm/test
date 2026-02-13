// Paris Metro Line 14 — railML data and route presets
// 21 stations from Saint-Denis Pleyel to Aéroport d'Orly (~28.8 km)

export interface RoutePreset {
  id: string;
  name: string;
  description: string;
  fromStationId: string;
  toStationId: string;
}

export const ROUTE_PRESETS: RoutePreset[] = [
  {
    id: 'full',
    name: 'Full Line (2024)',
    description: 'Saint-Denis Pleyel \u2192 A\u00e9roport d\'Orly \u2014 21 stations, 28.8 km',
    fromStationId: 'STA_SDP',
    toStationId: 'STA_ADO',
  },
  {
    id: 'northern',
    name: 'Northern (2020\u20132024)',
    description: 'Mairie de Saint-Ouen \u2192 Olympiades \u2014 13 stations',
    fromStationId: 'STA_MSO',
    toStationId: 'STA_OLY',
  },
  {
    id: 'mid',
    name: 'Mid (2007\u20132020)',
    description: 'Saint-Lazare \u2192 Olympiades \u2014 9 stations',
    fromStationId: 'STA_SL',
    toStationId: 'STA_OLY',
  },
  {
    id: 'pre_south',
    name: 'Pre-South (2003\u20132007)',
    description: 'Saint-Lazare \u2192 Biblioth\u00e8que Fr. Mitterrand \u2014 8 stations',
    fromStationId: 'STA_SL',
    toStationId: 'STA_BFM',
  },
  {
    id: 'original',
    name: 'Original (1998\u20132003)',
    description: 'Madeleine \u2192 Biblioth\u00e8que Fr. Mitterrand \u2014 7 stations',
    fromStationId: 'STA_MAD',
    toStationId: 'STA_BFM',
  },
];

// ---- Station data ----

interface StationDef {
  id: string;
  name: string;
  x: number;
  y: number;
}

const STATIONS: StationDef[] = [
  { id: 'STA_SDP', name: 'Saint-Denis Pleyel',                   x: 1000, y: 200 },
  { id: 'STA_MSO', name: 'Mairie de Saint-Ouen',                 x: 970,  y: 1300 },
  { id: 'STA_SO',  name: 'Saint-Ouen',                           x: 940,  y: 2700 },
  { id: 'STA_PDC', name: 'Porte de Clichy',                      x: 950,  y: 4200 },
  { id: 'STA_PC',  name: 'Pont Cardinet',                        x: 980,  y: 4900 },
  { id: 'STA_SL',  name: 'Saint-Lazare',                         x: 1020, y: 6700 },
  { id: 'STA_MAD', name: 'Madeleine',                            x: 1050, y: 7400 },
  { id: 'STA_PYR', name: 'Pyramides',                            x: 1080, y: 8300 },
  { id: 'STA_CHA', name: 'Ch\u00e2telet',                        x: 1100, y: 9500 },
  { id: 'STA_GDL', name: 'Gare de Lyon',                         x: 1400, y: 12500 },
  { id: 'STA_BER', name: 'Bercy',                                x: 1350, y: 13100 },
  { id: 'STA_CSE', name: 'Cour Saint-\u00c9milion',              x: 1280, y: 14000 },
  { id: 'STA_BFM', name: 'Biblioth\u00e8que Fr. Mitterrand',     x: 1200, y: 14900 },
  { id: 'STA_OLY', name: 'Olympiades',                           x: 1150, y: 15800 },
  { id: 'STA_MB',  name: 'Maison Blanche',                       x: 1120, y: 17100 },
  { id: 'STA_KBH', name: 'Le Kremlin-Bic\u00eatre H\u00f4pital', x: 1100, y: 18600 },
  { id: 'STA_VIG', name: 'Villejuif \u2013 Inst. Gustave-Roussy', x: 1110, y: 20600 },
  { id: 'STA_CTC', name: 'Chevilly Trois Communes',              x: 1120, y: 22400 },
  { id: 'STA_MIN', name: 'M.I.N. Porte de Thiais',              x: 1130, y: 24400 },
  { id: 'STA_PDR', name: 'Pont de Rungis',                       x: 1120, y: 26700 },
  { id: 'STA_ADO', name: 'A\u00e9roport d\'Orly',               x: 1110, y: 29000 },
];

// Inter-station distances (metres)
const SEGMENT_LENGTHS = [
  1100,  // SDP -> MSO
  1400,  // MSO -> SO
  1500,  // SO  -> PDC
  700,   // PDC -> PC
  1800,  // PC  -> SL
  700,   // SL  -> MAD
  900,   // MAD -> PYR
  1200,  // PYR -> CHA
  3000,  // CHA -> GDL (longest - express under central Paris)
  600,   // GDL -> BER
  900,   // BER -> CSE
  900,   // CSE -> BFM
  900,   // BFM -> OLY
  1300,  // OLY -> MB
  1500,  // MB  -> KBH
  2000,  // KBH -> VIG
  1800,  // VIG -> CTC
  2000,  // CTC -> MIN
  2300,  // MIN -> PDR
  2300,  // PDR -> ADO
];

// Gradient profiles per segment (per mille) - metro hump profile
// [pos_fraction, slope] pairs - trains descend from stations, climb to next
const GRADIENT_PROFILES: [number, number][][] = [
  [[0, -20], [0.3, -8], [0.5, 0], [0.7, 12], [0.9, 25]],     // T01
  [[0, -25], [0.3, -10], [0.5, 0], [0.7, 15], [0.9, 30]],    // T02
  [[0, -30], [0.25, -12], [0.5, 0], [0.75, 15], [0.9, 28]],  // T03
  [[0, -15], [0.3, -5], [0.5, 0], [0.7, 8], [0.9, 18]],      // T04
  [[0, -35], [0.25, -15], [0.5, -2], [0.7, 18], [0.9, 35]],  // T05
  [[0, -12], [0.3, -5], [0.5, 0], [0.7, 8], [0.9, 15]],      // T06
  [[0, -20], [0.3, -8], [0.5, 0], [0.7, 12], [0.9, 22]],     // T07
  [[0, -28], [0.3, -10], [0.5, 0], [0.7, 14], [0.9, 30]],    // T08
  [[0, -40], [0.2, -20], [0.4, -5], [0.6, 5], [0.8, 25], [0.95, 40]], // T09 deep
  [[0, -10], [0.3, -4], [0.5, 0], [0.7, 6], [0.9, 12]],      // T10
  [[0, -18], [0.3, -8], [0.5, 0], [0.7, 10], [0.9, 22]],     // T11
  [[0, -20], [0.3, -8], [0.5, 0], [0.7, 12], [0.9, 24]],     // T12
  [[0, -22], [0.3, -8], [0.5, 0], [0.7, 12], [0.9, 25]],     // T13
  [[0, -28], [0.3, -12], [0.5, 0], [0.7, 15], [0.9, 30]],    // T14
  [[0, -30], [0.3, -12], [0.5, 0], [0.75, 15], [0.9, 32]],   // T15
  [[0, -35], [0.25, -15], [0.5, -2], [0.75, 18], [0.9, 38]], // T16
  [[0, -32], [0.3, -12], [0.5, 0], [0.7, 15], [0.9, 35]],    // T17
  [[0, -30], [0.3, -10], [0.5, 0], [0.7, 14], [0.9, 32]],    // T18
  [[0, -25], [0.3, -10], [0.5, 0], [0.7, 12], [0.9, 28]],    // T19
  [[0, -20], [0.3, -8], [0.5, 0], [0.7, 10], [0.9, 22]],     // T20
];

// ---- XML generation helpers ----

function makeTrackXml(index: number): string {
  const trackId = `T${String(index + 1).padStart(2, '0')}`;
  const len = SEGMENT_LENGTHS[index];
  const sFrom = STATIONS[index];
  const sTo = STATIONS[index + 1];
  const name = `${sFrom.name} - ${sTo.name}`;

  const beginEl = index === 0
    ? `<bufferStop id="BS_N"/>`
    : `<connection id="conn_${trackId}_begin" ref="j${index + 1}"/>`;
  const endEl = index === SEGMENT_LENGTHS.length - 1
    ? `<bufferStop id="BS_S"/>`
    : `<connection id="conn_${trackId}_end" ref="j${index + 2}"/>`;

  // Speed: 80 km/h (22.2 m/s) line, 40 km/h (11.1 m/s) station approach
  let speedXml: string;
  if (len > 400) {
    speedXml = `
          <speedChange id="sc_${trackId}_1" pos="0" vMax="11.1" dir="both"/>
          <speedChange id="sc_${trackId}_2" pos="200" vMax="22.2" dir="both"/>
          <speedChange id="sc_${trackId}_3" pos="${len - 200}" vMax="11.1" dir="both"/>`;
  } else {
    speedXml = `
          <speedChange id="sc_${trackId}_1" pos="0" vMax="11.1" dir="both"/>`;
  }

  const gradProfile = GRADIENT_PROFILES[index];
  const gradXml = gradProfile.map(([frac, slope], gi) =>
    `<gradientChange id="gc_${trackId}_${gi + 1}" pos="${Math.round(frac * len)}" slope="${slope}"/>`
  ).join('\n          ');

  const sigXml = `
          <signal id="sig_${trackId}_dep_up" pos="50" type="main" dir="up"/>
          <signal id="sig_${trackId}_app_up" pos="${len - 50}" type="main" dir="up"/>
          <signal id="sig_${trackId}_dep_dn" pos="${len - 50}" type="main" dir="down"/>
          <signal id="sig_${trackId}_app_dn" pos="50" type="main" dir="down"/>`;

  return `
      <track id="${trackId}" name="${name}">
        <trackTopology>
          <trackBegin pos="0">
            ${beginEl}
            <geoCoord coord="${sFrom.x.toFixed(1)} ${sFrom.y.toFixed(1)}"/>
          </trackBegin>
          <trackEnd pos="${len}">
            ${endEl}
            <geoCoord coord="${sTo.x.toFixed(1)} ${sTo.y.toFixed(1)}"/>
          </trackEnd>
        </trackTopology>
        <trackElements>
          <speedChanges>${speedXml}
          </speedChanges>
          <gradientChanges>
          ${gradXml}
          </gradientChanges>
          <signals>${sigXml}
          </signals>
        </trackElements>
      </track>`;
}

function makeStationXml(s: StationDef): string {
  return `
      <ocp id="${s.id}" name="${s.name}">
        <propOperational operationalType="station"/>
        <geoCoord coord="${s.x.toFixed(1)} ${s.y.toFixed(1)}"/>
      </ocp>`;
}

function buildRailML(): string {
  const tracks = SEGMENT_LENGTHS.map((_, i) => makeTrackXml(i)).join('');
  const ocps = STATIONS.map(s => makeStationXml(s)).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<railml version="2.2">
  <infrastructure id="paris-metro-14">
    <tracks>${tracks}
    </tracks>
    <operationControlPoints>${ocps}
    </operationControlPoints>
  </infrastructure>
</railml>`;
}

export const DEMO_RAILML = buildRailML();
