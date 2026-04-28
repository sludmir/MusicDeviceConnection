import React from "react";
import "./Chip.css";

function Chip({ onClick, className = "", children, ...rest }) {
  const classes = `ui-chip mono-label ${onClick ? "ui-chip--clickable" : ""} ${className}`;
  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick} {...rest}>
        {children}
      </button>
    );
  }
  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
}

export default Chip;
