export const PITCH = { length: 105, width: 68 } as const;

export type Point = { x: number; y: number };
export type MediaAlignment = [Point, Point, Point, Point];
export type Side = 'home' | 'away';
export type PitchView = 'full' | 'half' | 'third' | 'box' | 'wide' | 'broadcast' | 'elevated';
export type Orientation = 'horizontal' | 'vertical';
export type MarkerStyle = 'number' | 'shirt' | 'name' | 'compact';
export type PitchTheme = 'stadium' | 'training' | 'mono';
export type Classification = 'VERIFIED' | 'RECONSTRUCTED' | 'HYPOTHETICAL';
export type Easing = 'linear' | 'smooth' | 'ease-in' | 'ease-out';

export const formations = {
  '4-3-3': [['LB', 'LCB', 'RCB', 'RB'], ['LCM', 'DM', 'RCM'], ['LW', 'ST', 'RW']],
  '4-2-3-1': [['LB', 'LCB', 'RCB', 'RB'], ['LDM', 'RDM'], ['LAM', 'AM', 'RAM'], ['ST']],
  '4-4-2': [['LB', 'LCB', 'RCB', 'RB'], ['LM', 'LCM', 'RCM', 'RM'], ['LS', 'RS']],
  '4-1-4-1': [['LB', 'LCB', 'RCB', 'RB'], ['DM'], ['LM', 'LCM', 'RCM', 'RM'], ['ST']],
  '4-2-2-2': [['LB', 'LCB', 'RCB', 'RB'], ['LDM', 'RDM'], ['LAM', 'RAM'], ['LS', 'RS']],
  '4-3-1-2': [['LB', 'LCB', 'RCB', 'RB'], ['LCM', 'DM', 'RCM'], ['AM'], ['LS', 'RS']],
  '3-4-3': [['LCB', 'CB', 'RCB'], ['LWB', 'LCM', 'RCM', 'RWB'], ['LW', 'ST', 'RW']],
  '3-5-2': [['LCB', 'CB', 'RCB'], ['LWB', 'LCM', 'DM', 'RCM', 'RWB'], ['LS', 'RS']],
  '3-4-2-1': [['LCB', 'CB', 'RCB'], ['LWB', 'LCM', 'RCM', 'RWB'], ['LAM', 'RAM'], ['ST']],
  '5-4-1': [['LWB', 'LCB', 'CB', 'RCB', 'RWB'], ['LM', 'LCM', 'RCM', 'RM'], ['ST']],
  '5-3-2': [['LWB', 'LCB', 'CB', 'RCB', 'RWB'], ['LCM', 'DM', 'RCM'], ['LS', 'RS']],
} as const;
export type FormationName = keyof typeof formations;

export const phases = [
  'Defensive organisation', 'High press', 'Mid-block', 'Low block', 'Build-up',
  'Attacking progression', 'Final-third attack', 'Counterattack',
  'Defensive transition', 'Attacking transition', 'Set pieces',
] as const;
export type Phase = (typeof phases)[number];

export type Player = Point & {
  id: string;
  name: string;
  number: number;
  side: Side;
  position: string;
  role: string;
  color?: string;
  highlight?: boolean;
};

export type Ball = Point & { ownerId?: string };

export type ObjectKind =
  | 'arrow' | 'run' | 'pass' | 'shot' | 'dribble' | 'press' | 'recovery' | 'support'
  | 'line' | 'lane' | 'triangle' | 'circle' | 'spotlight' | 'zone' | 'polygon'
  | 'channel' | 'compactness' | 'distance' | 'angle' | 'text' | 'number' | 'freehand';

export type TacticalObject = {
  id: string;
  kind: ObjectKind;
  points: Point[];
  curve?: Point;
  color: string;
  opacity: number;
  thickness: number;
  dashed?: boolean;
  arrowhead?: boolean;
  label?: string;
  hidden?: boolean;
  locked?: boolean;
  space?: 'pitch' | 'media';
  mediaAssetId?: string;
  fillOpacity?: number;
  mediaIn?: number;
  mediaOut?: number;
};

export type MovementPath = {
  id: string;
  action: 'run' | 'pass' | 'shot' | 'dribble' | 'press' | 'recovery' | 'support' | 'ball' | 'shift' | 'formation';
  target: string;
  receiverId?: string;
  objectId?: string;
  from: Point;
  to: Point;
  control?: Point;
  start: number;
  duration: number;
  easing: Easing;
};

export type AnimationTrack = {
  target: string;
  property: 'opacity' | 'scale' | 'visibility';
  keyframes: { time: number; value: number }[];
};

export type Cue = {
  id: string;
  label: string;
  time?: number;
  reveal?: string[];
  hide?: string[];
  highlight?: string[];
  view?: PitchView;
};

