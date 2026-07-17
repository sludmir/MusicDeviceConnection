import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { MdHeadphones, MdPiano, MdAdd, MdFolderOpen } from 'react-icons/md';
import { IoMusicalNotes } from 'react-icons/io5';
import { Modal, Card, useToast } from '../ui';
import { listSettings, hasMultipleSettings, defaultSettingFor } from '../data/settings';
import './HubLandingPage.css';
import './SetupChooserModal.css';

const SETUP_TYPES = [
  { type: 'DJ', icon: MdHeadphones, blurb: 'CDJs, mixers & turntables' },
  { type: 'Producer', icon: MdPiano, blurb: 'Synths, interfaces & controllers' },
  { type: 'Musician', icon: IoMusicalNotes, blurb: 'Instruments, amps & pedals' },
];

const TYPE_ICONS = { DJ: MdHeadphones, Producer: MdPiano, Musician: IoMusicalNotes };

const TITLES = {
  choice: 'Open the 3D scene',
  type: 'Pick a setup type',
  setting: 'Pick a setting',
  existing: 'Edit an existing setup',
};

// Chooser shown when the builder is opened with no setup loaded ("Scene" in
// the sidebar, a refresh, or a deep link). Two paths: start a new setup
// (type → optional setting), or reopen one of the user's saved setups.
function SetupChooserModal({ open, onClose, onNewSetup, onSetupSelect }) {
  const toast = useToast();
  const [step, setStep] = useState('choice');
  const [pendingType, setPendingType] = useState(null);
  const [setups, setSetups] = useState(null); // null = not fetched yet
  const [loadingSetups, setLoadingSetups] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);

  // Reset to the first step each time the modal opens.
  useEffect(() => {
    if (open) {
      setStep('choice');
      setPendingType(null);
    }
  }, [open]);

  const loadSetups = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      setLoadingSetups(true);
      setFetchFailed(false);
      const snap = await getDocs(query(collection(db, 'setups'), where('ownerId', '==', uid)));
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      // Newest first — same client-side sort Profile uses.
      list.sort((a, b) => {
        const at = a.updatedAt?.toDate?.()?.getTime() ?? a.createdAt?.toDate?.()?.getTime() ?? 0;
        const bt = b.updatedAt?.toDate?.()?.getTime() ?? b.createdAt?.toDate?.()?.getTime() ?? 0;
        return bt - at;
      });
      setSetups(list);
    } catch (err) {
      console.error('Error loading setups:', err);
      setFetchFailed(true);
      toast.error('Failed to load your setups.');
    } finally {
      setLoadingSetups(false);
    }
  };

  const openExisting = () => {
    setStep('existing');
    if (setups === null) loadSetups();
  };

  const pickType = (type) => {
    if (hasMultipleSettings(type)) {
      setPendingType(type);
      setStep('setting');
      return;
    }
    onNewSetup(type, defaultSettingFor(type));
  };

  return (
    <Modal open={open} onClose={onClose} title={TITLES[step]}>
      {step !== 'choice' && (
        <button
          type="button"
          className="setup-chooser__back mono-label"
          onClick={() => setStep(step === 'setting' ? 'type' : 'choice')}
        >
          ← BACK
        </button>
      )}

      {step === 'choice' && (
        <div className="hub-types hub-types--in-modal">
          <Card padding="lg" className="hub-type-card press-card" onClick={() => setStep('type')}>
            <MdAdd size={36} className="hub-type-card__icon" />
            <h3 className="hub-type-card__title">New setup</h3>
            <p className="hub-type-card__blurb">Start from an empty scene</p>
            <span className="hub-type-card__cta mono-label">START BUILDING →</span>
          </Card>
          <Card padding="lg" className="hub-type-card press-card" onClick={openExisting}>
            <MdFolderOpen size={36} className="hub-type-card__icon" />
            <h3 className="hub-type-card__title">Edit existing</h3>
            <p className="hub-type-card__blurb">Reopen one of your saved setups</p>
            <span className="hub-type-card__cta mono-label">CHOOSE SETUP →</span>
          </Card>
        </div>
      )}

      {step === 'type' && (
        <div className="hub-types hub-types--in-modal">
          {SETUP_TYPES.map(({ type, icon: Icon, blurb }) => (
            <Card
              key={type}
              padding="lg"
              className="hub-type-card press-card"
              onClick={() => pickType(type)}
            >
              <Icon size={36} className="hub-type-card__icon" />
              <h3 className="hub-type-card__title">{type}</h3>
              <p className="hub-type-card__blurb">{blurb}</p>
              <span className="hub-type-card__cta mono-label">START BUILDING →</span>
            </Card>
          ))}
        </div>
      )}

      {step === 'setting' && pendingType && (
        <div className="hub-types hub-types--in-modal">
          {listSettings(pendingType).map((s) => (
            <Card
              key={s.key}
              padding="lg"
              className="hub-type-card"
              onClick={() => onNewSetup(pendingType, s.key)}
            >
              <h3 className="hub-type-card__title">{s.label}</h3>
              <p className="hub-type-card__blurb">
                {s.type === 'glb' ? 'Custom 3D environment' : 'Default environment'}
              </p>
              <span className="hub-type-card__cta mono-label">USE THIS →</span>
            </Card>
          ))}
        </div>
      )}

      {step === 'existing' && (
        loadingSetups ? (
          <p className="setup-chooser__note">Loading your setups…</p>
        ) : fetchFailed ? (
          <div>
            <p className="setup-chooser__note">Couldn't load your setups.</p>
            <button type="button" className="setup-chooser__back mono-label" onClick={loadSetups}>
              TRY AGAIN
            </button>
          </div>
        ) : !setups || setups.length === 0 ? (
          <p className="setup-chooser__note">No saved setups yet — go back and start a new one.</p>
        ) : (
          <div className="setup-chooser__list">
            {setups.map((setup) => {
              const Icon = TYPE_ICONS[setup.setupType] || MdHeadphones;
              return (
                <button
                  key={setup.id}
                  type="button"
                  className="setup-chooser__option press"
                  onClick={() => onSetupSelect(setup)}
                >
                  {setup.previewImageURL ? (
                    <img className="setup-chooser__thumb" src={setup.previewImageURL} alt="" loading="lazy" />
                  ) : (
                    <span className="setup-chooser__thumb setup-chooser__thumb--fallback">
                      <Icon size={20} aria-hidden="true" />
                    </span>
                  )}
                  <span className="setup-chooser__option-body">
                    <span className="setup-chooser__option-name">{setup.name || 'Untitled setup'}</span>
                    <span className="setup-chooser__option-meta mono-label">
                      {(setup.setupType || 'DJ').toUpperCase()} · {(setup.devices || []).length} devices
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )
      )}
    </Modal>
  );
}

export default SetupChooserModal;
