import { useEffect, useState } from "react";

const PREFIX = "mitsumori.estimateState.";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readSection(section, initialValue) {
  try {
    const raw = window.localStorage.getItem(`${PREFIX}${section}`);
    if (!raw) return clone(initialValue);
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : clone(initialValue);
  } catch {
    return clone(initialValue);
  }
}

export function useEstimateSectionState(section, initialValue) {
  const [value, setValue] = useState(() => readSection(section, initialValue));

  useEffect(() => {
    window.localStorage.setItem(`${PREFIX}${section}`, JSON.stringify(value));
  }, [section, value]);

  return [value, setValue];
}

export function clearEstimateSection(section) {
  window.localStorage.removeItem(`${PREFIX}${section}`);
}

export const ESTIMATE_STATE_PREFIX = PREFIX;
