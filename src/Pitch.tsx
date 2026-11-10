import { memo, useId, useMemo, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { clamp, curvePoint, evaluateScene, lerpPoint, objectAtFootageTime, objectOnSurface, onPitch, sideInk, teamColors, trackValue, tryMediaCalibration, type Player, type Point, type Scene, type TacticalObject } from './domain';

type PitchProps = {
  scene: Scene;
  time?: number;
  cueIndex?: number;
  clean?: boolean;
  transparent?: boolean;
  media?: boolean;
  mediaTime?: number;
  mediaGuide?: boolean;
  calibrationDraft?: Point[];
  className?: string;
  selected?: ReadonlySet<string>;
  draft?: TacticalObject;
  style?: CSSProperties;
  onPointerDown?: (event: PointerEvent<SVGSVGElement>) => void;
  onPointerMove?: (event: PointerEvent<SVGSVGElement>) => void;
  onPointerUp?: (event: PointerEvent<SVGSVGElement>) => void;
  onPointerCancel?: (event: PointerEvent<SVGSVGElement>) => void;
  onPlayerSelect?: (id: string) => void;
};

type ProjectPoint = (point: Point) => Point;
const coords = ({ x, y }: Point) => `${x.toFixed(3)} ${y.toFixed(3)}`;
const path = (points: Point[], project: ProjectPoint, close = false) =>
  points.map((point, i) => `${i ? 'L' : 'M'}${coords(project(point))}`).join(' ') + (close ? ' Z' : '');

const rectangle = (left: number, top: number, right: number, bottom: number): Point[] =>
  [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }];

function arc(center: Point, radius: number, start: number, end: number, segments = 24) {
  return Array.from({ length: segments + 1 }, (_, index) => {
    const angle = start + (end - start) * index / segments;
    return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
  });
}

function projectPoint(point: Point, scene: Pick<Scene, 'view' | 'orientation'>): Point {
  const { view, orientation } = scene;
  let { x, y } = point;
  if (view === 'broadcast' || view === 'elevated') {
    const depth = y - 34;
    const divisor = 1 - depth * (view === 'broadcast' ? .0075 : .0042);
    x = 52.5 + (x - 52.5) / divisor;
    y = 34 + depth * (view === 'broadcast' ? .62 : .79) / divisor;
  }
  return orientation === 'vertical' ? { x: 68 - y, y: x } : { x, y };
}

function inversePoint(point: Point, scene: Pick<Scene, 'view' | 'orientation'>): Point {
  let { x, y } = scene.orientation === 'vertical' ? { x: point.y, y: 68 - point.x } : point;
  if (scene.view === 'broadcast' || scene.view === 'elevated') {
    const strength = scene.view === 'broadcast' ? .0075 : .0042;
    const height = scene.view === 'broadcast' ? .62 : .79;
    const projectedDepth = y - 34;
    const depth = projectedDepth / (height + strength * projectedDepth);
    x = 52.5 + (x - 52.5) * (1 - strength * depth);
    y = 34 + depth;
  }
  return { x, y };
}

function getViewBox(scene: Pick<Scene, 'view' | 'orientation'>) {
  const crop = scene.view === 'half' ? rectangle(52.5, 0, 105, 68)
    : scene.view === 'third' ? rectangle(70, 0, 105, 68)
    : scene.view === 'box' ? rectangle(81, 9, 105, 59)
    : rectangle(0, 0, 105, 68);
  const points = crop.map((point) => projectPoint(point, scene));
  const margin = scene.view === 'wide' ? 8 : 4.2;
  const left = Math.min(...points.map(({ x }) => x)) - margin;
  const top = Math.min(...points.map(({ y }) => y)) - margin;
  return [left, top, Math.max(...points.map(({ x }) => x)) + margin - left, Math.max(...points.map(({ y }) => y)) + margin - top];
}

export function pitchCoordinates(event: PointerEvent<SVGSVGElement>, scene: Pick<Scene, 'view' | 'orientation'>, media = false) {
  const svg = event.currentTarget;
  const matrix = svg.getScreenCTM();
  if (!matrix) return { x: 0, y: 0 };
  const projected = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  return onPitch(media ? projected : inversePoint(projected, scene));
}

