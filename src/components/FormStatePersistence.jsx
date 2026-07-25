import React, { useEffect, useRef } from "react";

const STORAGE_KEY = "mitsumori.formSnapshot";
const RESTORE_DELAYS = [80, 300, 800, 1500];
const GENERATOR_LABELS = new Set([
  "企業訪問（回数）",
  "日本文化体験（回数）",
]);

function getControlValue(control) {
  if (control.type === "checkbox") return control.checked ? "true" : "false";
  return control.value ?? "";
}

function getLabel(control) {
  const wrappingLabel = control.closest("label");
  if (wrappingLabel) {
    const clone = wrappingLabel.cloneNode(true);
    clone.querySelectorAll("input, select, textarea, button").forEach((node) => node.remove());
    return clone.textContent.replace(/\s+/g, " ").trim();
  }

  const container = control.parentElement;
  const label = container?.querySelector(":scope > label");
  return label?.textContent.replace(/\s+/g, " ").trim() || "";
}

function getScope(control) {
  if (control.closest("[data-program-basic-info]")) return "共通情報";

  const visitCard = control.closest(".visit-card");
  if (visitCard) {
    const heading = visitCard.querySelector(".visit-card-header h3, .visit-card-header span, h3");
    const headingText = heading?.textContent.replace(/\s+/g, " ").trim();
    if (headingText) return `明細:${headingText}`;
  }

  const modeRoot = control.closest("div[hidden]");
  const modeTitle = modeRoot?.querySelector(".mode-title")?.textContent.replace(/\s+/g, " ").trim();
  if (modeTitle) return `方式:${modeTitle}`;

  const sectionLabel = control.closest(".col-12")?.querySelector(":scope > label")?.textContent
    ?.replace(/\s+/g, " ")
    .trim();
  if (sectionLabel) return `区分:${sectionLabel}`;

  return "見積入力";
}

function listControls() {
  return Array.from(document.querySelectorAll("input, select, textarea")).filter((control) => {
    if (control.type === "file") return false;
    if (control.closest("[data-estimate-excel-import], [data-estimate-excel-export]")) return false;
    return Boolean(getLabel(control));
  });
}

function collectSnapshot() {
  const occurrence = new Map();

  return listControls().map((control) => {
    const label = getLabel(control);
    const scope = getScope(control);
    const key = `${scope}::${label}`;
    const index = occurrence.get(key) || 0;
    occurrence.set(key, index + 1);

    return {
      scope,
      label,
      occurrence: index,
      type: control.tagName.toLowerCase(),
      inputType: control.type || "",
      value: getControlValue(control),
    };
  });
}

function setNativeValue(control, value) {
  if (!control) return false;

  const nextValue = value == null ? "" : String(value);
  const property = control.type === "checkbox" ? "checked" : "value";
  const prototype = Object.getPrototypeOf(control);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, property);

  if (property === "checked") {
    descriptor?.set?.call(control, nextValue === "true");
  } else {
    descriptor?.set?.call(control, nextValue);
  }

  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function buildControlMap() {
  const occurrence = new Map();
  const map = new Map();

  listControls().forEach((control) => {
    const label = getLabel(control);
    const scope = getScope(control);
    const baseKey = `${scope}::${label}`;
    const index = occurrence.get(baseKey) || 0;
    occurrence.set(baseKey, index + 1);
    map.set(`${baseKey}::${index}`, control);
  });

  return map;
}

function applySnapshot(snapshot, generatorsOnly = false) {
  if (!Array.isArray(snapshot)) return;
  const map = buildControlMap();

  snapshot.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const isGenerator = GENERATOR_LABELS.has(item.label);
    if (generatorsOnly !== isGenerator) return;
    const key = `${item.scope || "見積入力"}::${item.label || ""}::${item.occurrence || 0}`;
    setNativeValue(map.get(key), item.value);
  });
}

function readSnapshot() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

function saveSnapshot() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(collectSnapshot()));
  } catch (error) {
    console.error("Failed to save estimate form snapshot", error);
  }
}

export default function FormStatePersistence() {
  const restoringRef = useRef(false);
  const timerRef = useRef(null);
  const restoreTimersRef = useRef([]);

  useEffect(() => {
    const snapshot = readSnapshot();

    if (snapshot.length) {
      restoringRef.current = true;
      applySnapshot(snapshot, true);
      RESTORE_DELAYS.forEach((delay, index) => {
        const timer = window.setTimeout(() => {
          try {
            applySnapshot(snapshot, false);
          } catch (error) {
            console.error("Failed to restore estimate form snapshot", error);
          }
          if (index === RESTORE_DELAYS.length - 1) {
            restoringRef.current = false;
            saveSnapshot();
            window.dispatchEvent(new CustomEvent("estimate-form-snapshot-restored"));
          }
        }, delay);
        restoreTimersRef.current.push(timer);
      });
    }

    function scheduleSave(event) {
      if (restoringRef.current) return;
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
      if (target.type === "file") return;

      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(saveSnapshot, 120);
    }

    document.addEventListener("input", scheduleSave, true);
    document.addEventListener("change", scheduleSave, true);

    if (!snapshot.length) {
      timerRef.current = window.setTimeout(saveSnapshot, 300);
    }

    return () => {
      window.clearTimeout(timerRef.current);
      restoreTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      document.removeEventListener("input", scheduleSave, true);
      document.removeEventListener("change", scheduleSave, true);
    };
  }, []);

  return null;
}
