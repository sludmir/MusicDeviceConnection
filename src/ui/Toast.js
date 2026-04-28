import React, { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import "./Toast.css";

const ToastContext = createContext(null);

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const handle = timers.current.get(id);
    if (handle) {
      clearTimeout(handle);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback((kind, message) => {
    const id = nextId++;
    setToasts((list) => [...list, { id, kind, message }]);
    const handle = setTimeout(() => dismiss(id), 3000);
    timers.current.set(id, handle);
    return id;
  }, [dismiss]);

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
  }, []);

  const api = useMemo(() => ({
    success: (msg) => push("success", msg),
    error: (msg) => push("error", msg),
    info: (msg) => push("info", msg),
    dismiss,
  }), [push, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="ui-toast-stack">
          {toasts.map((t) => (
            <div key={t.id} className={`ui-toast ui-toast--${t.kind}`} role="status">
              {t.message}
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
