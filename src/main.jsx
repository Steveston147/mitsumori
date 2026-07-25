import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ProgramBasicInfo from "./components/ProgramBasicInfo.jsx";
import JapaneseCourseCosts from "./components/JapaneseCourseCosts.jsx";
import StudentCollaborationCosts from "./components/StudentCollaborationCosts.jsx";
import CommonCosts from "./components/CommonCosts.jsx";
import BuildUpSummary from "./components/BuildUpSummary.jsx";
import EstimateExcelExport from "./components/EstimateExcelExport.jsx";
import EstimateExcelImport from "./components/EstimateExcelImport.jsx";
import BuildUpResetBridge from "./components/BuildUpResetBridge.jsx";
import ProjectWorkspace from "./components/ProjectWorkspace.jsx";
import ProfessionalUiShell from "./components/ProfessionalUiShell.jsx";
import BuildUpWorkspace from "./components/BuildUpWorkspace.jsx";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
    <ProfessionalUiShell />
    <ProgramBasicInfo />
    <ProjectWorkspace />
    <EstimateExcelExport />
    <EstimateExcelImport />
    <BuildUpWorkspace />
    <JapaneseCourseCosts />
    <StudentCollaborationCosts />
    <CommonCosts />
    <BuildUpSummary />
    <BuildUpResetBridge />
  </React.StrictMode>
);
