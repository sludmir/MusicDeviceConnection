// Color palette: three-layer surface system on a near-black base, with
// accent variants for tinted fills and press-glow. Existing color tokens
// (`bg`, `surface`, `surfaceAlt`, `border`, `text`, `textDim`) are preserved
// so older screens that haven't been refreshed yet keep working.
export const colors = {
  bg: '#0A0B0D',
  surface: '#13151A',
  surfaceAlt: '#1B1E25',
  border: 'rgba(255,255,255,0.06)',
  text: '#F5F7FA',
  textDim: 'rgba(245,247,250,0.65)',
  accent: '#00a2ff',
  accentSoft: 'rgba(0, 162, 255, 0.12)',
  accentGlow: 'rgba(0, 162, 255, 0.35)',
  danger: '#ff4d6d',
  success: '#30d158',

  // Three-layer surface palette.
  surface0: '#0A0B0D',
  surface1: '#13151A',
  surface2: '#1B1E25',

  // Refined text scale.
  textPrimary: '#F5F7FA',
  textSecondary: 'rgba(245,247,250,0.65)',
  textTertiary: 'rgba(245,247,250,0.4)',

  hairline: 'rgba(255,255,255,0.06)',
};

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

// Typography scale. All sizes/weights/letter-spacing the design uses live
// here so screens stay consistent. Use platform default font (San Francisco
// on iOS, Roboto on Android) — no custom font load.
export const type = {
  display: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  title: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  subtitle: { fontSize: 16, fontWeight: '600' },
  body: { fontSize: 15, fontWeight: '400' },
  caption: { fontSize: 13, fontWeight: '500' },
  micro: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
};

// Setup-type accent colors — used on the setup-type badge and any
// type-tinted UI. Kept in theme so a future palette change is one edit.
export const setupTypeColors = {
  DJ: '#00a2ff',
  Producer: '#b56bff',
  Musician: '#ff8a3d',
};
