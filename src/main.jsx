import "./crypto-uuid.js";
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
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
import {ExperienceModeProvider} from './ExperienceModeContext.jsx';
import WayvidaDatePicker from './WayvidaDatePicker.jsx';

const root=document.getElementById("root");
class StartError extends React.Component{
  constructor(props){super(props);this.state={error:null}}
  static getDerivedStateFromError(error){return {error}}
  render(){
    if(!this.state.error)return this.props.children;
    return (
      <div style={{margin:24,font:"14px/1.45 monospace,Courier,sans-serif",color:"#721c24",background:"#f8d7da",padding:24,borderRadius:8,border:"1px solid #f5c6cb"}}>
        <h3 style={{margin:"0 0 12px 0",fontFamily:"sans-serif"}}>Wayvida Books Startup Error</h3>
        <p style={{fontWeight:600,margin:"0 0 12px 0"}}>{String(this.state.error.message||this.state.error)}</p>
        <pre style={{whiteSpace:"pre-wrap",fontSize:12,background:"#fff",padding:12,borderRadius:4,border:"1px solid #f5c6cb",overflowX:"auto"}}>{this.state.error.stack}</pre>
        <button
          style={{marginTop:12,padding:"8px 16px",borderRadius:6,background:"#3478f6",color:"#fff",border:"none",cursor:"pointer",fontWeight:600,fontFamily:"sans-serif"}}
          onClick={()=>{window.location.reload()}}
        >
          Reload Page
        </button>
      </div>
    );
  }
}

try{
  installAuditLog();
  installRegisterHead();
  bootstrapDemoData();
  createRoot(root).render(
    <React.StrictMode>
      <StartError>
        <ExperienceModeProvider>
          <TerminologyProvider>
            <App />
            <WayvidaDatePicker />
          </TerminologyProvider>
        </ExperienceModeProvider>
      </StartError>
    </React.StrictMode>,
  );
}catch(error){
  root.textContent="Wayvida Books could not start. "+(error?.message||error);
}
