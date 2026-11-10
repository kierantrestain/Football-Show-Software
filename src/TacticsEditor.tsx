import { useEffect, useMemo, useState, useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import {
  ArrowDown, ArrowLeftRight, ArrowRight, ArrowUp, ArrowUpRight, Circle, CircleDot, Copy, Crosshair,
  Eye, EyeOff, Focus, Goal, Layers, LockKeyhole, LockKeyholeOpen, MousePointer2, Move, Pencil,
  RectangleHorizontal, RotateCcw, Ruler, ScanLine, Send, Settings2, Spline, Trash2, Triangle, Type, Users,
} from 'lucide-react';
import {
  applyFormation, applyPhase, attackDirection, clamp, defaultCurve, evaluateScene, formations, inkColors, mediaCalibration, objectOnSurface, onPitch, phases,
  reconstructMediaScene, swapSides, teamColors, trackValue, translatePlayers, tryMediaCalibration, uid, viewNames,
  type AnimationTrack, type Easing, type FormationName, type MatchIdentity, type MovementPath, type ObjectKind,
  type Phase, type PitchView, type Player, type Point, type Scene, type Side, type TacticalObject,
} from './domain';
import { Pitch, pitchCoordinates } from './Pitch';
import './tactics.css';

type Tool = 'select' | 'ball' | ObjectKind;
type Tab = 'scene' | 'teams' | 'objects';
type Props = {
  scene: Scene;
  match: MatchIdentity;
  time?: number;
  cueIndex?: number;
  onChange: (scene: Scene) => void;
  onPreview?: (scene: Scene) => void;
  media?: ReactNode;
  mediaTime?: number;
  mediaControl?: ReactNode;
  onReconstruct?: (scene: Scene) => void;
  transparent?: boolean;
};

const toolItems = [
  ['select', 'Select', MousePointer2],
  ['ball', 'Ball & possession', CircleDot],
  ['run', 'Curved run', Spline],
  ['pass', 'Pass', Send],
  ['arrow', 'Arrow', ArrowUpRight],
  ['line', 'Defensive line', Move],
  ['zone', 'Zone', RectangleHorizontal],
  ['spotlight', 'Spotlight', Focus],
  ['freehand', 'Freehand', Pencil],
  ['text', 'Text label', Type],
] as const;
const extraItems = [
  ['shot', 'Shot', Goal], ['dribble', 'Dribble', CircleDot], ['press', 'Press', Crosshair],
  ['recovery', 'Defensive recovery', RotateCcw], ['support', 'Supporting run', Spline],
  ['lane', 'Passing lane', ArrowRight], ['triangle', 'Passing triangle', Triangle], ['circle', 'Circle', Circle],
  ['polygon', 'Polygon', Triangle], ['channel', 'Channel', RectangleHorizontal],
  ['compactness', 'Compactness', Move], ['distance', 'Distance', Ruler], ['angle', 'Angle', ArrowUpRight],
  ['number', 'Number label', Type],
] as const;
const toolList = [...toolItems, ...extraItems];
const toolLabel = (tool: Tool) => toolList.find(([key]) => key === tool)?.[1] ?? tool;
const playerActions = new Set<Tool>(['run', 'dribble', 'press', 'recovery', 'support']);
const ballActions = new Set<Tool>(['pass', 'shot']);
const arrows = new Set<Tool>(['arrow', ...playerActions, ...ballActions]);
const curvable = new Set<Tool>(['line', ...arrows]);
const labelTools = new Set<Tool>(['text', 'number']);
const isTyping = (element: EventTarget | null) => element instanceof HTMLElement && (
  ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(element.tagName) || element.isContentEditable
);

type Anchor = { point: Point; target?: string };
type Gesture =
  | { kind: 'players'; start: Point; selection: Set<string>; base: Scene; moved?: Scene }
  | { kind: 'object'; start: Point; object: TacticalObject; handle?: string; moved?: Scene }
  | { kind: 'ball'; start: Point; moved?: Scene }
  | { kind: 'draw'; start: Anchor; down: Point; fromPending: boolean; points: Point[] };

function pointAdd(point: Point, shift: Point): Point {
  return onPitch({ x: point.x + shift.x, y: point.y + shift.y });
}

function mouseTarget(event: PointerEvent<SVGSVGElement>) {
  const element = event.target instanceof Element ? event.target : null;
  return {
    playerId: element?.closest('[data-player-id]')?.getAttribute('data-player-id') ?? undefined,
    objectId: element?.closest('[data-object-id]')?.getAttribute('data-object-id') ?? undefined,
    handle: element?.closest('[data-handle]')?.getAttribute('data-handle') ?? undefined,
    ball: Boolean(element?.closest('[data-ball]')),
  };
}

function objectFrom(tool: ObjectKind, a: Point, b: Point, id: string, freePoints?: Point[]): TacticalObject {
  let points = [a, b];
  if (tool === 'polygon') {
    const width = b.x - a.x;
    const height = b.y - a.y;
    points = [{ x: a.x, y: a.y + height / 4 }, { x: a.x + width * .4, y: a.y }, { x: b.x, y: a.y + height * .2 }, { x: b.x - width * .12, y: b.y }, { x: a.x + width * .23, y: b.y - height * .05 }];
  }
  if (tool === 'triangle') points.push({ x: a.x, y: b.y });
  if (tool === 'freehand' && freePoints?.length) points = [...freePoints, b];
  if (labelTools.has(tool)) points = [b];
  const curved = ['run', 'dribble', 'press', 'recovery', 'support', 'shot'].includes(tool);
  return {
    id, kind: tool, points, curve: curved ? defaultCurve(a, b) : undefined,
    color: tool === 'line' ? inkColors[4] : inkColors[0],
    opacity: tool === 'zone' || tool === 'channel' ? .58 : .94,
    thickness: tool === 'freehand' ? .42 : .54,
    dashed: playerActions.has(tool) || tool === 'zone',
    arrowhead: arrows.has(tool),
    label: tool === 'text' ? 'Tactical note' : tool === 'number' ? '1' : undefined,
  };
}

function updateGeometry(scene: Scene, object: TacticalObject) {
  return {
    ...scene,
    objects: scene.objects.map((item) => item.id === object.id ? object : item),
    paths: scene.paths.map((path) => path.objectId === object.id ? {
      ...path, from: object.points[0], to: object.points[1] ?? object.points[0], control: object.curve,
    } : path),
  };
}

function pathTo(target: string, action: MovementPath['action'], from: Point, to: Point, start: number, duration: number, linked?: TacticalObject): MovementPath {
  return {
    id: uid(), target, action, from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y }, start, duration, control: linked?.curve,
    objectId: linked?.id, easing: action === 'pass' ? 'linear' : 'smooth',
  };
}

