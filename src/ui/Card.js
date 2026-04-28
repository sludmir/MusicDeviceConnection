import React from "react";
import "./Card.css";

function Card({ as: Tag = "div", padding = "md", className = "", onClick, children, ...rest }) {
  const isClickable = !!onClick;
  const classes = [
    "ui-card",
    `ui-card--p-${padding}`,
    isClickable ? "ui-card--clickable" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (isClickable) {
    return (
      <Tag
        className={classes}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick(e);
          }
        }}
        {...rest}
      >
        {children}
      </Tag>
    );
  }

  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}

export default Card;
