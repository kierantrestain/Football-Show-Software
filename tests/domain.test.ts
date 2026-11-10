import { describe, expect, it } from 'vitest';
import {
  applyFormation, attackDirection, curvePoint, defaultCurve, evaluateScene, formations,
  makeLineup, mediaCalibration, newScene, objectOnSurface, reconstructMediaScene, sampleProject, swapSides,
  trackValue, translatePlayers, validateProject, type Point, type TacticalObject,
} from '../src/domain';

describe('football shape and animation', () => {
  it('loads eleven unique players with a keeper and ten formation roles for every preset', () => {
    for (const formation of Object.keys(formations) as (keyof typeof formations)[]) {
      for (const side of ['home', 'away'] as const) {
        const players = makeLineup(side, formation);
        expect(players).toHaveLength(11);
        expect(new Set(players.map((player) => player.id)).size).toBe(11);
        expect(players.filter((player) => player.position === 'GK')).toHaveLength(1);
        expect(players.map((player) => player.position)).toEqual(['GK', ...formations[formation].flat()]);
        expect(players.every((player) => player.x >= 0 && player.x <= 105 && player.y >= 0 && player.y <= 68)).toBe(true);
      }
    }
  });

  it('preserves positional relationships when a group shift hits the pitch boundary', () => {
    const [first, second] = makeLineup('home', '4-3-3');
    const [movedFirst, movedSecond] = translatePlayers([first, second], new Set([first.id, second.id]), { x: -99, y: 99 });
    expect(movedFirst.x).toBe(0);
    expect(movedSecond.x - movedFirst.x).toBe(second.x - first.x);
    expect(movedSecond.y - movedFirst.y).toBe(second.y - first.y);
  });

  it('reapplies a formation on the active side after changing ends', () => {
    const scene = swapSides(newScene());
    const reformed = applyFormation(scene, 'home', '5-3-2');
    expect(reformed.players.find((player) => player.side === 'home' && player.position === 'GK')?.x).toBe(99);
    expect(attackDirection(reformed, 'home')).toBe(-1);
  });

  it('moves the ball with its owner and releases it during a pass', () => {
    const scene = newScene();
    const [owner, receiver] = scene.players;
    scene.ball.ownerId = owner.id;
    scene.paths = [
      { id: 'run', target: owner.id, action: 'run', from: owner, to: { x: owner.x + 8, y: owner.y - 4 }, start: 0, duration: 2, easing: 'linear' },
      { id: 'pass', target: 'ball', action: 'pass', from: { x: owner.x + 10, y: owner.y - 2.65 }, to: receiver, start: 2, duration: 2, easing: 'linear', receiverId: receiver.id },
    ];
    const duringRun = evaluateScene(scene, 1);
    expect(duringRun.ball.x).toBe(duringRun.players[0].x + 2);
    expect(duringRun.ball.ownerId).toBe(owner.id);
    const duringPass = evaluateScene(scene, 3);
    expect(duringPass.ball.ownerId).toBeUndefined();
    expect(evaluateScene(scene, 4).ball.ownerId).toBe(receiver.id);
    expect(evaluateScene(scene, 1).ball).toEqual(duringRun.ball);
  });

  it('bows paths in both directions along every axis and at pitch edges', () => {
    const a = { x: 52, y: 34 };
    const targets = [{ x: 30, y: 34 }, { x: 70, y: 34 }, { x: 52, y: 12 }, { x: 52, y: 58 }, { x: 68, y: 55 }, { x: 34, y: 13 }];
    for (const b of targets) {
      const c = defaultCurve(a, b);
      expect(curvePoint(a, b, c, 0)).toEqual(a);
      expect(curvePoint(a, b, c, 1)).toEqual(b);
      expect(curvePoint(a, b, c, .5)).not.toEqual(curvePoint(a, b, undefined, .5));
      expect(curvePoint(a, b, c, .4)).toEqual(curvePoint(b, a, c, .6));
    }
    const edgeA = { x: 30, y: 0 };
    const edgeB = { x: 0, y: 0 };
    expect(defaultCurve(edgeA, edgeB).y).toBeGreaterThan(0);
  });

  it('rewinds cue reveals and resolves camera and appearance keyframes directly', () => {
    const scene = structuredClone(sampleProject.scenes[1]);
    scene.cameraKeys = [{ time: 1, view: 'broadcast', orientation: 'vertical' }];
    scene.tracks = [{ target: 'press-line', property: 'opacity', keyframes: [{ time: 4, value: 1 }, { time: 2, value: .2 }] }];
    expect(evaluateScene(scene, 3, 1).objects.find((object) => object.id === 'press-line')?.hidden).toBe(false);
    expect(evaluateScene(scene, 0, 0).objects.find((object) => object.id === 'press-line')?.hidden).toBe(true);
    expect(evaluateScene(scene, 3, 1).view).toBe('broadcast');
    expect(evaluateScene(scene, 0, 0).view).toBe('full');
    expect(trackValue(scene.tracks, 'press-line', 'opacity', 3, 1)).toBeCloseTo(.6);
  });

  it('validates saved data and rejects invalid versions, object records and duplicate identities', () => {
    expect(validateProject(JSON.parse(JSON.stringify(sampleProject))).scenes).toHaveLength(5);
    expect(() => validateProject({ ...sampleProject, version: 0 })).toThrow(/version/);
    const damaged = structuredClone(sampleProject);
    damaged.scenes[0].objects[0].points = [];
    expect(() => validateProject(damaged)).toThrow(/incomplete/);
    expect(() => validateProject({ ...sampleProject, scenes: [sampleProject.scenes[0], sampleProject.scenes[0]] })).toThrow(/duplicate/);
  });
});