function savePlayerMove(scene: Scene, moved: Scene, time: number) {
  if (time <= .02) {
    const replacements = new Map(moved.players.map((player) => [player.id, player]));
    const affected = new Map(scene.players.filter((player) => {
      const next = replacements.get(player.id);
      return next && (player.x !== next.x || player.y !== next.y);
    }).map((player) => [player.id, replacements.get(player.id)!]));
    const paths = scene.paths.map((path) => {
      const at = affected.get(path.target);
      return at && path.start <= .02 ? { ...path, from: { x: at.x, y: at.y } } : path;
    });
    return {
      ...scene, paths,
      players: scene.players.map((player) => {
        const next = affected.get(player.id);
        return next ? { ...player, x: next.x, y: next.y } : player;
      }),
      objects: scene.objects.map((object) => {
        const linked = paths.find((path) => path.objectId === object.id && path.start <= .02 && affected.has(path.target));
        return linked ? { ...object, points: [linked.from, ...object.points.slice(1)] } : object;
      }),
    };
  }
  const start = Math.max(0, time - 1.25);
  const baseline = evaluateScene(scene, start);
  const displayed = evaluateScene(scene, time);
  const keyframes = moved.players.flatMap((player) => {
    const previous = displayed.players.find((item) => item.id === player.id);
    const origin = baseline.players.find((item) => item.id === player.id);
    if (!previous || !origin || (previous.x === player.x && previous.y === player.y)) return [];
    return [pathTo(player.id, 'run', origin, player, start, time - start)];
  });
  const affected = new Set(keyframes.map((keyframe) => keyframe.target));
  return { ...scene, paths: [...scene.paths.filter((path) => path.start < start || path.start >= time || !affected.has(path.target)), ...keyframes] };
}

function IconButton({ label, children, onClick, active, className = '', disabled = false }: {
  label: string; children: ReactNode; onClick: () => void; active?: boolean; className?: string; disabled?: boolean;
}) {
  return <button type="button" aria-label={label} title={label} className={`tac-icon ${active ? 'is-active' : ''} ${className}`}
    onClick={onClick} aria-pressed={active} disabled={disabled}>{children}</button>;
}

function InspectorField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="tac-field"><span>{label}</span>{children}</label>;
}

const calibrationCorners = ['top left', 'top right', 'bottom right', 'bottom left'];

