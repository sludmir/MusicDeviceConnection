import React from "react";
import "./Tabs.css";

function Tabs({ items, value, onChange, className = "" }) {
  return (
    <div role="tablist" className={`ui-tabs ${className}`}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={active}
            className={`ui-tabs__tab mono-label ${active ? "ui-tabs__tab--active" : ""}`}
            onClick={() => onChange(item.value)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
