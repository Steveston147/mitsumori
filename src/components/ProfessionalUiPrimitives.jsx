import React from "react";
import "./ProfessionalUiEnhancements.css";

export function UiIcon({ children, tone = "green" }) {
  return <span className={`ui-v2-icon ui-v2-icon-${tone}`} aria-hidden="true">{children}</span>;
}

export function SidebarNavButton({ icon, active, children, onClick }) {
  return (
    <button type="button" className={active ? "is-active" : ""} aria-current={active ? "page" : undefined} onClick={onClick}>
      <UiIcon>{icon}</UiIcon>
      {children}
    </button>
  );
}

export function MetricCard({ icon, label, value, note, tone = "green", children }) {
  return (
    <article className={`ui-v2-metric-card ui-v2-metric-${tone}`}>
      <div className="ui-v2-metric-heading">
        <UiIcon tone={tone}>{icon}</UiIcon>
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      {children}
      <small>{note}</small>
    </article>
  );
}
