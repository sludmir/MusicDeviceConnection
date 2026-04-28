import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import IconButton from "./IconButton";
import "./Sheet.css";

function Sheet({ open, onClose, title, primaryAction, side = "bottom", children }) {
  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className={`ui-sheet-root ui-sheet-root--${side}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="ui-sheet-backdrop" onClick={onClose} />
      <div className="ui-sheet" role="document">
        <header className="ui-sheet__header">
          <IconButton aria-label="Close" onClick={onClose}>
            <span aria-hidden="true">×</span>
          </IconButton>
          <h2 className="ui-sheet__title">{title}</h2>
          <div className="ui-sheet__primary">{primaryAction}</div>
        </header>
        <div className="ui-sheet__body">{children}</div>
      </div>
    </div>,
    document.body
  );
}

export default Sheet;
