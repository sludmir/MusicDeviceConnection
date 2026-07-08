import React from 'react';

const sectionStyle = { marginBottom: '32px', lineHeight: 1.6 };

export default function LegalPage() {
  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 24px', color: 'inherit' }}>
      <h1>LiveSet — Disclosures, Privacy &amp; Terms</h1>
      <p style={{ opacity: 0.7 }}>Effective July 3, 2026. We'll update this page when our practices change; the date above always reflects the current version.</p>

      <section style={sectionStyle}>
        <h2>About LiveSet</h2>
        <p>
          LiveSet (liveset.io) is a platform where DJs, producers, and musicians build
          interactive 3D versions of their gear setups, share video performances, and let
          viewers explore — and shop — the exact equipment used. Contact for anything on
          this page: sebasludmir@gmail.com.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2>Affiliate Disclosure</h2>
        <p>
          Product links on LiveSet may be affiliate links, placed through affiliate
          networks and programs (which may include Amazon Associates, Skimlinks, CJ
          Affiliate, and individual retailer programs). If you buy through them, LiveSet —
          and in some cases the creator whose setup you were viewing — receives a
          commission at no extra cost to you. When you follow an affiliate link, the
          network or retailer may set cookies in your browser to attribute the purchase;
          their own privacy policies govern what happens on their sites. Prices shown on
          LiveSet are informational and may differ from the retailer's current price.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2>Privacy Policy</h2>
        <p>
          <strong>Account data.</strong> Signing in with Google shares your name, email
          address, and profile photo with us. Your display name and profile are visible to
          other signed-in users; your email address is not shown to other users, and we
          use it only to operate your account and to contact you.
        </p>
        <p>
          <strong>Content you upload.</strong> Setups, videos, audio, bios, and favorite
          products you post are visible to other signed-in users, along with your display
          name. Don't include personal information you wouldn't want other users to see.
        </p>
        <p>
          <strong>Usage data &amp; cookies.</strong> We use Google Analytics (via
          Firebase) to measure how the site is used — pages viewed, device type, and
          approximate (city-level) location. Analytics uses cookies and similar
          identifiers. We use this data only to understand and improve LiveSet, not for
          advertising profiles.
        </p>
        <p>
          <strong>Affiliate clicks.</strong> When you click a Buy link we log the product,
          the setup you were viewing, and your account ID so we can credit creators for
          purchases their setups inspire. Creators see aggregated statistics (clicks and
          commissions attributed to their setups) — never your identity. We do not see
          what you buy at the retailer.
        </p>
        <p>
          <strong>Service providers.</strong> LiveSet runs on Google Firebase
          (authentication, database, file storage, analytics — data stored on Google
          Cloud servers in the United States) and Bunny.net (video streaming; like any
          content delivery network, it processes your IP address to serve video). We
          share data with these providers only so they can provide the service. If you
          are visiting from outside the US, your data is processed in the US.
        </p>
        <p>
          <strong>What we don't do.</strong> We do not sell personal data, and we do not
          share it with third parties for their own advertising.
        </p>
        <p>
          <strong>Access &amp; deletion.</strong> Email us to access, correct, or delete
          your account and associated data (profile, setups, uploaded videos and audio,
          and affiliate-click records tied to your account). We complete deletion requests
          within 30 days; residual copies in backups and analytics aggregates are purged
          on their normal retention cycles.
        </p>
        <p>
          <strong>Children.</strong> LiveSet is not directed at children under 13, and we
          do not knowingly collect their data. If you believe a child has an account,
          contact us and we will delete it.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2>Your Content &amp; Takedowns</h2>
        <p>
          You keep ownership of what you upload and grant LiveSet permission to host,
          stream, and display it on the platform. You are responsible for having the
          rights to the content you post — including the music in your sets. If you
          believe content on LiveSet infringes your rights, email us with a link to the
          content and a description of the claim, and we will review and remove infringing
          material promptly.
        </p>
      </section>
    </div>
  );
}