describe('footage calibration', () => {
  const corners = [{ x: 22, y: 13 }, { x: 79, y: 9 }, { x: 98, y: 56 }, { x: 8, y: 60 }];
  const pitchCorners = [{ x: 0, y: 0 }, { x: 105, y: 0 }, { x: 105, y: 68 }, { x: 0, y: 68 }];

  it('projects all four reference corners and inverts asymmetric perspective', () => {
    const calibration = mediaCalibration(corners);
    pitchCorners.forEach((corner, index) => {
      const projected = calibration.toMedia(corner);
      expect(projected.x).toBeCloseTo(corners[index].x, 8);
      expect(projected.y).toBeCloseTo(corners[index].y, 8);
    });
    for (const original of [{ x: 52.5, y: 34 }, { x: 16.5, y: 13.84 }, { x: 102, y: 51 }]) {
      const recovered = calibration.toPitch(calibration.toMedia(original));
      expect(recovered?.x).toBeCloseTo(original.x, 8);
      expect(recovered?.y).toBeCloseTo(original.y, 8);
    }
  });

  it('rejects incomplete, crossed and degenerate quadrilaterals', () => {
    expect(() => mediaCalibration(corners.slice(0, 3))).toThrow(/four corners/);
    expect(() => mediaCalibration([corners[0], corners[2], corners[1], corners[3]])).toThrow(/clockwise/);
    expect(() => mediaCalibration(corners.map((point) => ({ ...point, y: 12 })))).toThrow(/clockwise/);
  });

  it('creates an estimated pitch scene with mapped markings and isolates original assets', () => {
    const calibration = mediaCalibration(corners);
    const scene = newScene();
    scene.media = { assetId: 'frame', type: 'image', name: 'review.png', alignment: calibration.corners };
    const original: Point[] = [{ x: 30, y: 14 }, { x: 65, y: 46 }];
    const base: TacticalObject = {
      id: 'arrow', kind: 'arrow', points: original.map(calibration.toMedia), curve: calibration.toMedia({ x: 45, y: 20 }),
      color: '#defb50', opacity: 1, thickness: .5, arrowhead: true, space: 'media', mediaAssetId: 'frame',
    };
    scene.objects = [
      base,
      { ...base, id: 'outside', curve: undefined, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
      { ...base, id: 'other', mediaAssetId: 'old-frame' },
      { ...base, id: 'pitch', space: 'pitch' },
    ];
    expect(objectOnSurface(scene.objects[2], scene, true)).toBe(false);
    expect(objectOnSurface(scene.objects[3], scene, false)).toBe(true);
    const reconstructed = reconstructMediaScene(scene);
    expect(reconstructed.media).toBeUndefined();
    expect(reconstructed.classification).toBe('RECONSTRUCTED');
    expect(reconstructed.players).toHaveLength(22);
    expect(reconstructed.sourceReference).toEqual({ label: 'review.png', estimated: true });
    expect(reconstructed.objects).toHaveLength(1);
    const [graphic] = reconstructed.objects;
    expect(graphic.points).toHaveLength(25);
    expect(graphic.points[0].x).toBeCloseTo(original[0].x, 8);
    expect(graphic.points.at(-1)?.y).toBeCloseTo(original[1].y, 8);
    expect(graphic.space).toBe('pitch');
    expect(reconstructed.notes).toContain('1 marking(s) outside');
    expect(validateProject({ ...sampleProject, scenes: [scene, reconstructed] }).scenes).toHaveLength(2);

    scene.media = { ...scene.media, type: 'video', alignmentFrame: 3, frame: 10 };
    scene.objects = [
      { ...base, id: 'aligned', mediaIn: 2, mediaOut: 5 },
      { ...base, id: 'later', mediaIn: 6, mediaOut: 12 },
    ];
    const videoReconstruction = reconstructMediaScene(scene);
    expect(videoReconstruction.objects).toHaveLength(1);
    expect(videoReconstruction.notes).toContain('at 3.00 s');
  });
});