const pitchThemes = {
  stadium: { apron: '#071f1b', field: '#123d31', stripe: '#184536', line: '#a3c1ab', corner: '#648f77' },
  training: { apron: '#143521', field: '#2d5c38', stripe: '#356541', line: '#d2e8c5', corner: '#779f75' },
  mono: { apron: '#202629', field: '#384145', stripe: '#414b50', line: '#c9d6d9', corner: '#707b80' },
} as const;

const penaltyAngle = Math.acos(5.5 / 9.15);
const fieldMarkings = [
  rectangle(0, 0, 105, 68),
  [{ x: 52.5, y: 0 }, { x: 52.5, y: 68 }],
  arc({ x: 52.5, y: 34 }, 9.15, 0, Math.PI * 2, 48),
  rectangle(0, 13.84, 16.5, 54.16),
  rectangle(88.5, 13.84, 105, 54.16),
  rectangle(0, 24.84, 5.5, 43.16),
  rectangle(99.5, 24.84, 105, 43.16),
  arc({ x: 11, y: 34 }, 9.15, -penaltyAngle, penaltyAngle),
  arc({ x: 94, y: 34 }, 9.15, Math.PI - penaltyAngle, Math.PI + penaltyAngle),
  arc({ x: 0, y: 0 }, 1, 0, Math.PI / 2, 10),
  arc({ x: 105, y: 0 }, 1, Math.PI / 2, Math.PI, 10),
  arc({ x: 105, y: 68 }, 1, Math.PI, 3 * Math.PI / 2, 10),
  arc({ x: 0, y: 68 }, 1, -Math.PI / 2, 0, 10),
].map((points, i) => i === 0 || (i >= 3 && i <= 6) ? [...points, points[0]] : points);

const Field = memo(function Field({ project, theme, gradientId }: { project: ProjectPoint; theme: Scene['theme']; gradientId: string }) {
  const palette = pitchThemes[theme];
  const outlines = useMemo(() => fieldMarkings.map((line) => path(line, project)).join(' '), [project]);
  return <>
    <rect x={-1000} y={-1000} width={2100} height={2100} fill={palette.apron} />
    <path d={path(rectangle(0, 0, 105, 68), project, true)} fill={palette.field} />
    {Array.from({ length: 14 }, (_, i) => i % 2 === 0 && <path
      key={i} d={path(rectangle(i * 7.5, 0, (i + 1) * 7.5, 68), project, true)} fill={palette.stripe}
    />)}
    <defs>
      <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#071810" stopOpacity=".03" />
        <stop offset="1" stopColor="#061912" stopOpacity=".23" />
      </linearGradient>
    </defs>
    <path d={path(rectangle(0, 0, 105, 68), project, true)} fill={`url(#${gradientId})`} />
    <path d={outlines} fill="none" stroke={palette.line} strokeOpacity=".63" strokeWidth=".145" />
    {[{ x: 52.5, y: 34 }, { x: 11, y: 34 }, { x: 94, y: 34 }].map((point) => {
      const at = project(point);
      return <circle key={point.x} cx={at.x} cy={at.y} r=".21" fill={palette.line} fillOpacity=".88" />;
    })}
    <g fill="#0a1d17" fillOpacity=".56" stroke={palette.line} strokeWidth=".12" strokeOpacity=".74">
      <path d={path(rectangle(-1.95, 30.34, 0, 37.66), project, true)} />
      <path d={path(rectangle(105, 30.34, 106.95, 37.66), project, true)} />
    </g>
    <g fill="none" stroke={palette.corner} strokeWidth=".13" strokeOpacity=".52">
      {[30.9, 31.95, 33, 34.05, 35.1, 36.15, 37.2].map((y) => <path key={y}
        d={path([{ x: -1.9, y }, { x: 0, y }], project) + ' ' + path([{ x: 105, y }, { x: 106.9, y }], project)} />)}
    </g>
  </>;
});

function ObjectLabel({ x, y, children, color }: Point & { children: ReactNode; color: string }) {
  return <text x={x} y={y} fill={color} fontWeight="720" fontSize="2.2" textAnchor="middle" dominantBaseline="middle"
    stroke="#0b1812" strokeWidth=".44" paintOrder="stroke" strokeLinejoin="round">{children}</text>;
}

const arrowKinds = new Set(['arrow', 'run', 'pass', 'shot', 'dribble', 'press', 'recovery', 'support']);

