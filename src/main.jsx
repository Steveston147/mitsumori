import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ProgramBasicInfo from "./components/ProgramBasicInfo.jsx";
import JapaneseCourseCosts from "./components/JapaneseCourseCosts.jsx";
import StudentCollaborationCosts from "./components/StudentCollaborationCosts.jsx";
import CommonCosts from "./components/CommonCosts.jsx";
import BuildUpSummary from "./components/BuildUpSummary.jsx";
import FormalDocument from "./components/FormalDocument.jsx";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
    <ProgramBasicInfo />
    <JapaneseCourseCosts />
    <StudentCollaborationCosts />
    <CommonCosts />
    <BuildUpSummary />
    <FormalDocument />
  </React.StrictMode>
);
