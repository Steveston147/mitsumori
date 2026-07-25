import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import JapaneseCourseCosts from "./components/JapaneseCourseCosts.jsx";
import StudentCollaborationCosts from "./components/StudentCollaborationCosts.jsx";
import CommonCosts from "./components/CommonCosts.jsx";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
    <JapaneseCourseCosts />
    <StudentCollaborationCosts />
    <CommonCosts />
  </React.StrictMode>
);
