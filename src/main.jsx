import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import HeaderOrgSelectors from "./HeaderOrgSelectors.jsx";
import "./styles.css";
import "./typography.css";
import "./ui-system.css";
import "./journal-form.css";
import "./ui-quality-polish.css";
import {installAuditLog} from './audit-log.js';
import {bootstrapDemoData} from './demo-data.js';
import {TerminologyProvider} from './terminology.jsx';
import WayvidaDatePicker from './WayvidaDatePicker.jsx';

installAuditLog();
bootstrapDemoData();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <TerminologyProvider>
      <App />
      <HeaderOrgSelectors />
      <WayvidaDatePicker />
    </TerminologyProvider>
  </React.StrictMode>,
);
