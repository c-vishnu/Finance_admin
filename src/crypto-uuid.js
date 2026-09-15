/* crypto.randomUUID exists only in a secure context (HTTPS or localhost).
   A VM opened over http://<ip> has crypto.getRandomValues but not randomUUID,
   and demo bootstrap then throws before the UI mounts. */

export function createRandomUUID(cryptoObj=globalThis.crypto){
  if(typeof cryptoObj?.randomUUID==='function')return cryptoObj.randomUUID.bind(cryptoObj);
  return function randomUUID(){
    const bytes=new Uint8Array(16);
    if(typeof cryptoObj?.getRandomValues==='function')cryptoObj.getRandomValues(bytes);
    else for(let i=0;i<16;i++)bytes[i]=Math.random()*256|0;
    bytes[6]=(bytes[6]&0x0f)|0x40;
    bytes[8]=(bytes[8]&0x3f)|0x80;
    const hex=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  };
}

export function installRandomUUID(target=globalThis.crypto){
  if(!target||typeof target.randomUUID==='function')return target?.randomUUID;
  const fallback=createRandomUUID(target);
  try{Object.defineProperty(target,'randomUUID',{value:fallback,configurable:true})}
  catch{try{target.randomUUID=fallback}catch{/* non-writable Crypto object */}}
  return target.randomUUID||fallback;
}

installRandomUUID();
