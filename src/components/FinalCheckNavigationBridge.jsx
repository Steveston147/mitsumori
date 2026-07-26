import { useEffect } from "react";

const SECTION_TITLES = {
  company: "企業・施設訪問",
  culture: "日本文化体験",
  japanese: "日本語講座",
  collaboration: "学生共修・学内文化活動",
  common: "共通経費",
  summary: "見積サマリー",
};

export default function FinalCheckNavigationBridge() {
  useEffect(() => {
    const openSection = (event) => {
      const title = SECTION_TITLES[event.detail?.section];
      if (!title) return;
      const button = [...document.querySelectorAll(".build-up-category-card")]
        .find((candidate) => candidate.querySelector(".build-up-category-title")?.textContent?.trim() === title);
      button?.click();
    };

    window.addEventListener("mitsumori-final-check-open-section", openSection);
    return () => window.removeEventListener("mitsumori-final-check-open-section", openSection);
  }, []);

  return null;
}