function Arrowhead({ before, end, color, thickness }: { before: Point; end: Point; color: string; thickness: number }) {
  const angle = Math.atan2(end.y - before.y, end.x - before.x);
  const size = Math.max(1.35, 1.35 + thickness * 1.5);
  const a = { x: end.x - Math.cos(angle - .43) * size, y: end.y - Math.sin(angle - .43) * size };
  const b = { x: end.x - Math.cos(angle + .43) * size, y: end.y - Math.sin(angle + .43) * size };
  return <path d={`M${coords(a)} L${coords(end)} L${coords(b)}`} fill="none" stroke={color}
    strokeWidth={thickness} strokeLinecap="round" strokeLinejoin="round" />;
}

function TacticalGraphic({ object, project, clean, selected, opacity, scale = 1, measurements = true }: {
  object: TacticalObject; project: ProjectPoint; clean: boolean; selected: boolean; opacity: number; scale?: number; measurements?: boolean;
}) {
  const { id, kind, color, dashed, curve, points } = object;
  const [a, b = a, c] = points;
  const start = project(a);
  const last = points[points.length - 1];
  const end = project(last);
  const center = project(lerpPoint(a, last, .5));
  const stroke = clamp(object.thickness, .12, 4);
  const distance = Math.hypot(b.x - a.x, b.y - a.y);
  let geometry: string;
  let fill = 'none';
  let fillOpacity = 1;
  let label: ReactNode = object.label;
  let labelAt = { x: center.x, y: center.y - 1.5 };

  const transform = scale === 1 ? undefined : `translate(${coords(start)}) scale(${scale}) translate(${-start.x} ${-start.y})`;
  if (kind === 'text' || kind === 'number') {
    return <g data-object-id={clean ? undefined : id} opacity={opacity} transform={transform}>
      {!clean && <circle cx={start.x} cy={start.y} r="3" fill="transparent" />}
      <ObjectLabel {...start} color={color}>{label || (kind === 'number' ? '1' : 'Label')}</ObjectLabel>
    </g>;
  }

  if (kind === 'circle' || kind === 'spotlight') {
    geometry = path(arc(a, Math.max(distance, 2), 0, Math.PI * 2, 38), project, true);
    if (kind === 'spotlight') {
      fill = color;
      fillOpacity = .13;
    }
  } else if (kind === 'zone' || kind === 'channel' || kind === 'lane') {
    geometry = path(rectangle(a.x, a.y, b.x, b.y), project, true);
    if (kind === 'lane') {
      const length = Math.max(Math.hypot(b.x - a.x, b.y - a.y), .1);
      const x = (a.y - b.y) / length * 1.9;
      const y = (b.x - a.x) / length * 1.9;
      geometry = path([{ x: a.x + x, y: a.y + y }, { x: b.x + x, y: b.y + y }, { x: b.x - x, y: b.y - y }, { x: a.x - x, y: a.y - y }], project, true);
    }
    fill = color;
    fillOpacity = kind === 'channel' ? .22 : .38;
  } else if (kind === 'triangle' || kind === 'polygon') {
    geometry = path(points.length > 2 ? points : [a, b, { x: a.x, y: b.y }], project, true);
    fill = color;
    fillOpacity = .14;
  } else if (kind === 'angle') {
    const vertex = c ?? { x: a.x, y: b.y };
    geometry = path([a, vertex, b], project);
    const angleA = Math.atan2(a.y - vertex.y, a.x - vertex.x);
    const angleB = Math.atan2(b.y - vertex.y, b.x - vertex.x);
    const difference = Math.acos(clamp(Math.cos(angleB - angleA), -1, 1));
    if (measurements) label = label || `${Math.round(difference * 180 / Math.PI)}°`;
    labelAt = project(lerpPoint(vertex, lerpPoint(a, b, .5), .4));
  } else if (curve) {
    geometry = path(Array.from({ length: 29 }, (_, index) => curvePoint(a, b, curve, index / 28)), project);
  } else {
    geometry = path(points, project);
  }

  if (measurements && (kind === 'distance' || kind === 'compactness')) label = label || `${distance.toFixed(1)} m`;
  const arrow = object.arrowhead ?? arrowKinds.has(kind);
  return <g data-object-id={clean ? undefined : id} opacity={opacity} transform={transform} aria-label={kind}>
    {!clean && <path d={geometry} stroke="transparent" strokeWidth={Math.max(3, stroke + 1)} fill={fill === 'none' ? 'none' : 'transparent'} />}
    {selected && <path d={geometry} stroke="#fafee0" strokeOpacity=".26" strokeWidth={stroke + .8} fill="none" pointerEvents="none" />}
    <path d={geometry} fill={fill} fillOpacity={object.fillOpacity ?? fillOpacity} stroke={color} strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dashed ? `${stroke * 4.3} ${stroke * 3.6}` : undefined} pointerEvents="none" />
    {arrow && (a.x !== last.x || a.y !== last.y) && <Arrowhead before={curve ? project(curvePoint(a, b, curve, .9)) : project(points.at(-2) ?? a)} end={end} color={color} thickness={stroke} />}
    {label && <ObjectLabel {...labelAt} color={color}>{label}</ObjectLabel>}
  </g>;
}