export function TacticsEditor({ scene, match, time = 0, cueIndex, onChange, onPreview, media, mediaTime, mediaControl, onReconstruct, transparent = false }: Props) {
  const [tool, setTool] = useState<Tool>('select');
  const [tab, setTab] = useState<Tab>('scene');
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const [pending, setPending] = useState<Anchor>();
  const [draft, setDraft] = useState<TacticalObject>();
  const [preview, setPreview] = useState<Scene>();
  const [showMore, setShowMore] = useState(false);
  const [append, setAppend] = useState(false);
  const [viewMedia, setViewMedia] = useState(true);
  const [mediaRatio, setMediaRatio] = useState(16 / 9);
  const [calibrationDraft, setCalibrationDraft] = useState<Point[]>();
  const [calibrationError, setCalibrationError] = useState('');
  const [mediaGuide, setMediaGuide] = useState(false);
  const [team, setTeam] = useState<Side>('home');
  const [keyProperty, setKeyProperty] = useState<AnimationTrack['property']>('opacity');
  const [keyValue, setKeyValue] = useState(1);
  const pointerReadout = useRef<HTMLSpanElement>(null);
  const mediaLayer = useRef<HTMLDivElement>(null);
  const activeGesture = useRef<Gesture | undefined>(undefined);
  const effective = useMemo(() => evaluateScene(scene, time, cueIndex), [scene, time, cueIndex]);
  const hasMedia = Boolean(media) && viewMedia;
  const alignment = scene.media?.alignment;
  const calibration = useMemo(() => tryMediaCalibration(alignment), [alignment]);
  const alignmentFrame = scene.media?.alignmentFrame;
  const onAlignedFrame = alignmentFrame === undefined || Math.abs((mediaTime ?? scene.media?.frame ?? 0) - alignmentFrame) < .05;
  const surfaceObjects = scene.objects.filter((object) => objectOnSurface(object, scene, hasMedia));
  const selectedPlayer = scene.players.find((player) => selection.has(player.id));
  const selectedObject = surfaceObjects.find((object) => selection.has(object.id));
  const linkedPath = scene.paths.find((path) => path.objectId === selectedObject?.id && path.objectId);
  const selectedPlayers = scene.players.filter((player) => selection.has(player.id));

  const resetGesture = () => {
    activeGesture.current = undefined;
    setPending(undefined);
    setDraft(undefined);
    setPreview(undefined);
  };

  useEffect(() => {
    activeGesture.current = undefined;
    setSelection(new Set());
    setPending(undefined);
    setDraft(undefined);
    setPreview(undefined);
    setViewMedia(true);
    setCalibrationDraft(undefined);
    setCalibrationError('');
    setMediaGuide(false);
  }, [scene.id]);

  useEffect(() => {
    setCalibrationDraft(undefined);
    setCalibrationError('');
    setMediaGuide(false);
  }, [scene.media?.assetId]);

  function removeSelected() {
    const ids = new Set(scene.objects.filter((object) => selection.has(object.id) && !object.locked).map((object) => object.id));
    if (!ids.size) return;
    onChange({
      ...scene, objects: scene.objects.filter((object) => !ids.has(object.id)),
      paths: scene.paths.filter((path) => !path.objectId || !ids.has(path.objectId)),
      tracks: scene.tracks.filter((track) => !ids.has(track.target)),
    });
    setSelection(new Set());
  }

  function duplicateSelected() {
    if (!selectedObject) return;
    const copy = {
      ...selectedObject, id: uid(), locked: false,
      points: selectedObject.points.map((point) => pointAdd(point, { x: 2, y: 2 })),
      curve: selectedObject.curve && pointAdd(selectedObject.curve, { x: 2, y: 2 }),
    };
    onChange({ ...scene, objects: [...scene.objects, copy] });
    setSelection(new Set([copy.id]));
  }

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (isTyping(event.target)) return;
      if (event.key === 'Escape') {
        resetGesture();
        setCalibrationDraft(undefined);
        setCalibrationError('');
        setSelection(new Set());
        setTool('select');
        setShowMore(false);
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (!selectedObject) return;
        event.preventDefault();
        removeSelected();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd' && selectedObject) {
        event.preventDefault();
        duplicateSelected();
      }
      if (!event.metaKey && !event.ctrlKey && !event.altKey) {
        if (event.key.toLowerCase() === 'v') changeTool('select');
        if (event.key.toLowerCase() === 'l' && selectedObject) editObject({ locked: !selectedObject.locked });
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  function changeTool(next: Tool) {
    resetGesture();
    setCalibrationDraft(undefined);
    setCalibrationError('');
    setTool(next);
    setShowMore(false);
    if (next !== 'select') setTab('scene');
  }

  function selectPlayer(id: string, multi: boolean) {
    const next = multi ? new Set(selection) : new Set<string>();
    if (multi && next.has(id)) next.delete(id);
    else next.add(id);
    setSelection(next);
    const chosen = scene.players.find((player) => player.id === id);
    if (chosen && !multi) setTeam(chosen.side);
    if (next.size) setTab('teams');
    return next;
  }

  function drawStart(point: Point, clicked?: Player): Anchor {
    if (pending) return pending;
    if (playerActions.has(tool) && !hasMedia) {
      const player = effective.players.find((entry) => entry.id === selectedPlayer?.id) ?? clicked;
      return player ? { point: player, target: player.id } : { point };
    }
    if (ballActions.has(tool) && !hasMedia) {
      const from = effective.players.find((player) => player.id === selectedPlayer?.id);
      return { point: from && from.id !== effective.ball.ownerId ? from : effective.ball, target: 'ball' };
    }
    return { point };
  }

  function startGesture(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;
    const point = pitchCoordinates(event, effective, hasMedia);
    if (calibrationDraft && scene.media && hasMedia) {
      const corners = [...calibrationDraft, point];
      if (corners.length < 4) {
        setCalibrationDraft(corners);
        setCalibrationError('');
        return;
      }
      try {
        const result = mediaCalibration(corners);
        setCalibrationDraft(undefined);
        setCalibrationError('');
        setMediaGuide(true);
        const frame = scene.media.type === 'video' ? mediaTime ?? scene.media.frame ?? 0 : undefined;
        onChange({ ...scene, media: { ...scene.media, alignment: result.corners, alignmentFrame: frame, frame } });
      } catch (error) {
        setCalibrationDraft([]);
        setCalibrationError(error instanceof Error ? error.message : 'Choose four clear pitch corners.');
      }
      return;
    }
    const { playerId, objectId, handle, ball } = mouseTarget(event);
    const player = effective.players.find((item) => item.id === playerId);
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === 'ball' && !hasMedia) {
      if (player) {
        onChange({ ...scene, ball: { x: player.x, y: player.y, ownerId: player.id } });
        setSelection(new Set([player.id]));
        setTab('teams');
      } else {
        const moved = { ...scene, ball: point };
        activeGesture.current = { kind: 'ball', start: point, moved };
        setPreview(moved);
        setSelection(new Set());
      }
      return;
    }
    if (tool !== 'select' && tool !== 'ball') {
      const start = drawStart(point, player);
      activeGesture.current = { kind: 'draw', start, down: point, fromPending: Boolean(pending), points: [point] };
      return;
    }
    if (player && !handle) {
      const multi = event.shiftKey || event.metaKey || event.ctrlKey || append;
      const current = multi || !selection.has(player.id) ? selectPlayer(player.id, multi) : selection;
      if (current.has(player.id)) {
        activeGesture.current = { kind: 'players', start: point, base: effective, selection: current };
        setTab('teams');
      }
      return;
    }
    const object = scene.objects.find((item) => item.id === objectId);
    if (object) {
      setSelection(new Set([object.id]));
      setTab('objects');
      if (!object.locked) activeGesture.current = { kind: 'object', start: point, object, handle };
      return;
    }
    if (ball) {
      activeGesture.current = { kind: 'ball', start: point };
      return;
    }
    setSelection(new Set());
    setTab('scene');
  }

  function moveGesture(event: PointerEvent<SVGSVGElement>) {
    const point = pitchCoordinates(event, effective, hasMedia);
    const gesture = activeGesture.current;
    if (pointerReadout.current) {
      const field = hasMedia ? (onAlignedFrame ? calibration?.toPitch(point) : undefined) : point;
      const inside = field && field.x >= -.1 && field.x <= 105.1 && field.y >= -.1 && field.y <= 68.1;
      if (inside) pointerReadout.current.textContent = `${field.x.toFixed(1)}, ${field.y.toFixed(1)} m`;
      else if (hasMedia) pointerReadout.current.textContent = calibration && onAlignedFrame ? 'OFF PITCH' : 'MEDIA OVERLAY';
    }
    if (!gesture) {
      if (pending && tool !== 'select' && tool !== 'ball') setDraft(objectFrom(tool, pending.point, point, 'draft'));
      return;
    }
    if (gesture.kind === 'draw') {
      if (tool === 'select' || tool === 'ball') return;
      const last = gesture.points[gesture.points.length - 1];
      if (tool === 'freehand' && Math.hypot(point.x - last.x, point.y - last.y) > .48 && gesture.points.length < 1000) gesture.points.push(point);
      setDraft(objectFrom(tool, gesture.start.point, point, 'draft', gesture.points));
      return;
    }
    if (gesture.kind === 'players') {
      const delta = { x: point.x - gesture.start.x, y: point.y - gesture.start.y };
      if (Math.hypot(delta.x, delta.y) < .2 && !gesture.moved) return;
      gesture.moved = { ...gesture.base, players: translatePlayers(gesture.base.players, gesture.selection, delta), paths: [] };
    } else if (gesture.kind === 'object') {
      const delta = { x: point.x - gesture.start.x, y: point.y - gesture.start.y };
      if (Math.hypot(delta.x, delta.y) < .14 && !gesture.moved) return;
      const object = gesture.object;
      const updated = !gesture.handle ? {
        ...object, points: object.points.map((item) => pointAdd(item, delta)),
        curve: object.curve && pointAdd(object.curve, delta),
      } : {
        ...object,
        points: object.points.map((item, index) => String(index) === gesture.handle ? point : item),
        curve: gesture.handle === 'curve' ? point : object.curve,
      };
      gesture.moved = updateGeometry(scene, updated);
    } else {
      gesture.moved = { ...scene, ball: point, paths: scene.paths.filter((path) => path.target !== 'ball') };
    }
    setPreview(gesture.moved);
    if (gesture.moved) onPreview?.(gesture.moved);
  }

  function finishDrawing(gesture: Extract<Gesture, { kind: 'draw' }>, point: Point, playerId?: string) {
    if (tool === 'select' || tool === 'ball') return;
    const dragged = Math.hypot(point.x - gesture.down.x, point.y - gesture.down.y) > 1.2;
    if (tool === 'freehand' && !dragged && gesture.points.length < 3) {
      setDraft(undefined);
      return;
    }
    if (!dragged && !gesture.fromPending && !labelTools.has(tool) && tool !== 'freehand' &&
      !(ballActions.has(tool) && !hasMedia && Math.hypot(point.x - gesture.start.point.x, point.y - gesture.start.point.y) > 3) &&
      !(playerActions.has(tool) && selectedPlayer && gesture.start.target === selectedPlayer.id && Math.hypot(point.x - gesture.start.point.x, point.y - gesture.start.point.y) > 3)) {
      setPending(gesture.start);
      return;
    }
    const receiver = ballActions.has(tool) && playerId && playerId !== selectedPlayer?.id && !hasMedia
      ? effective.players.find((item) => item.id === playerId) : undefined;
    const destination = receiver ?? point;
    const object: TacticalObject = {
      ...objectFrom(tool, gesture.start.point, destination, uid(), gesture.points),
      space: hasMedia ? 'media' : 'pitch',
      mediaAssetId: hasMedia ? scene.media?.assetId : undefined,
    };
    const shouldAnimate = (playerActions.has(tool) || ballActions.has(tool)) && gesture.start.target && !hasMedia;
    const duration = clamp(Math.hypot(destination.x - gesture.start.point.x, destination.y - gesture.start.point.y) / (ballActions.has(tool) ? 17 : 8), .7, 4);
    const movement = shouldAnimate ? {
      ...pathTo(gesture.start.target!, tool as MovementPath['action'], gesture.start.point, destination, time, duration, object),
      receiverId: receiver?.id,
    } : undefined;
    onChange({
      ...scene,
      duration: movement ? Math.max(scene.duration, time + duration) : scene.duration,
      objects: [...scene.objects, object],
      paths: movement ? [...scene.paths, movement] : scene.paths,
      ball: movement?.action === 'dribble' ? { ...scene.ball, ownerId: movement.target } : scene.ball,
    });
    setPending(undefined);
    setDraft(undefined);
    setSelection(new Set([object.id]));
    setTool('select');
    setTab('objects');
  }

  function endGesture(event: PointerEvent<SVGSVGElement>) {
    const gesture = activeGesture.current;
    activeGesture.current = undefined;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!gesture) return;
    if (gesture.kind === 'draw') {
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      finishDrawing(gesture, pitchCoordinates(event, effective, hasMedia), hit?.closest('[data-player-id]')?.getAttribute('data-player-id') ?? undefined);
      return;
    }
    setPreview(undefined);
    if (!gesture.moved) return;
    if (gesture.kind === 'players') {
      onChange(savePlayerMove(scene, gesture.moved, time));
    } else if (gesture.kind === 'ball' && time > .02) {
      const start = Math.max(0, time - 1);
      const from = evaluateScene(scene, start).ball;
      onChange({ ...scene, paths: [...scene.paths, pathTo('ball', 'ball', from, gesture.moved.ball, start, time - start)] });
    } else {
      onChange(gesture.moved);
    }
  }

  function editObject(patch: Partial<TacticalObject>) {
    if (selectedObject) onChange(updateGeometry(scene, { ...selectedObject, ...patch }));
  }

  function editPath(patch: Partial<MovementPath>) {
    if (linkedPath) onChange({
      ...scene,
      duration: Math.max(scene.duration, (patch.start ?? linkedPath.start) + (patch.duration ?? linkedPath.duration)),
      paths: scene.paths.map((path) => path.id === linkedPath.id ? { ...path, ...patch } : path),
    });
  }

  function reverseObject() {
    if (!selectedObject) return;
    const objects = scene.objects.map((object) => object.id === selectedObject.id ? { ...object, points: [...object.points].reverse() } : object);
    const paths = scene.paths.map((path) => path.objectId === selectedObject.id ? { ...path, from: path.to, to: path.from, receiverId: undefined } : path);
    onChange({ ...scene, objects, paths });
  }

  function recordGraphicKey() {
    if (!selectedObject) return;
    const target = selectedObject.id;
    const property = keyProperty;
    const track = scene.tracks.find((item) => item.target === target && item.property === property);
    const at = time;
    const keyframes = [...(track?.keyframes ?? []).filter((frame) => Math.abs(frame.time - at) > .001), { time: at, value: keyValue }];
    onChange({ ...scene, tracks: [...scene.tracks.filter((item) => item !== track), { target, property, keyframes }] });
  }

  function setCamera(patch: Partial<Pick<Scene, 'view' | 'orientation'>>) {
    if (time <= .02) {
      onChange({ ...scene, ...patch, cameraKeys: scene.cameraKeys?.filter((key) => key.time > .02) });
      return;
    }
    const at = time;
    const key = { time: at, view: effective.view, orientation: effective.orientation, ...patch };
    onChange({ ...scene, cameraKeys: [...(scene.cameraKeys ?? []).filter((item) => Math.abs(item.time - at) > .001), key] });
  }

  function beginCalibration() {
    changeTool('select');
    setSelection(new Set());
    setMediaGuide(false);
    setCalibrationDraft([]);
    mediaLayer.current?.querySelector('video')?.pause();
  }

  function reorderObject(direction: -1 | 1) {
    if (!selectedObject) return;
    const index = scene.objects.findIndex((object) => object.id === selectedObject.id);
    const target = index + direction;
    if (target < 0 || target >= scene.objects.length) return;
    const objects = [...scene.objects];
    [objects[index], objects[target]] = [objects[target], objects[index]];
    onChange({ ...scene, objects });
  }

  function editPlayer(patch: Partial<Player>) {
    if (!selectedPlayer) return;
    onChange({ ...scene, players: scene.players.map((player) => player.id === selectedPlayer.id ? { ...player, ...patch } : player) });
  }

  function shiftTeam(x: number, y: number) {
    const group = selectedPlayers.length > 1 ? selectedPlayers : effective.players.filter((player) => player.side === team && player.position !== 'GK');
    const ids = new Set(group.map((player) => player.id));
    const shifted = translatePlayers(effective.players, ids, { x, y });
    const paths = group.flatMap((player) => {
      const from = effective.players.find((item) => item.id === player.id);
      const to = shifted.find((item) => item.id === player.id);
      return from && to ? [pathTo(player.id, 'shift', from, to, time, 1.25)] : [];
    });
    onChange({ ...scene, paths: [...scene.paths, ...paths], duration: Math.max(scene.duration, time + 1.25) });
  }

  function transitionFormation(formation: FormationName) {
    const formed = applyFormation(scene, team, formation);
    const paths = formed.players.flatMap((player) => {
      const from = effective.players.find((item) => item.id === player.id);
      return from && player.side === team ? [pathTo(player.id, 'formation', from, player, time, 1.6)] : [];
    });
    onChange({
      ...scene, [team === 'home' ? 'homeFormation' : 'awayFormation']: formation,
      duration: Math.max(scene.duration, time + 1.6),
      paths: [...scene.paths, ...paths],
    });
  }

  const selectedPath = preview?.paths.length === 0 && activeGesture.current?.kind === 'players';
  const pitchScene = preview ?? scene;
  const toolName = toolLabel(tool);
  const cue = scene.cues[cueIndex ?? 0];
  const [viewTag] = viewNames[effective.view].split(' ');
  const currentTeam = team === 'home' ? match.home : match.away;
  const teamPlayers = scene.players.filter((player) => player.side === team);

  return <section className="tactics-workspace" aria-label="Tactics editor">
    <div className="tac-rail" role="toolbar" aria-label="Tactical tools">
      {toolItems.map(([item, label, Icon], index) => <div key={item} className={index === 2 || index === 5 || index === 8 ? 'tac-tool-group' : undefined}>
        <IconButton label={label} onClick={() => changeTool(item)} active={tool === item} disabled={hasMedia && item === 'ball'}><Icon size={17} strokeWidth={1.7} /></IconButton>
      </div>)}
      <div className="tac-tool-group tac-more-wrap">
        <IconButton label="More tools" onClick={() => setShowMore(!showMore)} active={showMore || extraItems.some(([item]) => item === tool)}><Settings2 size={17} strokeWidth={1.7} /></IconButton>
        {showMore && <div className="tac-more-menu" aria-label="Additional tactical tools">
          {extraItems.map(([item, label, Icon]) => <button type="button" key={item} onClick={() => changeTool(item)} className={tool === item ? 'is-active' : ''}>
            <Icon size={15} strokeWidth={1.65} /><span>{label}</span>
          </button>)}
        </div>}
      </div>
      <div className="tac-rail-end"><IconButton label="Toggle multiple selection" onClick={() => { setAppend(!append); changeTool('select'); }} active={append}><Layers size={16} strokeWidth={1.6} /></IconButton></div>
    </div>
    <div className={`tac-monitor ${hasMedia && (calibrationDraft || calibration) ? 'has-calibration' : ''}`}>
      <div className="tac-monitor-bar">
        <div className="tac-monitor-title"><i /> <span>{hasMedia ? 'TELESTRATION' : 'TACTICAL PREVIEW'}</span></div>
        <div className="tac-monitor-controls">
          {mediaControl}
          {media && <button type="button" onClick={() => {
            changeTool('select');
            setSelection(new Set());
            setViewMedia(!viewMedia);
          }}>{viewMedia ? 'Show pitch' : 'Show media'}</button>}
          {hasMedia && <IconButton label="Align footage" onClick={beginCalibration} active={Boolean(calibrationDraft)}><ScanLine size={15} strokeWidth={1.7} /></IconButton>}
          <label className="tac-camera">
            <Focus size={14} strokeWidth={1.7} />
            <select aria-label="Pitch camera" value={effective.view} disabled={hasMedia} onChange={(event) => setCamera({ view: event.target.value as PitchView })}>
              {Object.entries(viewNames).map(([value, title]) => <option key={value} value={value}>{title}</option>)}
            </select>
          </label>
          <IconButton label="Rotate pitch" disabled={hasMedia} onClick={() => setCamera({ orientation: effective.orientation === 'horizontal' ? 'vertical' : 'horizontal' })}>
            <RotateCcw size={14} strokeWidth={1.7} />
          </IconButton>
        </div>
      </div>
      <div className="tac-screen">
        <div className="tac-screen-corner" aria-hidden="true"><span>{hasMedia ? 'MEDIA' : 'FIELD 01'}</span><i /></div>
        <div className={`tac-canvas ${hasMedia ? 'is-media' : ''} ${tool === 'select' && !calibrationDraft ? 'is-select' : ''}`} style={{ '--media-ratio': mediaRatio } as CSSProperties}>
          {hasMedia && <div className="tac-media-layer" ref={mediaLayer} onLoadCapture={(event) => {
            const image = event.target;
            if (image instanceof HTMLImageElement && image.naturalHeight) setMediaRatio(image.naturalWidth / image.naturalHeight);
          }} onLoadedMetadataCapture={(event) => {
            const video = event.target;
            if (video instanceof HTMLVideoElement && video.videoHeight) setMediaRatio(video.videoWidth / video.videoHeight);
          }}>{media}</div>}
          <Pitch scene={pitchScene} time={selectedPath ? 0 : time} cueIndex={cueIndex} className="tac-svg" media={hasMedia} mediaTime={mediaTime}
            mediaGuide={mediaGuide && onAlignedFrame} calibrationDraft={calibrationDraft}
            selected={selection} transparent={transparent && !media} draft={draft} onPointerDown={startGesture} onPointerMove={moveGesture}
            onPointerUp={endGesture} onPointerCancel={resetGesture} onPlayerSelect={(id) => selectPlayer(id, append)} />
        </div>
        {tool !== 'select' && <div className="tac-tool-tip">
          <span>{toolName}</span>
          {tool === 'ball' ? 'Choose a player or place the ball' : pending ? 'Choose the end point' : playerActions.has(tool) && !selectedPlayer && !hasMedia ? 'Choose a player, then a destination' : labelTools.has(tool) ? 'Place the label on the canvas' : 'Drag or click to draw'}
        </div>}
      </div>
      {hasMedia && (calibrationDraft || calibration) && <div className="tac-calibration" aria-label="Footage calibration">
        {calibrationDraft ? <>
          <div aria-live="polite"><b>Pick the {calibrationCorners[calibrationDraft.length]} pitch corner</b><span>{calibrationError || `${calibrationDraft.length + 1} / 4 · Choose where the touchline meets the goal line.`}</span></div>
          <button type="button" onClick={() => { setCalibrationDraft(undefined); setCalibrationError(''); }}>Cancel</button>
        </> : <>
          <div><b>Pitch aligned</b><span>{alignmentFrame === undefined ? 'Map markings inside the calibrated pitch.' : `Reference frame · ${alignmentFrame.toFixed(2)} s`}</span></div>
          <button type="button" disabled={!onAlignedFrame} aria-pressed={mediaGuide && onAlignedFrame} onClick={() => setMediaGuide(!mediaGuide)}>{mediaGuide && onAlignedFrame ? 'Hide guide' : 'Show guide'}</button>
          {onReconstruct && <button type="button" className="tac-map-action" onClick={() => onReconstruct(reconstructMediaScene(scene))}>Map to pitch</button>}
        </>}
      </div>}
      <div className="tac-monitor-footer">
        <span className="tac-team-key"><i style={{ background: teamColors.home }} />{match.homeShort}<b>{scene.homeFormation}</b></span>
        <span className="tac-footer-divider" />
        <span className="tac-team-key"><i style={{ background: teamColors.away }} />{match.awayShort}<b>{scene.awayFormation}</b></span>
        <span className="tac-pitch-meta"><span key={hasMedia ? 'media' : 'pitch'} ref={pointerReadout}>{hasMedia ? 'MEDIA OVERLAY' : '105 × 68 M'}</span> <span>·</span> {viewTag.toUpperCase()}</span>
      </div>
    </div>
    <aside className="tac-inspector" aria-label="Tactics inspector">
      <div className="tac-inspector-heading"><Settings2 size={15} strokeWidth={1.7} /><span>Inspector</span></div>
      <div className="tac-tabs" aria-label="Inspector views">
        {(['scene', 'teams', 'objects'] as const).map((item) => <button type="button" key={item}
          aria-pressed={item === tab} onClick={() => setTab(item)} className={item === tab ? 'is-active' : ''}>
          {item[0].toUpperCase() + item.slice(1)}{item === 'objects' && <small>{surfaceObjects.length}</small>}
        </button>)}
      </div>
      <div className="tac-inspector-body">
        {tab === 'scene' && <>
          <div className="tac-inspector-section">
            <div className="tac-eyebrow">SCENE PROPERTIES</div>
            <InspectorField label="Scene name"><input value={scene.name} onChange={(event) => onChange({ ...scene, name: event.target.value })} /></InspectorField>
            <InspectorField label="Tactical phase"><select value={scene.phase} onChange={(event) => onChange(applyPhase(scene, event.target.value as Phase, team))}>
              {phases.map((phase) => <option key={phase}>{phase}</option>)}
            </select></InspectorField>
            <div className="tac-pair">
              <InspectorField label="Duration (s)"><input type="number" min={1} max={600} step={.5} value={scene.duration}
                onChange={(event) => onChange({ ...scene, duration: clamp(Number(event.target.value), 1, 600) })} /></InspectorField>
              <InspectorField label="Transition"><select value={scene.transition} onChange={(event) => onChange({ ...scene, transition: event.target.value as Scene['transition'] })}><option value="cut">Cut</option><option value="fade">Fade</option></select></InspectorField>
            </div>
            <InspectorField label="Evidence"><select value={scene.classification} onChange={(event) => onChange({ ...scene, classification: event.target.value as Scene['classification'] })}>
              <option value="HYPOTHETICAL">Hypothetical</option><option value="RECONSTRUCTED">Reconstructed</option><option value="VERIFIED" disabled={!scene.sourceReference?.label || !!scene.sourceReference.estimated}>Verified</option>
            </select></InspectorField>
          </div>
          <div className="tac-inspector-section">
            <div className="tac-eyebrow">PITCH DISPLAY</div>
            <div className="tac-pair">
              <InspectorField label="Markers"><select value={scene.marker} onChange={(event) => onChange({ ...scene, marker: event.target.value as Scene['marker'] })}>
                <option value="number">Numbers</option><option value="shirt">Shirts</option><option value="name">Names</option><option value="compact">Compact</option>
              </select></InspectorField>
              <InspectorField label="Surface"><select value={scene.theme} onChange={(event) => onChange({ ...scene, theme: event.target.value as Scene['theme'] })}>
                <option value="stadium">Stadium</option><option value="training">Training</option><option value="mono">Mono</option>
              </select></InspectorField>
            </div>
          </div>
          <div className="tac-inspector-section tac-notes">
            <div className="tac-eyebrow">PRESENTER NOTES</div>
            <textarea aria-label="Presenter notes" value={scene.notes} rows={3} onChange={(event) => onChange({ ...scene, notes: event.target.value })} placeholder="Add notes for this scene" />
            {cue && <div className="tac-current-cue"><i /><span>{cue.label}</span></div>}
            {scene.sourceReference && <div className="tac-source">{scene.sourceReference.label}{scene.sourceReference.estimated ? ' · estimated positions' : ''}</div>}
          </div>
        </>}
        {tab === 'teams' && <>
          <div className="tac-inspector-section">
            <div className="tac-eyebrow">TEAM SETUP</div>
            <div className="tac-team-switch">
              {(['home', 'away'] as const).map((side) => <button type="button" key={side} aria-pressed={side === team} onClick={() => setTeam(side)} className={side === team ? 'is-active' : ''}><i style={{ background: teamColors[side] }} />{side === 'home' ? match.homeShort : match.awayShort}</button>)}
            </div>
            <InspectorField label={`${currentTeam} formation`}><select value={team === 'home' ? scene.homeFormation : scene.awayFormation}
              onChange={(event) => onChange(applyFormation(scene, team, event.target.value as FormationName))}>
              {Object.keys(formations).map((formation) => <option key={formation}>{formation}</option>)}
            </select></InspectorField>
            <div className="tac-actions">
              <button type="button" onClick={() => onChange(applyFormation(scene, team, team === 'home' ? scene.homeFormation : scene.awayFormation))}><RotateCcw size={13} />Reset team</button>
              <button type="button" onClick={() => onChange(swapSides(scene))}><ArrowLeftRight size={13} />Swap sides</button>
            </div>
            <InspectorField label="Animate to formation"><select value="" onChange={(event) => transitionFormation(event.target.value as FormationName)}>
              <option value="" disabled>Choose formation…</option>
              {Object.keys(formations).map((formation) => <option key={formation}>{formation}</option>)}
            </select></InspectorField>
            <div className="tac-actions">
              <button type="button" onClick={() => shiftTeam(6 * attackDirection(scene, team), 0)}><ArrowRight size={13} />Step up</button>
              <button type="button" onClick={() => shiftTeam(0, 6)}><ArrowDown size={13} />Shift across</button>
            </div>
          </div>
          {selectedPlayer && <div className="tac-inspector-section">
            <div className="tac-eyebrow">{selectedPlayers.length > 1 ? `${selectedPlayers.length} PLAYERS SELECTED` : `PLAYER · #${selectedPlayer.number}`}</div>
            <InspectorField label="Player name"><input value={selectedPlayer.name} onChange={(event) => editPlayer({ name: event.target.value })} /></InspectorField>
            <div className="tac-pair">
              <InspectorField label="Number"><input type="number" min={0} max={99} value={selectedPlayer.number} onChange={(event) => editPlayer({ number: clamp(Number(event.target.value), 0, 99) })} /></InspectorField>
              <InspectorField label="Role"><input value={selectedPlayer.role} onChange={(event) => editPlayer({ role: event.target.value })} /></InspectorField>
            </div>
            <div className="tac-actions">
              <button type="button" onClick={() => editPlayer({ highlight: !selectedPlayer.highlight })}><Focus size={13} />{selectedPlayer.highlight ? 'Unhighlight' : 'Highlight'}</button>
              <button type="button" onClick={() => onChange({ ...scene, ball: { x: selectedPlayer.x, y: selectedPlayer.y, ownerId: selectedPlayer.id } })}><CircleDot size={13} />Give ball</button>
            </div>
            <button type="button" className="tac-wide-action" onClick={() => {
              const players = scene.players.map((player) => player.id === selectedPlayer.id ? { ...player, id: uid(), name: 'Substitute', highlight: false } : player);
              const substitute = players[scene.players.indexOf(selectedPlayer)];
              onChange({
                ...scene, players, ball: scene.ball.ownerId === selectedPlayer.id ? { ...scene.ball, ownerId: substitute.id } : scene.ball,
                paths: scene.paths.map((path) => ({ ...path, target: path.target === selectedPlayer.id ? substitute.id : path.target, receiverId: path.receiverId === selectedPlayer.id ? substitute.id : path.receiverId })),
                cues: scene.cues.map((cue) => ({ ...cue, highlight: cue.highlight?.map((id) => id === selectedPlayer.id ? substitute.id : id) })),
                tracks: scene.tracks.map((track) => track.target === selectedPlayer.id ? { ...track, target: substitute.id } : track),
                substitutions: [...(scene.substitutions ?? []), { outgoing: selectedPlayer, incomingId: substitute.id, time }],
              });
              setSelection(new Set([substitute.id]));
            }}>Make substitution</button>
          </div>}
          <div className="tac-inspector-section">
            <div className="tac-eyebrow">ON THE PITCH <span>{teamPlayers.length}</span></div>
            <div className="tac-roster">{teamPlayers.map((player) => <button type="button" key={player.id} className={selection.has(player.id) ? 'is-active' : ''}
              onClick={(event) => selectPlayer(player.id, event.shiftKey || append)}>
              <b style={{ background: teamColors[player.side] }}>{player.number}</b><span>{player.name}</span><small>{player.position}</small>
            </button>)}</div>
          </div>
        </>}
        {tab === 'objects' && <>
          <div className="tac-inspector-section">
            <div className="tac-eyebrow">SCENE LAYERS <span>{surfaceObjects.length}</span></div>
            {surfaceObjects.length === 0 && <p className="tac-empty">Draw on the canvas to add a layer.</p>}
            <div className="tac-roster">{[...surfaceObjects].reverse().map((object) => <button type="button" key={object.id}
              className={selection.has(object.id) ? 'is-active' : ''} onClick={() => setSelection(new Set([object.id]))}>
              <i className="tac-object-swatch" style={{ background: object.color }} /><span>{object.label || toolLabel(object.kind)}</span>
              {object.hidden ? <EyeOff size={13} /> : object.locked ? <LockKeyhole size={13} /> : <Layers size={13} />}
            </button>)}</div>
          </div>
          {selectedObject && <div className="tac-inspector-section">
            <div className="tac-eyebrow">{toolLabel(selectedObject.kind).toUpperCase()} <span>{selectedObject.locked ? 'LOCKED' : ''}</span></div>
            {labelTools.has(selectedObject.kind) && <InspectorField label="Label"><input value={selectedObject.label ?? ''} disabled={selectedObject.locked} onChange={(event) => editObject({ label: event.target.value })} /></InspectorField>}
            <div className="tac-colors" aria-label="Graphic colour">
              {inkColors.map((color) => <button key={color} type="button" aria-label={`Colour ${color}`} title={color} disabled={selectedObject.locked}
                className={selectedObject.color === color ? 'is-active' : ''} onClick={() => editObject({ color })} style={{ background: color }} />)}
              <input type="color" title="Custom colour" aria-label="Custom colour" value={selectedObject.color} disabled={selectedObject.locked} onChange={(event) => editObject({ color: event.target.value })} />
            </div>
            <div className="tac-pair">
              <InspectorField label="Opacity"><input type="range" min={.05} max={1} step={.05} value={selectedObject.opacity} disabled={selectedObject.locked} onChange={(event) => editObject({ opacity: Number(event.target.value) })} /></InspectorField>
              <InspectorField label="Weight"><input type="range" min={.15} max={2.5} step={.05} value={selectedObject.thickness} disabled={selectedObject.locked} onChange={(event) => editObject({ thickness: Number(event.target.value) })} /></InspectorField>
            </div>
            <div className="tac-actions">
              <button type="button" disabled={selectedObject.locked} aria-pressed={Boolean(selectedObject.dashed)} onClick={() => editObject({ dashed: !selectedObject.dashed })}>Dashed</button>
              <button type="button" disabled={selectedObject.locked} aria-pressed={Boolean(selectedObject.arrowhead)} onClick={() => editObject({ arrowhead: !selectedObject.arrowhead })}>Arrowhead</button>
            </div>
            {curvable.has(selectedObject.kind) && <div className="tac-actions">
              <button type="button" disabled={selectedObject.locked || selectedObject.points.length !== 2} aria-pressed={Boolean(selectedObject.curve)}
                onClick={() => editObject({ curve: selectedObject.curve ? undefined : defaultCurve(selectedObject.points[0], selectedObject.points[1]) })}><Spline size={13} />Curve</button>
              <button type="button" disabled={selectedObject.locked || selectedObject.points.length < 2} onClick={reverseObject}><ArrowLeftRight size={13} />Reverse</button>
            </div>}
            <div className="tac-layer-actions">
              <IconButton label={selectedObject.hidden ? 'Show layer' : 'Hide layer'} onClick={() => editObject({ hidden: !selectedObject.hidden })}>{selectedObject.hidden ? <EyeOff size={15} /> : <Eye size={15} />}</IconButton>
              <IconButton label={selectedObject.locked ? 'Unlock layer' : 'Lock layer'} onClick={() => editObject({ locked: !selectedObject.locked })}>{selectedObject.locked ? <LockKeyhole size={15} /> : <LockKeyholeOpen size={15} />}</IconButton>
              <IconButton label="Bring forward" onClick={() => reorderObject(1)} disabled={selectedObject.locked || scene.objects.at(-1)?.id === selectedObject.id}><ArrowUp size={15} /></IconButton>
              <IconButton label="Send backward" onClick={() => reorderObject(-1)} disabled={selectedObject.locked || scene.objects[0]?.id === selectedObject.id}><ArrowDown size={15} /></IconButton>
              <IconButton label="Duplicate layer" onClick={duplicateSelected}><Copy size={15} /></IconButton>
              <IconButton label="Delete layer" onClick={removeSelected} disabled={selectedObject.locked}><Trash2 size={15} /></IconButton>
            </div>
          </div>}
          {linkedPath && <div className="tac-inspector-section">
            <div className="tac-eyebrow">ANIMATION</div>
            <div className="tac-pair">
              <InspectorField label="Starts (s)"><input type="number" min={0} step={.1} value={linkedPath.start}
                onChange={(event) => editPath({ start: Math.max(0, Number(event.target.value)) })} /></InspectorField>
              <InspectorField label="Length (s)"><input type="number" min={.1} step={.1} value={linkedPath.duration}
                onChange={(event) => editPath({ duration: Math.max(.1, Number(event.target.value)) })} /></InspectorField>
            </div>
            <InspectorField label="Easing"><select value={linkedPath.easing} onChange={(event) => editPath({ easing: event.target.value as Easing })}>
              <option value="linear">Linear</option><option value="smooth">Smooth</option><option value="ease-in">Ease in</option><option value="ease-out">Ease out</option>
            </select></InspectorField>
          </div>}
          {selectedObject && <div className="tac-inspector-section">
            <div className="tac-eyebrow">APPEARANCE KEYFRAME <span>{time.toFixed(2)} S</span></div>
            <div className="tac-pair">
              <InspectorField label="Property"><select value={keyProperty} onChange={(event) => {
                const property = event.target.value as AnimationTrack['property'];
                setKeyProperty(property);
                setKeyValue(trackValue(scene.tracks, selectedObject.id, property, time, property === 'opacity' ? selectedObject.opacity : 1));
              }}>
                <option value="opacity">Opacity</option><option value="scale">Scale</option><option value="visibility">Visibility</option>
              </select></InspectorField>
              <InspectorField label="Value">
                {keyProperty === 'visibility'
                  ? <select value={keyValue ? 1 : 0} onChange={(event) => setKeyValue(Number(event.target.value))}><option value="1">Visible</option><option value="0">Hidden</option></select>
                  : <input type="number" min={keyProperty === 'scale' ? .1 : 0} max={keyProperty === 'scale' ? 3 : 1} step={.1} value={keyValue}
                    onChange={(event) => setKeyValue(clamp(Number(event.target.value), keyProperty === 'scale' ? .1 : 0, keyProperty === 'scale' ? 3 : 1))} />}
              </InspectorField>
            </div>
            <button type="button" className="tac-wide-action" disabled={selectedObject.locked} onClick={recordGraphicKey}>Save keyframe</button>
          </div>}
          {hasMedia && selectedObject && <div className="tac-inspector-section">
            <div className="tac-eyebrow">FOOTAGE RANGE</div>
            <div className="tac-pair">
              <InspectorField label="Show from (s)"><input type="number" min={0} step={.1} value={selectedObject.mediaIn ?? ''}
                onChange={(event) => editObject({ mediaIn: event.target.value === '' ? undefined : Number(event.target.value) })} /></InspectorField>
              <InspectorField label="Hide after (s)"><input type="number" min={0} step={.1} value={selectedObject.mediaOut ?? ''}
                onChange={(event) => editObject({ mediaOut: event.target.value === '' ? undefined : Number(event.target.value) })} /></InspectorField>
            </div>
          </div>}
        </>}
      </div>
      <div className="tac-inspector-footer"><Users size={13} strokeWidth={1.65} /> <span>{scene.players.length} PLAYERS ON PITCH</span><i /></div>
    </aside>
  </section>;
}
