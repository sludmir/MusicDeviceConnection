import React from "react";
import "./Avatar.css";

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Avatar({ src, name = "", size = 32, className = "" }) {
  const classes = `ui-avatar ui-avatar--${size} ${className}`;
  if (src) {
    return <img className={classes} src={src} alt={name} />;
  }
  return (
    <span className={classes} aria-label={name}>
      <span className="ui-avatar__initials mono-label">{getInitials(name)}</span>
    </span>
  );
}

export default Avatar;
