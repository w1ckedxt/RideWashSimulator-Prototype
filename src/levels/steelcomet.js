// Level 5 — Steel Comet: de grote stalen coaster, het eindexamen.
import { computeTrackData, steelCometPoints } from '../layout.js';
import { buildTrack } from '../track.js';
import { buildWalkway } from '../walkway.js';
import { buildTrain } from '../train.js';
import { buildEnvironment, makeBooth, makeSign, makeStation } from '../environment.js';

export const STEELCOMET = {
  id: 'steel',
  name: 'Steel Coaster',
  tagline: 'Steel Comet — 26 m of chain lift, a helix, and a LOT of grime.',

  build({ scene, dirt, cleanables }) {
    const trackData = computeTrackData(steelCometPoints());

    const track = buildTrack(trackData, dirt);
    scene.add(track.group);
    cleanables.push(...track.cleanables);

    scene.add(buildWalkway(trackData, dirt, cleanables));
    scene.add(buildTrain({
      trackData, dirt, cleanables,
      startMeters: 3, bodyColor: 0x1d4e89, noseColor: 0xe8b23a,
    }));
    scene.add(makeStation(dirt, cleanables));
    scene.add(makeSign(dirt, cleanables, 'Steel Comet', { x: 26, z: 13, rotY: -Math.PI / 2.4 }));
    scene.add(makeBooth(dirt, cleanables, { x: 22, z: 7, rotY: -0.7 }));

    const env = buildEnvironment(scene, {
      clearFn: (x, z) => {
        for (let i = 0; i < trackData.samples.length; i += 3) {
          const p = trackData.samples[i].pos;
          const dx = p.x - x, dz = p.z - z;
          if (dx * dx + dz * dz < 6.5 * 6.5) return false;
        }
        return !(x > -10 && x < 32 && z > -6 && z < 22);
      },
      treeCount: 120,
      treeArea: { x0: -72, x1: 143, z0: -93, z1: 37 },
      fencePts: [[-42, 24], [-42, -72], [126, -72], [126, 24], [30, 24]],
      plaza: {
        x: 10, z: 13, w: 42, d: 18,
        queues: [[[0, 8], [16, 8]], [[16, 11], [0, 11]], [[0, 14], [16, 14]]],
      },
    });

    return { spawn: { pos: [16, 1.7, 14], yaw: -0.35, pitch: 0.02 }, envUpdate: env.update };
  },
};
