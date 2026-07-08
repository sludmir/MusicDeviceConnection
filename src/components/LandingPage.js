import React from 'react';
import {
  MdHeadphones,
  MdPlayCircleOutline,
  MdVerified,
  MdArrowForward,
} from 'react-icons/md';
import './LandingPage.css';

// Public marketing page shown to signed-out visitors. Fully static — no
// Firestore reads (rules are signed-in only), which keeps the real content
// gated until sign-in. The hero "stage" echoes the builder's ghost spots.

const SPOTS = [
  { label: 'TURNTABLE', mod: 'left', filled: false },
  { label: 'MIXER', mod: 'center', filled: true },
  { label: 'CDJ-3000', mod: 'right', filled: false },
];

const FEATURES = [
  {
    eyebrow: 'BUILD',
    icon: MdHeadphones,
    title: 'Your rig, in 3D',
    body:
      'Place real gear on a virtual stage — club booth, studio desk, or rehearsal room. Every knob and cable, exactly how you run it.',
  },
  {
    eyebrow: 'WATCH',
    icon: MdPlayCircleOutline,
    title: 'Sets with lossless sound',
    body:
      'Full live sets from verified creators, overlaid with the master audio they recorded — not the phone-mic version.',
  },
  {
    eyebrow: 'EARN',
    icon: MdVerified,
    title: 'Gear that pays you back',
    body:
      'When someone buys gear from your setup, you earn a share. Your stage becomes your storefront.',
  },
];

const STEPS = [
  { n: '01', title: 'Sign in', body: 'One tap with Google. No forms.' },
  { n: '02', title: 'Build your setup', body: 'Drag your gear onto the stage and wire it up.' },
  { n: '03', title: 'Share it', body: 'Link your setup to your sets so fans can see — and shop — your rig.' },
];

function LandingPage({ onSignIn }) {
  return (
    <div className="landing">
      {/* ---- HERO ---- */}
      <section className="landing__hero">
        <div className="landing__hero-copy">
          <span className="mono-label landing__eyebrow landing-reveal">The stage is yours</span>
          <h1 className="landing__headline landing-reveal">
            Build your rig.
            <br />
            <em>Share your set.</em>
          </h1>
          <p className="landing__sub landing-reveal">
            LiveSet is where DJs, producers, and musicians recreate their setups
            in 3D, post full live sets, and let fans shop the gear behind the
            sound.
          </p>
          <div className="landing__cta-row landing-reveal">
            <button type="button" className="landing__cta press" onClick={onSignIn}>
              Sign in with Google <MdArrowForward size={18} aria-hidden="true" />
            </button>
            <a className="landing__cta-secondary mono-label" href="#how-it-works">
              How it works
            </a>
          </div>
        </div>

        {/* Ghost-spot stage — the builder's placement spots, as a teaser */}
        <div className="landing__stage landing-reveal" aria-hidden="true">
          <div className="landing__stage-light" />
          <div className="landing__stage-floor">
            {SPOTS.map((s) => (
              <div
                key={s.label}
                className={`landing__spot landing__spot--${s.mod}${s.filled ? ' landing__spot--filled' : ''}`}
              >
                <span className="mono-label landing__spot-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- FEATURES ---- */}
      <section className="landing__section">
        <div className="landing__features">
          {FEATURES.map(({ eyebrow, icon: Icon, title, body }) => (
            <article key={eyebrow} className="landing__feature">
              <span className="mono-label landing__feature-eyebrow">{eyebrow}</span>
              <Icon size={28} className="landing__feature-icon" aria-hidden="true" />
              <h2 className="landing__feature-title">{title}</h2>
              <p className="landing__feature-body">{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ---- HOW IT WORKS ---- */}
      <section className="landing__section" id="how-it-works">
        <span className="mono-label landing__eyebrow">How it works</span>
        <div className="landing__steps">
          {STEPS.map(({ n, title, body }) => (
            <div key={n} className="landing__step">
              <span className="landing__step-n mono-label">{n}</span>
              <h3 className="landing__step-title">{title}</h3>
              <p className="landing__step-body">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- CREATOR CALLOUT ---- */}
      <section className="landing__section">
        <div className="landing__creator">
          <span className="mono-label landing__creator-chip">
            <MdVerified size={13} aria-hidden="true" /> CREATOR
          </span>
          <h2 className="landing__creator-title">Full sets are creator territory.</h2>
          <p className="landing__creator-body">
            Anyone can build and share a setup. Live sets — full-length,
            lossless — come only from verified creators, so the feed stays
            worth watching.
          </p>
        </div>
      </section>

      {/* ---- FINAL CTA ---- */}
      <section className="landing__section landing__final">
        <h2 className="landing__final-title">Soundcheck&rsquo;s over.</h2>
        <button type="button" className="landing__cta press" onClick={onSignIn}>
          Sign in with Google <MdArrowForward size={18} aria-hidden="true" />
        </button>
      </section>

      <footer className="landing__footer">
        <a href="/legal" className="landing__footer-link mono-label">
          Affiliate disclosure &amp; privacy
        </a>
        <span className="landing__footer-copy mono-label">© {new Date().getFullYear()} LiveSet</span>
      </footer>
    </div>
  );
}

export default LandingPage;
