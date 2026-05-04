import React from "react";
import "./SectionHeader.css";

function SectionHeader({ eyebrow, title, action, className = "" }) {
  return (
    <div className={`ui-section-header ${className}`}>
      <div className="ui-section-header__text">
        {eyebrow && <span className="ui-section-header__eyebrow mono-label">{eyebrow}</span>}
        {title && <h2 className="ui-section-header__title">{title}</h2>}
      </div>
      {action && <div className="ui-section-header__action">{action}</div>}
    </div>
  );
}

export default SectionHeader;
