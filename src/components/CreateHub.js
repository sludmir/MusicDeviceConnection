import React, { useState } from 'react';
import { MdHeadphones, MdPiano, MdArrowForward, MdFileUpload, MdVideocam, MdVerified } from 'react-icons/md';
import { IoMusicalNotes } from 'react-icons/io5';
import PostSetModal from './PostSetModal';
import { Card, Modal, SectionHeader } from '../ui';
import { listSettings, hasMultipleSettings, defaultSettingFor } from '../data/settings';
import useViewerRoles from '../utils/useViewerRoles';
import './HubLandingPage.css';

const SETUP_TYPES = [
  { type: 'DJ', icon: MdHeadphones, blurb: 'CDJs, mixers & turntables' },
  { type: 'Producer', icon: MdPiano, blurb: 'Synths, interfaces & controllers' },
  { type: 'Musician', icon: IoMusicalNotes, blurb: 'Instruments, amps & pedals' },
];

// Mobile "+" tab: a focused hub for the two creation paths — building a new
// setup, or posting a set. (On desktop these live on the Hub landing page.)
function CreateHub({ onNewSetup }) {
  const [showPostSetModal, setShowPostSetModal] = useState(false);
  const [pendingSettingType, setPendingSettingType] = useState(null);
  const { isCreator, loading: rolesLoading } = useViewerRoles();

  const startNewSetup = (type) => {
    if (hasMultipleSettings(type)) {
      setPendingSettingType(type);
      return;
    }
    onNewSetup && onNewSetup(type, defaultSettingFor(type));
  };

  const pickSettingAndStart = (settingKey) => {
    const type = pendingSettingType;
    setPendingSettingType(null);
    if (!type) return;
    onNewSetup && onNewSetup(type, settingKey);
  };

  return (
    <div className="hub">
      <div className="hub__inner">

        {/* ---- POST A SET (verified creators only) ---- */}
        <section className="hub__section">
          <SectionHeader eyebrow="POST" title="Share a set" />
          {rolesLoading ? null : !isCreator ? (
            <div className="hub-post-locked">
              <span className="mono-label hub-post-locked__badge">
                <MdVerified size={13} aria-hidden="true" /> CREATOR
              </span>
              <p className="hub-post-locked__text">
                Live sets are posted by verified creator accounts to keep the feed
                high quality. Anyone can build and share setups — creator
                verification is granted by the LiveSet team.
              </p>
            </div>
          ) : (
          <div className="hub-post-cta">
            <button
              type="button"
              className="hub-post-card press-card"
              onClick={() => setShowPostSetModal(true)}
            >
              <div className="hub-post-card__icon">
                <MdFileUpload size={26} />
              </div>
              <div className="hub-post-card__body">
                <div className="hub-post-card__title">Quick post</div>
                <div className="hub-post-card__subtitle">One video, mark a few clips, share in minutes.</div>
              </div>
              <div className="hub-post-card__arrow" aria-hidden="true">
                <MdArrowForward size={18} />
              </div>
            </button>

            <button
              type="button"
              className="hub-post-card hub-post-card--featured press-card"
              onClick={() => window.location.assign('/set-editor')}
            >
              <div className="hub-post-card__icon">
                <MdVideocam size={26} />
              </div>
              <div className="hub-post-card__body">
                <div className="hub-post-card__title">Multi-angle edit</div>
                <div className="hub-post-card__subtitle">Up to 3 cameras + lossless master audio.</div>
              </div>
              <div className="hub-post-card__arrow" aria-hidden="true">
                <MdArrowForward size={18} />
              </div>
            </button>
          </div>
          )}
        </section>

        {/* ---- BUILD A SETUP ---- */}
        <section className="hub__section">
          <SectionHeader eyebrow="BUILD" title="New setup" />
          <div className="hub-types">
            {SETUP_TYPES.map(({ type, icon: Icon, blurb }) => (
              <Card
                key={type}
                padding="lg"
                className="hub-type-card press-card"
                onClick={() => startNewSetup(type)}
              >
                <Icon size={36} className="hub-type-card__icon" />
                <h3 className="hub-type-card__title">{type}</h3>
                <p className="hub-type-card__blurb">{blurb}</p>
                <span className="hub-type-card__cta mono-label">START BUILDING →</span>
              </Card>
            ))}
          </div>
        </section>

      </div>

      {showPostSetModal && (
        <PostSetModal
          onClose={() => setShowPostSetModal(false)}
          onSuccess={() => setShowPostSetModal(false)}
        />
      )}

      <Modal
        open={!!pendingSettingType}
        onClose={() => setPendingSettingType(null)}
        title={pendingSettingType ? `Pick a ${pendingSettingType} setting` : ''}
      >
        <div className="hub-types hub-types--in-modal">
          {pendingSettingType && listSettings(pendingSettingType).map((s) => (
            <Card
              key={s.key}
              padding="lg"
              className="hub-type-card"
              onClick={() => pickSettingAndStart(s.key)}
            >
              <h3 className="hub-type-card__title">{s.label}</h3>
              <p className="hub-type-card__blurb">
                {s.type === 'glb' ? 'Custom 3D environment' : 'Default environment'}
              </p>
              <span className="hub-type-card__cta mono-label">USE THIS →</span>
            </Card>
          ))}
        </div>
      </Modal>
    </div>
  );
}

export default CreateHub;
