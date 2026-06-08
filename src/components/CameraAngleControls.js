import React from 'react';
import { MdOutlineCameraAlt } from 'react-icons/md';
import './CameraAngleControls.css';

function CameraAngleControls({ cameraAngles, onSave, onRecall }) {
  return (
    <div className="camera-angle-controls">
      {[0, 1, 2].map((slotIndex) => {
        const saved = cameraAngles[slotIndex] != null;
        return (
          <div key={slotIndex} className="camera-angle-slot">
            <button
              type="button"
              className={`camera-angle-save${saved ? ' camera-angle-save--saved' : ''}`}
              onClick={() => onSave(slotIndex)}
              title={`Save current view to slot ${slotIndex + 1}`}
              aria-label={`Save camera angle ${slotIndex + 1}`}
            >
              <MdOutlineCameraAlt size={14} />
            </button>
            <button
              type="button"
              className="camera-angle-recall"
              onClick={() => onRecall(slotIndex)}
              disabled={!saved}
              title={saved ? `Go to view ${slotIndex + 1}` : `Slot ${slotIndex + 1} is empty`}
              aria-label={`Recall camera angle ${slotIndex + 1}`}
            >
              {slotIndex + 1}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default CameraAngleControls;