function PlayerMarker({ player, project, scene, selected, clean, onSelect, time }: {
  player: Player; project: ProjectPoint; scene: Scene; selected: boolean; clean: boolean; onSelect?: (id: string) => void; time: number;
}) {
  const at = project(player);
  const color = player.color || teamColors[player.side];
  const name = player.name.split(' ').slice(-1)[0];
  const scale = trackValue(scene.tracks, player.id, 'scale', time, 1);
  const opacity = trackValue(scene.tracks, player.id, 'opacity', time, 1);
  const visibility = trackValue(scene.tracks, player.id, 'visibility', time, 1);
  if (!visibility) return null;
  return <g
    data-player-id={player.id}
    data-side={player.side}
    aria-label={`${player.number} ${player.name}, ${player.position}`}
    role={onSelect && !clean ? 'button' : undefined}
    tabIndex={onSelect && !clean ? 0 : undefined}
    onKeyDown={onSelect && !clean ? (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      onSelect(player.id);
    } : undefined}
    transform={`translate(${coords(at)}) scale(${scale})`}
    opacity={opacity}
  >
    {!clean && <circle r="2.8" fill="transparent" />}
    {(selected || player.highlight) && <>
      <circle r="2.88" fill="#ddfa50" fillOpacity=".17" />
      <circle r="2.66" fill="none" stroke="#defb50" strokeWidth=".2" />
    </>}
    <ellipse cy=".66" rx="1.95" ry="1.6" fill="#030b08" fillOpacity=".44" />
    {scene.marker === 'shirt' ? <path d="M-.76-1.77 -.32-1.4 .32-1.4 .76-1.77 1.63-1.36 2.13-.4 1.39.02 1.08-.45 1.08 1.67 -1.08 1.67 -1.08-.45 -1.39.02 -2.13-.4 -1.63-1.36Z"
      fill={color} stroke="#fff" strokeOpacity=".57" strokeWidth=".12" strokeLinejoin="round" />
      : <circle r={scene.marker === 'compact' ? '1.24' : '1.77'} fill={color} stroke="#fff" strokeOpacity=".55" strokeWidth=".13" />}
    {scene.marker !== 'compact' && <text x="0" y=".08" fill={sideInk[player.side]} fontSize={scene.marker === 'shirt' ? '1.24' : '1.43'} fontWeight="790"
      dominantBaseline="middle" textAnchor="middle" pointerEvents="none">{player.number}</text>}
    {(scene.marker === 'name' || selected) && <g pointerEvents="none">
      <rect x={-Math.min(name.length, 22) * .4 - .5} y="2.36" width={Math.min(name.length, 22) * .8 + 1} height="1.9" rx=".28" fill="#101917" fillOpacity=".95" />
      <text y="3.42" fill="#f3f5f2" fontSize="1.09" fontWeight="680" textAnchor="middle" dominantBaseline="middle">{name.slice(0, 22)}</text>
    </g>}
  </g>;
}

function GraphicHandles({ object, project }: { object: TacticalObject; project: ProjectPoint }) {
  const interval = Math.max(1, Math.ceil(object.points.length / 10));
  const handles = object.points.flatMap((point, index) => index % interval === 0 || index === object.points.length - 1 ? [{ point, id: String(index) }] : []);
  if (object.curve) handles.push({ point: object.curve, id: 'curve' });
  return <g>
    {object.curve && <path d={path([object.points[0], object.curve, object.points[1] ?? object.points[0]], project)}
      fill="none" stroke="#f0ffae" strokeOpacity=".56" strokeWidth=".14" strokeDasharray=".5 .45" pointerEvents="none" />}
    {handles.map(({ point, id }) => {
      const at = project(point);
      return <g key={id} data-handle={id} data-object-id={object.id}>
        <circle cx={at.x} cy={at.y} r="1.65" fill="transparent" />
        <circle cx={at.x} cy={at.y} r={id === 'curve' ? '.62' : '.56'} fill={id === 'curve' ? '#defb50' : '#fff'} stroke="#182513" strokeWidth=".18" />
      </g>;
    })}
  </g>;
}

