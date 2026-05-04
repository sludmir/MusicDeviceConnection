import React from "react";
import "./EmptyState.css";

function EmptyState({ eyebrow, title, body, action, className = "" }) {
  return (
    <div className={`ui-empty ${className}`}>
      {eyebrow && <span className="ui-empty__eyebrow mono-label">{eyebrow}</span>}
      {title && <h3 className="ui-empty__title">{title}</h3>}
      {body && <p className="ui-empty__body">{body}</p>}
      {action && <div className="ui-empty__action">{action}</div>}
    </div>
  );
}

export default EmptyState;
