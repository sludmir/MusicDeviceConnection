import React from 'react';

const sectionStyle = { marginBottom: '32px', lineHeight: 1.6 };

export default function LegalPage() {
  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 24px', color: 'inherit' }}>
      <h1>LiveSet — Disclosures &amp; Privacy</h1>

      <section style={sectionStyle}>
        <h2>About LiveSet</h2>
        <p>
          LiveSet (liveset.io) is a platform where DJs, producers, and musicians build
          interactive 3D versions of their gear setups, share video performances, and let
          viewers explore — and shop — the exact equipment used.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2>Affiliate Disclosure</h2>
        <p>
          As an Amazon Associate, LiveSet earns from qualifying purchases. Product links on
          this site may be affiliate links: if you buy through them, LiveSet (and in some
          cases the creator whose setup you were viewing) receives a commission at no extra
          cost to you. Prices shown are informational and may differ from the retailer's
          current price.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2>Privacy Policy</h2>
        <p>
          <strong>Account data.</strong> Signing in with Google shares your name, email
          address, and profile photo with us. We store these with your profile, setups,
          videos, and preferences in Google Firebase.
        </p>
        <p>
          <strong>Content you upload.</strong> Videos, audio, and gear setups you post are
          visible to other signed-in users.
        </p>
        <p>
          <strong>Affiliate clicks.</strong> When you click a Buy link we log the product,
          the setup you were viewing, and your account ID so we can credit creators for
          purchases their setups inspire. We do not see what you buy at the retailer.
        </p>
        <p>
          <strong>Your choices.</strong> To delete your account and associated data, email
          us. We do not sell personal data.
        </p>
        <p>Contact: sebasludmir@gmail.com</p>
      </section>
    </div>
  );
}