export function Pitch({
  scene, time = 0, cueIndex, clean = false, transparent = false, media = false, mediaTime, mediaGuide, calibrationDraft, className, selected,
  draft, style, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onPlayerSelect,
}: PitchProps) {
  const gradient = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const effective = useMemo(() => evaluateScene(scene, time, cueIndex), [scene, time, cueIndex]);
  const view = effective.view;
  const orientation = effective.orientation;
  const project = useMemo(() => media ? (point: Point) => point : (point: Point) => projectPoint(point, { view, orientation }), [media, view, orientation]);
  const viewBox = media ? [0, 0, 105, 68] : getViewBox(effective);
  const ball = project(effective.ball);
  const footageTime = mediaTime ?? scene.media?.frame ?? time;
  const alignment = scene.media?.alignment;
  const guide = useMemo(() => media && mediaGuide && !clean ? tryMediaCalibration(alignment) : undefined, [media, mediaGuide, clean, alignment]);
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox={viewBox.join(' ')} className={className}
    style={{ display: 'block', width: '100%', height: '100%', fontFamily: 'Inter, Arial, sans-serif', ...style }}
    preserveAspectRatio={media ? 'none' : 'xMidYMid meet'}
    aria-label={media ? 'Media telestration canvas' : 'Football tactics pitch'}
    onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
    {!transparent && !media && <Field project={project} theme={effective.theme} gradientId={`pitch-light-${gradient}`} />}
    {guide && <path data-media-guide="true" d={fieldMarkings.map((line) => path(line, guide.toMedia)).join(' ')}
      fill="none" stroke="#defb50" strokeOpacity=".72" strokeWidth=".25" strokeDasharray=".7 .36" pointerEvents="none" />}
    {media && calibrationDraft && !clean && <g data-calibration-draft="true" pointerEvents="none">
      <path d={path(calibrationDraft, project)} stroke="#defb50" strokeWidth=".31" fill="none" strokeDasharray=".9 .4" />
      {calibrationDraft.map((point, index) => <g key={index} transform={`translate(${coords(point)})`}>
        <circle r="1.45" fill="#defb50" stroke="#132416" strokeWidth=".22" />
        <text fontWeight="750" fontSize="1.55" textAnchor="middle" dominantBaseline="middle" fill="#132416">{index + 1}</text>
      </g>)}
    </g>}
    {effective.objects.filter((object) => !object.hidden && objectOnSurface(object, scene, media) && (!media || objectAtFootageTime(object, footageTime))).map((object) => (
      trackValue(effective.tracks, object.id, 'visibility', time, 1) !== 0 &&
      <TacticalGraphic key={object.id} object={object} project={project} clean={clean}
        measurements={!media}
        selected={Boolean(selected?.has(object.id)) && !clean}
        opacity={trackValue(effective.tracks, object.id, 'opacity', time, object.opacity)}
        scale={trackValue(effective.tracks, object.id, 'scale', time, 1)} />
    ))}
    {!media && effective.players.map((player) => <PlayerMarker key={player.id} player={player} project={project} scene={effective} time={time}
      clean={clean} selected={Boolean(selected?.has(player.id)) && !clean} onSelect={onPlayerSelect} />)}
    {!media && <g data-ball={clean ? undefined : 'true'} aria-label="Ball" transform={`translate(${coords(ball)})`}>
      {!clean && <circle r="1.5" fill="transparent" />}
      <circle r=".83" cy=".19" fill="#081811" fillOpacity=".59" />
      <circle r=".67" fill="#f9faf2" stroke="#0c1512" strokeWidth=".12" />
      <path d="M0-.26 .25-.08 .15.24 -.15.24 -.25-.08Z" fill="#27352e" />
    </g>}
    {draft && !clean && <g pointerEvents="none"><TacticalGraphic object={draft} project={project} clean selected={false} opacity={.88} measurements={!media} /></g>}
    {!clean && effective.objects.filter((object) => !object.hidden && !object.locked && objectOnSurface(object, scene, media) && selected?.has(object.id))
      .map((object) => <GraphicHandles key={object.id} object={object} project={project} />)}
  </svg>;
}
