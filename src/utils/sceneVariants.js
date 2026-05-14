export const VARIANTS_BY_SETUP = {
  DJ: [
    { key: 'dj-club', label: 'Club Booth' },
    { key: 'dj-rooftop', label: 'Rooftop' },
  ],
  Producer: [
    { key: 'producer-studio-desk', label: 'Studio Desk' },
    { key: 'producer-bedroom', label: 'Bedroom Studio' },
  ],
  Musician: [
    { key: 'musician-rehearsal', label: 'Rehearsal Room' },
    { key: 'musician-live-stage', label: 'Live Stage' },
  ],
};

export function getDefaultVariant(setupType) {
  const list = VARIANTS_BY_SETUP[setupType];
  return list ? list[0].key : null;
}

export function getVariantLabel(variantKey) {
  for (const list of Object.values(VARIANTS_BY_SETUP)) {
    const match = list.find((v) => v.key === variantKey);
    if (match) return match.label;
  }
  return null;
}

export function isValidVariant(setupType, variantKey) {
  const list = VARIANTS_BY_SETUP[setupType];
  if (!list) return false;
  return list.some((v) => v.key === variantKey);
}

export function getVariantsForSetup(setupType) {
  return VARIANTS_BY_SETUP[setupType] || [];
}
