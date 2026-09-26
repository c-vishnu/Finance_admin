import {useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {IconBuildingCommunity,IconBuildingStore,IconCheck,IconChevronDown} from '@tabler/icons-react';
import './working-context.css';
import {getScopeOrganisations} from './organisation-context.js';
import {SWITCH_MODES,applyWorkingContext,initialsOf,toneOf} from './org-switcher.js';

const read=(key,fallback)=>{try{return localStorage.getItem(key)||fallback}catch{return fallback}};
const readList=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key));return Array.isArray(value)&&value.length?value:fallback}catch{return fallback}};

/* The working-context control: the organisation and branch switcher that sits
   directly under the Wayvida brand in the sidebar. The dropdown itself is the
   multi-selection surface for organisations and branches.

   The trigger renders in place. The panel is portalled to
   document.body, because the sidebar clips its own overflow
   (`.app>aside{height:100dvh;overflow:hidden}`) and anything taller than the
   sidebar's own column would be cut off inside it. The panel is positioned from
   the trigger's measured box, so a resize or a scroll re-places it. */
export default function WorkingContextSwitcher({theme='dark'}){
  const initialCompany=read('wayvida-demo-company','abc'),initialBranch=read('wayvida-demo-branch','abc-kochi');
  const [menu,setMenu]=useState(false),[menuBox,setMenuBox]=useState(null);
  const [companyIds,setCompanyIds]=useState(()=>readList('wayvida-context-companies',[initialCompany]));
  const [branchIds,setBranchIds]=useState(()=>readList('wayvida-context-branches',[initialBranch]));
  const [draftCompanies,setDraftCompanies]=useState(companyIds),[draftBranches,setDraftBranches]=useState(branchIds);
  const triggerRef=useRef(null),menuRef=useRef(null);
  const accessibleOrganizations=useMemo(()=>getScopeOrganisations(),[]);
  const company=accessibleOrganizations.find(item=>item.id===companyIds[0])||accessibleOrganizations[0];
  const allBranches=useMemo(()=>accessibleOrganizations.filter(item=>draftCompanies.includes(item.id)).flatMap(item=>item.branches.map(branch=>({...branch,companyId:item.id}))),[accessibleOrganizations,draftCompanies]);
  const branch=accessibleOrganizations.flatMap(item=>item.branches).find(item=>item.id===branchIds[0])||company.branches[0];
  const selectedOrganizationNames=accessibleOrganizations.filter(item=>companyIds.includes(item.id)).map(item=>item.name);
  const selectedBranchNames=accessibleOrganizations.flatMap(item=>item.branches).filter(item=>branchIds.includes(item.id)).map(item=>item.name);
  const modeLabel=`${branchIds.length} ${branchIds.length===1?'branch':'branches'}`;

  function placeMenu(){
    const node=triggerRef.current;
    if(!node)return;
    const box=node.getBoundingClientRect();
    const width=Math.min(320,Math.max(248,box.width+40));
    const left=Math.round(Math.max(8,Math.min(box.left,window.innerWidth-width-8)));
    const below=window.innerHeight-box.bottom-8,above=box.top-8;
    const openUp=below<360&&above>=below;
    if(openUp)setMenuBox({left,width,bottom:Math.round(window.innerHeight-box.top)+8,maxHeight:Math.max(240,Math.round(above)),side:'top'});
    else setMenuBox({left,width,top:Math.round(box.bottom)+8,maxHeight:Math.max(240,Math.round(below)),side:'bottom'});
  }
  function openMenu(){setDraftCompanies(companyIds);setDraftBranches(branchIds);placeMenu();setMenu(true)}
  useEffect(()=>{
    if(!menu)return;
    const replace=()=>placeMenu();
    window.addEventListener('resize',replace);
    window.addEventListener('scroll',replace,true);
    return()=>{window.removeEventListener('resize',replace);window.removeEventListener('scroll',replace,true)};
  },[menu]);
  useEffect(()=>{
    if(!menu)return;
    const dismiss=event=>{
      if(event.key==='Escape'){setMenu(false);return}
      const node=event.target;
      if(!(node instanceof Element)||triggerRef.current?.contains(node)||menuRef.current?.contains(node))return;
      setMenu(false);
    };
    document.addEventListener('pointerdown',dismiss);
    document.addEventListener('keydown',dismiss);
    return()=>{document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',dismiss)};
  },[menu]);

  function toggle(list,setList,id){setList(list.includes(id)?list.filter(value=>value!==id):[...list,id])}
  function toggleCompany(id){const organization=accessibleOrganizations.find(item=>item.id===id);if(draftCompanies.includes(id)){setDraftCompanies(draftCompanies.filter(value=>value!==id));setDraftBranches(draftBranches.filter(value=>!organization.branches.some(branch=>branch.id===value)))}else setDraftCompanies([...draftCompanies,id])}
  function commitContext(companies,branches,mode){const context=applyWorkingContext(accessibleOrganizations,companies,branches,mode);if(!context)return false;setCompanyIds(companies);setBranchIds(branches);return true}
  function apply(){if(commitContext(draftCompanies,draftBranches,SWITCH_MODES.multi))setMenu(false)}

  const tooltipSummary=`Organisations: ${selectedOrganizationNames.join(', ')}\nBranches: ${selectedBranchNames.join(', ')}`;
  return <>
    <div className="wcIdentity workingContext" data-theme={theme}>
      <button type="button" ref={triggerRef} className="wcTrigger" aria-haspopup="true" aria-expanded={menu} aria-controls="wc-switcher" aria-label={`${companyIds.length} organisations and ${branchIds.length} branches selected`} data-summary={tooltipSummary} onClick={()=>menu?setMenu(false):openMenu()}>
        <span className={'wcMark'+(companyIds.length>1?' multi':'')} aria-hidden="true" style={{'--wc-logo-scale':company.logoScale||1,'--wc-mark-w':companyIds.length>1?'32px':company.logoWide?'56px':'32px'}}>{companyIds.length>1?<IconBuildingCommunity/>:company.logo?<img src={company.logo} alt=""/>:initialsOf(company.name)}</span>
        <span className="wcTriggerText">
          <b>{companyIds.length===1?company.name:`${companyIds.length} organisations`}</b>
          <small>{branchIds.length===1?branch.name:modeLabel}</small>
        </span>
        <IconChevronDown className={menu?'open':''}/>
      </button>
    </div>
    {menu&&menuBox&&createPortal(<div className="wcMenu" id="wc-switcher" ref={menuRef} data-theme={theme} data-side={menuBox.side} style={{top:menuBox.top,bottom:menuBox.bottom,left:menuBox.left,width:menuBox.width,maxHeight:menuBox.maxHeight||undefined}} aria-label="Switch organisation and branch">
      <p className="wcMenuHead">Organisation</p>
      <div className="wcMenuGroup organisations" role="group" aria-label="Organisations">
        {accessibleOrganizations.map(item=>{const active=draftCompanies.includes(item.id);return <button type="button" role="checkbox" aria-checked={active} className={'wcMenuRow'+(active?' active':'')} key={item.id} onClick={()=>toggleCompany(item.id)}>
          <span className="wcMenuMark" data-tone={toneOf(item.id)} aria-hidden="true" style={{'--wc-logo-scale':item.logoScale||1,'--wc-mark-w':item.logoWide?'48px':'28px'}}>{item.logo?<img src={item.logo} alt=""/>:initialsOf(item.name)}</span>
          <span className="wcMenuText"><b>{item.name}</b><small>{item.type}</small></span>
          <span className="wcMenuBox">{active&&<IconCheck/>}</span>
        </button>})}
      </div>
      <p className="wcMenuHead">Branch</p>
      <div className="wcMenuGroup branches" role="group" aria-label="Branches">
        {allBranches.map(item=>{const active=draftBranches.includes(item.id);return <button type="button" role="checkbox" aria-checked={active} className={'wcMenuRow'+(active?' active':'')} key={item.id} onClick={()=>toggle(draftBranches,setDraftBranches,item.id)}>
          <span className="wcMenuMark branch" aria-hidden="true"><IconBuildingStore/></span>
          <span className="wcMenuText"><b>{item.name}</b><small>{item.code}</small></span>
          <span className="wcMenuBox">{active&&<IconCheck/>}</span>
        </button>})}
      </div>
      <div className="wcMenuFooter"><span>{draftCompanies.length} organisations · {draftBranches.length} branches</span><div><button type="button" onClick={()=>setMenu(false)}>Cancel</button><button type="button" className="primary" disabled={!draftCompanies.length||!draftBranches.length} onClick={apply}>Apply</button></div></div>
    </div>,document.body)}
  </>;
}
