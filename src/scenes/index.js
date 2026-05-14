import * as djClub from './djClub';
import * as djRooftop from './djRooftop';
import * as producerStudioDesk from './producerStudioDesk';
import * as producerBedroom from './producerBedroom';
import * as musicianRehearsal from './musicianRehearsal';
import * as musicianLiveStage from './musicianLiveStage';

const BUILDERS = {
  'dj-club': djClub.build,
  'dj-rooftop': djRooftop.build,
  'producer-studio-desk': producerStudioDesk.build,
  'producer-bedroom': producerBedroom.build,
  'musician-rehearsal': musicianRehearsal.build,
  'musician-live-stage': musicianLiveStage.build,
};

export function buildEnvironment(scene, variantKey, ctx) {
  // Clear any prior environment objects first (safety net).
  scene.children
    .filter((c) => c.userData && c.userData.type === 'environment')
    .forEach((c) => scene.remove(c));

  const builder = BUILDERS[variantKey];
  if (!builder) {
    console.warn(`[scenes] unknown variant "${variantKey}"`);
    return { dispose() {} };
  }
  return builder(scene, ctx);
}