export type MatchIdentity = {
  home: string;
  away: string;
  homeShort: string;
  awayShort: string;
  competition: string;
  score: string;
  source: string;
};

export type SourceReference = { label: string; url?: string; retrievedAt?: string; estimated?: boolean };
export type Scene = {
  id: string;
  name: string;
  phase: Phase;
  classification: Classification;
  duration: number;
  notes: string;
  players: Player[];
  ball: Ball;
  objects: TacticalObject[];
  paths: MovementPath[];
  tracks: AnimationTrack[];
  cues: Cue[];
  view: PitchView;
  orientation: Orientation;
  marker: MarkerStyle;
  theme: PitchTheme;
  homeFormation: FormationName;
  awayFormation: FormationName;
  transition: 'cut' | 'fade';
  swapped?: boolean;
  cameraKeys?: { time: number; view: PitchView; orientation: Orientation }[];
  substitutions?: { outgoing: Player; incomingId: string; time: number }[];
  media?: { assetId: string; type: 'image' | 'video'; name: string; frame?: number; alignment?: MediaAlignment; alignmentFrame?: number };
  sourceReference?: SourceReference;
};

export type Project = { version: 1; id: string; name: string; match: MatchIdentity; scenes: Scene[] };

export const teamColors = { home: '#f26472', away: '#70a8fc' };
export const sideInk = { home: '#2c1019', away: '#10213d' };
export const inkColors = ['#defb50', '#ffffff', '#fca75e', '#f26472', '#70a8fc', '#65ebc2'];
export const viewNames: Record<PitchView, string> = {
  full: 'Full pitch', half: 'Attacking half', third: 'Final third', box: 'Penalty area',
  wide: 'Wide tactical', broadcast: 'Broadcast angle', elevated: 'Tactical elevated',
};

