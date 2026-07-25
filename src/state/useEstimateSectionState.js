import { useEffect, useRef, useState } from "react";

const PREFIX = "mitsumori.estimateState.";
export const RESET_EVENT = "mitsumori-reset-estimate-sections";
export const ESTIMATE_SECTION_CHANGE_EVENT = "mitsumori-estimate-section-change";

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
  const initialRef = useRef(clone(initialValue));
  const [value, setValue] = useState(() => readSection(section, initialRef.current));

  useEffect(() => {
    window.localStorage.setItem(`${PREFIX}${section}`, JSON.stringify(value));
    window.dispatchEvent(
      new CustomEvent(ESTIMATE_SECTION_CHANGE_EVENT, {
        detail: { section },
      })
    );
  }, [section, value]);

  useEffect(() => {
    function handleReset(event) {
      const requestedSection = event?.detail?.section;
      if (requestedSection && requestedSection !== section) return;
      window.localStorage.removeItem(`${PREFIX}${section}`);
      setValue(clone(initialRef.current));
    }

    window.addEventListener(RESET_EVENT, handleReset);
    return () => window.removeEventListener(RESET_EVENT, handleReset);
  }, [section]);

  return [value, setValue];
}

export function clearEstimateSection(section) {
  window.localStorage.removeItem(`${PREFIX}${section}`);
}

export function resetAllEstimateSections() {
  window.dispatchEvent(new CustomEvent(RESET_EVENT));
}

export const ESTIMATE_STATE_PREFIX = PREFIX;
