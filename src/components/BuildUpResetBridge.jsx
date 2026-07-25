import { useEffect } from "react";
import { resetAllEstimateSections } from "../state/useEstimateSectionState.js";

export default function BuildUpResetBridge() {
  useEffect(() => {
    function handleClick(event) {
      const button = event.target.closest("button");
      if (!button) return;
      if (button.textContent.replace(/\s+/g, " ").trim() !== "積み上げ入力をリセット") return;
      resetAllEstimateSections();
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
