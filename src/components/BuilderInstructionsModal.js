import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

const STORAGE_KEY = 'liveset-builder-instructions-v1';

const STEPS = [
  'Drag to orbit the scene. Pinch or scroll to zoom in and out.',
  'Tap an empty ghost spot to add a piece of gear.',
  'Tap a placed device to swap it, remove it, or open the store link.',
  'Gold cart = in-stock zZounds affiliate link. Red cart = other store or unavailable.',
  'Save your setup when you are happy with the layout.',
];

export default function BuilderInstructionsModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== '1') setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  return (
    <Modal
      open={open}
      onClose={dismiss}
      title="How to use the builder"
      footer={(
        <Button variant="primary" onClick={dismiss}>
          Got it
        </Button>
      )}
    >
      <ol style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {STEPS.map((step) => (
          <li key={step} style={{ lineHeight: 1.45 }}>{step}</li>
        ))}
      </ol>
    </Modal>
  );
}

export function reopenBuilderInstructions() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('liveset:builder-instructions-reopen'));
}