export const uid = () => globalThis.crypto?.randomUUID?.() ?? `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
export const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));
export const onPitch = (point: Point) => ({ x: clamp(point.x, 0, PITCH.length), y: clamp(point.y, 0, PITCH.width) });

type RosterEntry = { id?: string; name: string; number: number; position?: string };
const homeRoster: RosterEntry[] = [
  { number: 1, name: 'Eli Mercer' }, { number: 3, name: 'Cameron Dale' }, { number: 4, name: 'Isaac Ford' },
  { number: 5, name: 'Kieran Holt' }, { number: 2, name: 'Jude Marsh' }, { number: 8, name: 'Evan Foster' },
  { number: 6, name: 'Leo Grant' }, { number: 10, name: 'Noah Blake' }, { number: 11, name: 'Finn Cole' },
  { number: 9, name: 'Owen Reeves' }, { number: 7, name: 'Kai Voss' },
];
const awayRoster: RosterEntry[] = [
  { number: 1, name: 'Milo Ellis' }, { number: 2, name: 'Arlo Cross' }, { number: 5, name: 'Oscar Lowe' },
  { number: 4, name: 'Theo Hayes' }, { number: 3, name: 'Lucas Flynn' }, { number: 6, name: 'Max Shaw' },
  { number: 8, name: 'Luca Wells' }, { number: 7, name: 'Axel King' }, { number: 10, name: 'Rory Lane' },
  { number: 11, name: 'Nico Clarke' }, { number: 9, name: 'Ari Quinn' },
];

function rowWidth(roles: readonly string[]) {
  if (roles.length >= 5) return 49;
  if (roles.length === 4) return 46;
  if (roles.some((role) => ['LW', 'RW', 'LWB', 'RWB'].includes(role))) return 44;
  return roles.length === 3 ? 27 : 19;
}

function pitchSlots(side: Side, formation: FormationName) {
  const rows = formations[formation];
  const slots = [{ x: 6, y: 34, position: 'GK' }];
  rows.forEach((row, rowIndex) => {
    row.forEach((position, index) => {
      const base = 18 + (rowIndex / (rows.length - 1)) * 29;
      const width = rowWidth(row);
      const y = row.length === 1 ? 34 : 34 - width / 2 + index * width / (row.length - 1);
      const x = base + (position === 'DM' ? -4 : ['ST', 'LS', 'RS'].includes(position) ? 3 : 0);
      slots.push({ x, y, position });
    });
  });
  return side === 'home' ? slots : slots.map((slot) => ({ ...slot, x: 105 - slot.x, y: 68 - slot.y }));
}

function generalPosition(value: string) {
  const position = value.toUpperCase().replace(/[\s-]/g, '');
  if (/GK|GOALKEEPER/.test(position)) return 'GK';
  if (/BACK|DEFEN|^[LR]?[CW]?B$/.test(position)) return 'DEF';
  if (/MIDFIELD|^[LR]?[ACD]?M$/.test(position)) return 'MID';
  if (/FORWARD|ATTACK|WING|^[LR]?[WS]T?$/.test(position)) return 'ATT';
  return '';
}

export function makeLineup(side: Side, formation: FormationName, roster?: RosterEntry[]): Player[] {
  const available = [...(roster ?? (side === 'home' ? homeRoster : awayRoster))];
  return pitchSlots(side, formation).map((slot, index) => {
    const exact = available.findIndex((entry) => entry.position?.toUpperCase() === slot.position);
    const byLine = available.findIndex((entry) => entry.position && generalPosition(entry.position) === generalPosition(slot.position));
    const unassigned = available.findIndex((entry) => !entry.position);
    const choice = [exact, byLine, unassigned, 0].find((candidate) => candidate >= 0) ?? 0;
    const entry = available.splice(choice, 1)[0] ?? { name: `Player ${index + 1}`, number: index + 1 };
    return { ...slot, id: `${side}-${entry.id ?? index}`, name: entry.name, number: entry.number, side, role: slot.position };
  });
}

export function applyFormation(scene: Scene, side: Side, formation: FormationName): Scene {
  const current = scene.players.filter((player) => player.side === side);
  const available = [...current];
  const updated = pitchSlots(side, formation).map((slot, index) => {
    const exact = available.findIndex((player) => player.position === slot.position);
    const byLine = available.findIndex((player) => generalPosition(player.position) === generalPosition(slot.position));
    const previous = available.splice(Math.max(exact >= 0 ? exact : byLine, 0), 1)[0];
    const player = previous ?? makeLineup(side, formation)[index];
    return { ...player, ...slot, x: scene.swapped ? 105 - slot.x : slot.x, y: scene.swapped ? 68 - slot.y : slot.y, role: slot.position };
  });
  const players = side === 'home' ? [...updated, ...scene.players.filter((player) => player.side === 'away')] : [...scene.players.filter((player) => player.side === 'home'), ...updated];
  return {
    ...scene,
    players,
    [side === 'home' ? 'homeFormation' : 'awayFormation']: formation,
    paths: scene.paths.filter((path) => !current.some((player) => player.id === path.target)),
  };
}

const phaseShapes: Record<Phase, [number, number, number]> = {
  'Defensive organisation': [-2, .82, .78],
  'High press': [13, .94, .75],
  'Mid-block': [5, .76, .78],
  'Low block': [-10, .65, .64],
  'Build-up': [-5, 1.12, .9],
  'Attacking progression': [9, 1.09, 1],
  'Final-third attack': [24, 1.04, .94],
  'Counterattack': [16, 1.05, 1.1],
  'Defensive transition': [-6, .92, .85],
  'Attacking transition': [8, 1.02, 1.08],
  'Set pieces': [29, .8, .96],
};

export function applyPhase(scene: Scene, phase: Phase, side: Side = 'home'): Scene {
  const formed = applyFormation(scene, side, side === 'home' ? scene.homeFormation : scene.awayFormation);
  const [shift, width, depth] = phaseShapes[phase];
  return {
    ...formed,
    phase,
    players: formed.players.map((player) => {
      if (player.side !== side || player.position === 'GK') return player;
      const direction = attackDirection(formed, side);
      const x = player.x + direction * shift + (player.x - (direction === 1 ? 34 : 71)) * (depth - 1);
      return { ...player, ...onPitch({ x, y: 34 + (player.y - 34) * width }) };
    }),
  };
}

export function translatePlayers(players: Player[], ids: ReadonlySet<string>, delta: Point): Player[] {
  const group = players.filter((player) => ids.has(player.id));
  if (!group.length) return players;
  const x = clamp(delta.x, -Math.min(...group.map((player) => player.x)), 105 - Math.max(...group.map((player) => player.x)));
  const y = clamp(delta.y, -Math.min(...group.map((player) => player.y)), 68 - Math.max(...group.map((player) => player.y)));
  return players.map((player) => ids.has(player.id) ? { ...player, x: player.x + x, y: player.y + y } : player);
}

export function swapSides(scene: Scene): Scene {
  const mirror = (p: Point) => ({ x: 105 - p.x, y: 68 - p.y });
  return {
    ...scene,
    swapped: !scene.swapped,
    players: scene.players.map((player) => ({ ...player, ...mirror(player) })),
    ball: { ...scene.ball, ...mirror(scene.ball) },
    objects: scene.objects.map((object) => ({ ...object, points: object.points.map(mirror), curve: object.curve && mirror(object.curve) })),
    paths: scene.paths.map((path) => ({ ...path, from: mirror(path.from), to: mirror(path.to), control: path.control && mirror(path.control) })),
  };
}

export function attackDirection(scene: Pick<Scene, 'swapped'>, side: Side) {
  return (side === 'home') !== Boolean(scene.swapped) ? 1 : -1;
}

export const lerpPoint = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const curvePoint = (a: Point, b: Point, c: Point | undefined, t: number): Point =>
  c ? lerpPoint(lerpPoint(a, c, t), lerpPoint(c, b, t), t) : lerpPoint(a, b, t);

export function defaultCurve(a: Point, b: Point): Point {
  const center = lerpPoint(a, b, 0.5);
  const delta = { x: (a.y - b.y) * .28, y: (b.x - a.x) * .28 };
  const control = { x: center.x + delta.x, y: center.y + delta.y };
  const outside = control.x < 0 || control.x > 105 || control.y < 0 || control.y > 68;
  return onPitch(outside ? { x: center.x - delta.x, y: center.y - delta.y } : control);
}

function ease(t: number, mode: Easing) {
  if (mode === 'smooth') return t * t * (3 - 2 * t);
  if (mode === 'ease-in') return t * t;
  if (mode === 'ease-out') return 1 - (1 - t) ** 2;
  return t;
}

export function trackValue(tracks: AnimationTrack[], target: string, property: AnimationTrack['property'], time: number, fallback: number) {
  const track = tracks.find((item) => item.target === target && item.property === property);
  if (!track?.keyframes.length) return fallback;
  const frames = [...track.keyframes].sort((a, b) => a.time - b.time);
  if (time < frames[0].time) return fallback;
  const nextIndex = frames.findIndex((frame) => frame.time > time);
  if (nextIndex < 0) return frames[frames.length - 1].value;
  const a = frames[nextIndex - 1];
  const b = frames[nextIndex];
  return property === 'visibility' ? a.value : a.value + (b.value - a.value) * ((time - a.time) / (b.time - a.time));
}

export function evaluateScene(scene: Scene, time = 0, cueIndex?: number): Scene {
  const active = [...scene.paths].sort((a, b) => a.start - b.start).filter((path) => time >= path.start);
  const moved = new Map<string, Point>();
  let ball = { ...scene.ball };
  for (const path of active) {
    const t = clamp((time - path.start) / Math.max(path.duration, 0.05), 0, 1);
    const point = curvePoint(path.from, path.to, path.control, ease(t, path.easing));
    if (path.target === 'ball') ball = { ...point, ownerId: t === 1 ? path.receiverId : undefined };
    else moved.set(path.target, point);
  }
  const visible = new Map<string, boolean>();
  const highlights = new Set<string>();
  const camera = [...(scene.cameraKeys ?? [])].sort((a, b) => b.time - a.time).find((key) => key.time <= time);
  let view = camera?.view ?? scene.view;
  if (cueIndex !== undefined) {
    const relevant = scene.cues.slice(0, Math.max(cueIndex + 1, 0));
    for (const cue of relevant) {
      cue.reveal?.forEach((id) => visible.set(id, true));
      cue.hide?.forEach((id) => visible.set(id, false));
      if (cue.highlight) {
        highlights.clear();
        cue.highlight.forEach((id) => highlights.add(id));
      }
      view = cue.view ?? view;
    }
  }
  const players = scene.players.map((player) => ({
    ...player,
    ...moved.get(player.id),
    highlight: player.highlight || highlights.has(player.id),
  }));
  const owner = players.find((player) => player.id === ball.ownerId);
  if (owner) ball = { ...ball, ...onPitch({ x: owner.x + 2 * attackDirection(scene, owner.side), y: owner.y + 1.35 }) };
  return {
    ...scene,
    players,
    ball,
    view,
    orientation: camera?.orientation ?? scene.orientation,
    objects: scene.objects.map((object) => ({
      ...object,
      hidden: visible.has(object.id) ? !visible.get(object.id) : object.hidden,
    })),
  };
}

export const demoMatch: MatchIdentity = {
  home: 'Northbridge FC',
  away: 'Southbank City',
  homeShort: 'NBR',
  awayShort: 'SBC',
  competition: 'Premier Division',
  score: '2–1',
  source: 'Fictional demonstration',
};

export function newScene(from?: Scene): Scene {
  if (from) return { ...structuredClone(from), id: uid(), name: `${from.name} copy` };
  return {
    id: uid(), name: 'Starting Shape', phase: 'Build-up', classification: 'HYPOTHETICAL', duration: 8,
    notes: '', players: [...makeLineup('home', '4-3-3'), ...makeLineup('away', '4-2-3-1')],
    ball: { x: 52.5, y: 34 }, objects: [], paths: [], tracks: [], cues: [],
    view: 'full', orientation: 'horizontal', marker: 'number', theme: 'stadium',
    homeFormation: '4-3-3', awayFormation: '4-2-3-1', transition: 'cut',
  };
}

export function mediaCalibration(points: Point[]) {
  if (points.length !== 4 || points.some(({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 105 || y < 0 || y > 68)) {
    throw new Error('Choose four corners within the footage.');
  }
  const corners = points as MediaAlignment;
  const [nw, ne, se, sw] = corners;
  const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
  const area = corners.reduce((total, current, index) => {
    const next = corners[(index + 1) % 4];
    return total + current.x * next.y - current.y * next.x;
  }, 0);
  if (area < 170 || corners.some((a, i) => cross(a, corners[(i + 1) % 4], corners[(i + 2) % 4]) < 4)) {
    throw new Error('Choose a clear, clockwise pitch outline with four separated corners.');
  }
  const dx1 = ne.x - se.x;
  const dx2 = sw.x - se.x;
  const dy1 = ne.y - se.y;
  const dy2 = sw.y - se.y;
  const sx = nw.x - ne.x + se.x - sw.x;
  const sy = nw.y - ne.y + se.y - sw.y;
  const determinant = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / determinant;
  const h = (dx1 * sy - sx * dy1) / determinant;
  if (Math.min(1 + g, 1 + h, 1 + g + h) < .025) throw new Error('This camera angle is too shallow to align safely.');
  const a = ne.x - nw.x + g * ne.x;
  const b = sw.x - nw.x + h * sw.x;
  const d = ne.y - nw.y + g * ne.y;
  const e = sw.y - nw.y + h * sw.y;
  return {
    corners,
    toMedia({ x, y }: Point): Point {
      const u = x / PITCH.length;
      const v = y / PITCH.width;
      const z = 1 + g * u + h * v;
      return { x: (a * u + b * v + nw.x) / z, y: (d * u + e * v + nw.y) / z };
    },
    toPitch({ x, y }: Point): Point | undefined {
      const ax = a - g * x;
      const bx = b - h * x;
      const ay = d - g * y;
      const by = e - h * y;
      const z = ax * by - bx * ay;
      if (Math.abs(z) < 1e-5) return;
      return {
        x: PITCH.length * ((x - nw.x) * by - (y - nw.y) * bx) / z,
        y: PITCH.width * (ax * (y - nw.y) - ay * (x - nw.x)) / z,
      };
    },
  };
}

export function tryMediaCalibration(points?: Point[]) {
  if (!points) return undefined;
  try {
    return mediaCalibration(points);
  } catch {
    return undefined;
  }
}

export function objectOnSurface(object: TacticalObject, scene: Scene, media: boolean) {
  if (object.space === 'media') return media && (!object.mediaAssetId || object.mediaAssetId === scene.media?.assetId);
  if (object.space === 'pitch') return !media;
  return true;
}

export function objectAtFootageTime(object: TacticalObject, time: number) {
  return (object.mediaIn === undefined || time >= object.mediaIn) && (object.mediaOut === undefined || time <= object.mediaOut);
}

function mediaShape(object: TacticalObject): Pick<TacticalObject, 'points' | 'kind' | 'fillOpacity'> {
  const { points, kind, curve } = object;
  const [a, b = a, c] = points;
  if (kind === 'circle' || kind === 'spotlight') {
    const radius = Math.max(Math.hypot(b.x - a.x, b.y - a.y), 2);
    const contour = Array.from({ length: 40 }, (_, i) => {
      const angle = Math.PI * i / 20;
      return { x: a.x + radius * Math.cos(angle), y: a.y + radius * Math.sin(angle) };
    });
    return { points: contour, kind: 'polygon', fillOpacity: kind === 'spotlight' ? .13 : 0 };
  }
  if (kind === 'lane') {
    const length = Math.max(Math.hypot(b.x - a.x, b.y - a.y), .1);
    const x = (a.y - b.y) / length * 1.9;
    const y = (b.x - a.x) / length * 1.9;
    return { points: [{ x: a.x + x, y: a.y + y }, { x: b.x + x, y: b.y + y }, { x: b.x - x, y: b.y - y }, { x: a.x - x, y: a.y - y }], kind: 'polygon', fillOpacity: .38 };
  }
  if (kind === 'zone' || kind === 'channel') {
    return { points: [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }], kind: 'polygon', fillOpacity: kind === 'zone' ? .38 : .22 };
  }
  if (kind === 'angle' || (kind === 'triangle' && !c)) return { points: [a, b, c ?? { x: a.x, y: b.y }], kind };
  if (curve) return { points: Array.from({ length: 25 }, (_, i) => curvePoint(a, b, curve, i / 24)), kind };
  return { points, kind, fillOpacity: object.fillOpacity };
}

export function reconstructMediaScene(scene: Scene): Scene {
  const media = scene.media;
  const calibration = tryMediaCalibration(media?.alignment);
  if (!media || !calibration) throw new Error('Align the footage before mapping its markings.');
  const frame = media.alignmentFrame ?? media.frame ?? 0;
  let omitted = 0;
  const objects = scene.objects.filter((object) => objectOnSurface(object, scene, true) && objectAtFootageTime(object, frame)).flatMap((object) => {
    const shape = mediaShape(object);
    const projected = shape.points.map(calibration.toPitch);
    if (projected.some((point) => !point || point.x < -.15 || point.x > 105.15 || point.y < -.15 || point.y > 68.15)) {
      omitted += 1;
      return [];
    }
    return [{
      ...object, ...shape, points: projected.map((point) => onPitch(point!)), id: uid(), curve: undefined,
      space: 'pitch' as const, mediaAssetId: undefined, mediaIn: undefined, mediaOut: undefined,
    }];
  });
  return {
    ...newScene(scene), name: `${scene.name} · Pitch reconstruction`, classification: 'RECONSTRUCTED',
    media: undefined, view: 'full', orientation: 'horizontal', cameraKeys: [], paths: [], tracks: [], cues: [], objects,
    notes: [
      scene.notes,
      `Manual four-corner footage alignment${media.type === 'video' ? ` at ${frame.toFixed(2)} s` : ''}. Player positions are editable estimates.`,
      omitted ? `${omitted} marking(s) outside the calibrated pitch were omitted.` : '',
    ].filter(Boolean).join('\n\n'),
    sourceReference: { label: media.name, estimated: true },
  };
}

const demoBase = newScene();
const demoStroke = { color: inkColors[0], opacity: .92, thickness: .54 };
const opening: Scene = {
  ...demoBase, id: 'opening', name: 'Starting Shape', phase: 'Build-up',
  classification: 'HYPOTHETICAL', ball: { x: 52.5, y: 34 },
  notes: 'Compare the two starting shapes. Northbridge build with a single pivot while Southbank screen the central lane.',
  sourceReference: { label: 'Fictional studio demonstration', estimated: true },
  objects: [
    { ...demoStroke, id: 'demo-lane', kind: 'zone', points: [{ x: 30, y: 24 }, { x: 58, y: 43 }], opacity: .34, dashed: true },
    { ...demoStroke, id: 'demo-pass', kind: 'pass', points: [{ x: 35, y: 34 }, { x: 62, y: 22 }], curve: { x: 49, y: 33 }, arrowhead: true },
    { ...demoStroke, id: 'demo-recovery', kind: 'run', points: [{ x: 47, y: 56 }, { x: 64, y: 49 }], curve: { x: 60, y: 60 }, dashed: true, arrowhead: true },
  ],
  cues: [
    { id: 'cue-opening', label: 'Establish the starting shape', time: 0 },
    { id: 'cue-pivot', label: 'Highlight the single pivot', highlight: ['home-6'], time: 1 },
    { id: 'cue-lane', label: 'Trace the forward pass', reveal: ['demo-pass'], time: 3.3 },
  ],
};

const pressing: Scene = {
  ...applyPhase(opening, 'High press'),
  id: 'pressing', name: 'The Press Trigger', phase: 'High press', duration: 8,
  notes: 'The winger angles the press to remove the return pass. The midfield line steps forward to protect the central lane.',
  ball: { x: 82, y: 20, ownerId: 'away-2' },
  objects: [
    { ...demoStroke, id: 'press-front', kind: 'press', points: [{ x: 59, y: 12 }, { x: 79, y: 23 }], curve: { x: 69, y: 9 }, arrowhead: true, dashed: true },
    { ...demoStroke, id: 'press-line', kind: 'line', points: [{ x: 38, y: 15 }, { x: 38, y: 53 }], color: '#70a8fc', hidden: true },
  ],
  paths: [
    { id: 'press-track', target: 'home-8', objectId: 'press-front', action: 'press', from: { x: 60, y: 13 }, to: { x: 79, y: 23 }, control: { x: 69, y: 9 }, start: .6, duration: 2.6, easing: 'smooth' },
    { id: 'shift-track', target: 'home-6', action: 'shift', from: { x: 45, y: 34 }, to: { x: 52, y: 33 }, start: .6, duration: 2.4, easing: 'smooth' },
  ],
  cues: [
    { id: 'cue-press', label: 'Show the front three', highlight: ['home-8', 'home-9', 'home-10'], time: 0 },
    { id: 'cue-step', label: 'Reveal the stepping line', reveal: ['press-line'], time: 3 },
  ],
};

const progression: Scene = {
  ...opening, id: 'progression', name: 'Break the Lines', phase: 'Attacking progression', duration: 9,
  notes: 'Northbridge find the receiver between lines before releasing the supporting runner.',
  ball: { x: 38, y: 34, ownerId: 'home-6' },
  objects: [
    { ...demoStroke, id: 'line-break', kind: 'pass', points: [{ x: 38, y: 34 }, { x: 59, y: 25 }], curve: { x: 48, y: 38 }, arrowhead: true },
    { ...demoStroke, id: 'line-support', kind: 'run', points: [{ x: 47, y: 12 }, { x: 74, y: 23 }], curve: { x: 70, y: 7 }, arrowhead: true, dashed: true },
  ],
  paths: [
    { id: 'run-track', objectId: 'line-support', target: 'home-8', action: 'run', from: { x: 47, y: 12 }, to: { x: 74, y: 23 }, control: { x: 70, y: 7 }, start: 1.2, duration: 3.1, easing: 'smooth' },
    { id: 'pass-track', objectId: 'line-break', target: 'ball', action: 'pass', from: { x: 38, y: 34 }, to: { x: 59, y: 25 }, control: { x: 48, y: 38 }, start: .45, duration: 1.7, easing: 'linear' },
    { id: 'release-track', target: 'ball', action: 'pass', from: { x: 59, y: 25 }, to: { x: 74, y: 23 }, receiverId: 'home-8', start: 3.2, duration: 1.35, easing: 'linear' },
  ],
  cues: [
    { id: 'cue-receiver', label: 'Identify the inside channel', highlight: ['home-6'], time: 0 },
    { id: 'cue-run', label: 'Release the supporting runner', time: 4.7 },
  ],
};

const transition: Scene = {
  ...applyPhase(opening, 'Defensive transition'), id: 'transition', name: 'Recovery Run',
  phase: 'Defensive transition', duration: 8,
  notes: 'The near-side defender delays the break while the opposite side recovers into a compact shape.',
  ball: { x: 48, y: 41, ownerId: 'away-8' },
  objects: [
    { ...demoStroke, id: 'recover-left', kind: 'recovery', points: [{ x: 29, y: 17 }, { x: 17, y: 25 }], curve: { x: 23, y: 16 }, arrowhead: true, dashed: true },
    { ...demoStroke, id: 'recover-width', kind: 'compactness', points: [{ x: 20, y: 24 }, { x: 20, y: 44 }], color: '#70a8fc' },
  ],
  paths: [
    { id: 'recovery-track', objectId: 'recover-left', target: 'home-2', action: 'recovery', from: { x: 29, y: 17 }, to: { x: 17, y: 25 }, control: { x: 23, y: 16 }, start: .4, duration: 2.2, easing: 'ease-out' },
  ],
  cues: [{ id: 'cue-recovery', label: 'Review the recovery shape', highlight: ['home-2'], time: 2.7 }],
};

const finish: Scene = {
  ...applyPhase(opening, 'Final-third attack'), id: 'finish', name: 'Final Third', phase: 'Final-third attack', duration: 7,
  notes: 'Use the angled finish to explain where the goalkeeper is screened. All positions are illustrative.',
  view: 'full', ball: { x: 84, y: 31 },
  objects: [
    { ...demoStroke, id: 'goal-shot', kind: 'shot', points: [{ x: 84, y: 31 }, { x: 105, y: 36 }], curve: { x: 97, y: 27 }, arrowhead: true },
  ],
  paths: [
    { id: 'shot-track', objectId: 'goal-shot', target: 'ball', action: 'shot', from: { x: 84, y: 31 }, to: { x: 105, y: 36 }, control: { x: 97, y: 27 }, start: .6, duration: 1.55, easing: 'ease-out' },
  ],
  cues: [{ id: 'cue-shot', label: 'Show the finishing angle', time: 2.2 }],
};

export const sampleProject: Project = {
  version: 1, id: 'the-touchline', name: 'The Matchday Edit', match: demoMatch,
  scenes: [opening, pressing, progression, transition, finish],
};

const objectKinds = new Set<ObjectKind>(['arrow', 'run', 'pass', 'shot', 'dribble', 'press', 'recovery', 'support', 'line', 'lane', 'triangle', 'circle', 'spotlight', 'zone', 'polygon', 'channel', 'compactness', 'distance', 'angle', 'text', 'number', 'freehand']);
const actions = new Set(['run', 'pass', 'shot', 'dribble', 'press', 'recovery', 'support', 'ball', 'shift', 'formation']);
const easings = new Set(['linear', 'smooth', 'ease-in', 'ease-out']);
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const strings = (value: unknown, names: string[]) => record(value) && names.every((name) => typeof value[name] === 'string');
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const point = (value: unknown) => record(value) && finite(value.x) && finite(value.y);
const arrayOf = (value: unknown, validate: (item: unknown) => boolean): value is unknown[] => Array.isArray(value) && value.every(validate);
const optional = (value: unknown, validate: (item: unknown) => boolean) => value === undefined || validate(value);
const str = (value: unknown) => typeof value === 'string';
const bool = (value: unknown) => typeof value === 'boolean';
const viewKey = (value: unknown) => typeof value === 'string' && Object.hasOwn(viewNames, value);

function validScene(scene: unknown) {
  if (!record(scene) || !strings(scene, ['id', 'name', 'notes'])) return false;
  return finite(scene.duration) && scene.duration > 0
    && phases.includes(scene.phase as Phase)
    && ['VERIFIED', 'RECONSTRUCTED', 'HYPOTHETICAL'].includes(scene.classification as string)
    && ['horizontal', 'vertical'].includes(scene.orientation as string)
    && ['number', 'shirt', 'name', 'compact'].includes(scene.marker as string)
    && ['stadium', 'training', 'mono'].includes(scene.theme as string)
    && ['cut', 'fade'].includes(scene.transition as string)
    && optional(scene.swapped, bool)
    && optional(scene.cameraKeys, (value) => arrayOf(value, (key) => record(key) && finite(key.time) && viewKey(key.view) && ['horizontal', 'vertical'].includes(key.orientation as string)))
    && optional(scene.substitutions, (value) => arrayOf(value, (entry) => record(entry) && finite(entry.time) && str(entry.incomingId)
      && strings(entry.outgoing, ['id', 'name', 'position', 'role']) && point(entry.outgoing)))
    && typeof scene.homeFormation === 'string' && Object.hasOwn(formations, scene.homeFormation)
    && typeof scene.awayFormation === 'string' && Object.hasOwn(formations, scene.awayFormation)
    && viewKey(scene.view)
    && record(scene.ball) && point(scene.ball) && optional(scene.ball.ownerId, str)
    && arrayOf(scene.players, (item) => record(item) && point(item) && strings(item, ['id', 'name', 'position', 'role'])
      && ['home', 'away'].includes(item.side as string) && finite(item.number) && optional(item.color, str) && optional(item.highlight, bool))
    && arrayOf(scene.objects, (item) => record(item) && strings(item, ['id', 'kind', 'color'])
      && objectKinds.has(item.kind as ObjectKind) && arrayOf(item.points, point) && item.points.length > 0 && optional(item.curve, point)
      && finite(item.opacity) && finite(item.thickness) && optional(item.label, str) && optional(item.dashed, bool)
      && optional(item.arrowhead, bool) && optional(item.hidden, bool) && optional(item.locked, bool)
      && (item.space === undefined || item.space === 'pitch' || item.space === 'media')
      && optional(item.mediaAssetId, str) && optional(item.fillOpacity, finite)
      && optional(item.mediaIn, finite) && optional(item.mediaOut, finite))
    && arrayOf(scene.paths, (item) => record(item) && strings(item, ['id', 'target']) && actions.has(item.action as string)
      && point(item.from) && point(item.to) && optional(item.control, point) && finite(item.start) && finite(item.duration) && item.duration > 0
      && easings.has(item.easing as string) && optional(item.objectId, str) && optional(item.receiverId, str))
    && arrayOf(scene.tracks, (item) => record(item) && str(item.target)
      && ['visibility', 'scale', 'opacity'].includes(item.property as string)
      && arrayOf(item.keyframes, (frame) => record(frame) && finite(frame.time) && finite(frame.value)))
    && arrayOf(scene.cues, (item) => record(item) && strings(item, ['id', 'label']) && optional(item.time, finite)
      && optional(item.reveal, (value) => arrayOf(value, str)) && optional(item.hide, (value) => arrayOf(value, str))
      && optional(item.highlight, (value) => arrayOf(value, str)) && optional(item.view, viewKey))
    && optional(scene.media, (media) => record(media) && strings(media, ['assetId', 'name'])
      && ['image', 'video'].includes(media.type as string) && optional(media.frame, finite)
      && optional(media.alignmentFrame, (value) => finite(value) && value >= 0)
      && optional(media.alignment, (alignment) => arrayOf(alignment, point) && Boolean(tryMediaCalibration(alignment as Point[]))))
    && optional(scene.sourceReference, (source) => record(source) && str(source.label) && optional(source.url, str)
      && optional(source.retrievedAt, str) && optional(source.estimated, bool));
}

export function validateProject(input: unknown): Project {
  if (!record(input) || input.version !== 1 || !strings(input, ['id', 'name'])) {
    throw new Error('This file is not a version 1 studio project.');
  }
  if (!strings(input.match, ['home', 'away', 'homeShort', 'awayShort', 'competition', 'score', 'source'])
    || !arrayOf(input.scenes, validScene) || input.scenes.length === 0) {
    throw new Error('The project contains incomplete match or scene data.');
  }
  const project = input as Project;
  const unique = (items: { id: string }[]) => new Set(items.map(({ id }) => id)).size === items.length;
  if (!unique(project.scenes) || project.scenes.some((scene) => !unique(scene.players) || !unique(scene.objects) || !unique(scene.paths) || !unique(scene.cues))) {
    throw new Error('The project contains duplicate scene or tactical object identifiers.');
  }
  return project;
}
