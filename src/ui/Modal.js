import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import IconButton from "./IconButton";
import "./Modal.css";

function Modal({ open, onClose, title, children, footer }) {
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
    <div className="ui-modal-root" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="ui-modal-backdrop"
        data-testid="ui-modal-backdrop"
        onClick={onClose}
      />
      <div className="ui-modal" role="document">
        <header className="ui-modal__header">
          <h2 className="ui-modal__title">{title}</h2>
          <IconButton aria-label="Close" onClick={onClose}>
            <span aria-hidden="true">×</span>
          </IconButton>
        </header>
        <div className="ui-modal__body">{children}</div>
        {footer && <footer className="ui-modal__footer">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}

export default Modal;
