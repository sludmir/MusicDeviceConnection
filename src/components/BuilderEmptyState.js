import React, { useState } from 'react';
import { MdViewInAr } from 'react-icons/md';
import { Button } from '../ui';
import SetupChooserModal from './SetupChooserModal';
import './BuilderEmptyState.css';

// Rendered on /builder when no setup is loaded (Scene in the sidebar, a
// refresh, or a deep link). The chooser opens on arrival; closing it leaves a
// placeholder that can reopen it — no redirect back to /hub.
function BuilderEmptyState({ onNewSetup, onSetupSelect }) {
  const [chooserOpen, setChooserOpen] = useState(true);

  return (
    <div className="builder-page">
      <div className="builder-stage">
        <div className="builder-empty">
          <MdViewInAr size={44} aria-hidden="true" />
          <p className="builder-empty__text">No setup loaded</p>
          <Button variant="primary" onClick={() => setChooserOpen(true)}>
            Choose setup
          </Button>
        </div>
      </div>
      <SetupChooserModal
        open={chooserOpen}
        onClose={() => setChooserOpen(false)}
        onNewSetup={onNewSetup}
        onSetupSelect={onSetupSelect}
      />
    </div>
  );
}

export default BuilderEmptyState;
