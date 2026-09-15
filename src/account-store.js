import {useEffect,useState} from 'react';
import {KEY,initial} from './invoice-engine.js';
import {normalizeAccounts} from './account-master.js';
export function readAccounts(seed){
  const raw=localStorage.getItem(KEY);
  const state=raw?JSON.parse(raw):initial();
  if(!state||!Array.isArray(state.accounts)||!Array.isArray(state.journals))throw Error('Stored accounting data could not be read. No data has been overwritten.');
  return normalizeAccounts(state,seed);
}
export function writeAccounts(state){localStorage.setItem(KEY,JSON.stringify(state));window.dispatchEvent(new Event('wayvida-accounts-updated'));}
export function useAccountOptions(seed){
  const [revision,setRevision]=useState(0);
  useEffect(()=>{const refresh=()=>setRevision(x=>x+1);window.addEventListener('storage',refresh);window.addEventListener('wayvida-accounts-updated',refresh);return()=>{window.removeEventListener('storage',refresh);window.removeEventListener('wayvida-accounts-updated',refresh)}},[]);
  void revision;
  try{return readAccounts(seed).accounts.filter(a=>a.active&&!a.isGroup).reduce((groups,a)=>{(groups[a.type]??=[]).push([a.code,a.name,'₹0']);return groups},Object.fromEntries(Object.keys(seed).map(k=>[k,[]])))}catch{return seed}
}
