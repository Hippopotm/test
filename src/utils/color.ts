export const COLORS = {
  background: '#0f1923',
  backgroundLight: '#1a2634',
  grid: '#1e3044',
  gridMajor: '#264060',
  trackBed: '#4a5568',
  trackRail: '#a0aec0',
  trackRailHighlight: '#63b3ed',
  trackSleeper: '#2d3748',
  signalPost: '#718096',
  signalRed: '#fc5c65',
  signalYellow: '#fed330',
  signalGreen: '#26de81',
  switchNormal: '#a0aec0',
  switchBranch: '#718096',
  stationPlatform: '#2d3748',
  stationLabel: '#a0aec0',
  trainBody: '#4299e1',
  trainBraking: '#ed8936',
  trainEmergency: '#fc5c65',
  trainCoasting: '#48bb78',
  textPrimary: '#e2e8f0',
  textSecondary: '#a0aec0',
  textMuted: '#718096',
  panelBg: 'rgba(15, 25, 35, 0.92)',
  panelBorder: '#2d3748',
  accent: '#4299e1',
  accentHover: '#63b3ed',
  danger: '#fc5c65',
  warning: '#fed330',
  success: '#26de81',
  curveEBD: '#fc5c65',
  curveSBD: '#ed8936',
  curveWarning: '#fed330',
  curvePermitted: '#48bb78',
  curveIndication: '#4299e1',
} as const;

export function withAlpha(hex: string, alpha: number): string {
  if (hex.startsWith('rgba')) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
