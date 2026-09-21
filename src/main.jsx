import "./crypto-uuid.js";
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import HeaderOrgSelectors from "./HeaderOrgSelectors.jsx";
import "./styles.css";
import "./typography.css";
import "./ui-system.css";
import "./journal-form.css";
import "./ui-quality-polish.css";
import "./register-head.css";
import {installAuditLog} from './audit-log.js';
import {installRegisterHead} from './register-head.js';
import {bootstrapDemoData} from './demo-data.js';
import {TerminologyProvider} from './terminology.jsx';
import WayvidaDatePicker from './WayvidaDatePicker.jsx';

const root=document.getElementById("root");
class StartError extends React.Component{
  constructor(props){super(props);this.state={error:null}}
  static getDerivedStateFromError(error){return {error}}
  render(){
    if(!this.state.error)return this.props.children;
    return <p style={{margin:24,font:"16px/1.45 Instrument Sans,Arial,sans-serif"}}>Wayvida Books could not start. {String(this.state.error.message||this.state.error)}</p>;
  }
}

try{
  installAuditLog();
  installRegisterHead();
  bootstrapDemoData();
  createRoot(root).render(
    <React.StrictMode>
      <StartError>
        <TerminologyProvider>
          <App />
          <HeaderOrgSelectors />
          <WayvidaDatePicker />
        </TerminologyProvider>
      </StartError>
    </React.StrictMode>,
  );
}catch(error){
  root.textContent="Wayvida Books could not start. "+(error?.message||error);
}
