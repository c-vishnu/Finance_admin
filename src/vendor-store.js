export const VENDOR_KEY='wayvida-vendors-v1';

export const vendorDefaults={
  name:'',code:'',type:'Supplier',displayName:'',status:'Active',contactName:'',phone:'',email:'',website:'',
  billing:{line1:'',line2:'',city:'',state:'',country:'India',pin:''},shipping:{line1:'',line2:'',city:'',state:'',country:'India',pin:''},
  gstRegistered:false,gstin:'',gstTreatment:'Unregistered Business',pan:'',tdsApplicable:false,tdsSection:'',tdsRate:'',
  payableAccountId:'2000',purchaseAccountId:'',currency:'INR',branch:'Kochi Branch',costCentre:'',paymentTerms:'30 Days',
  creditLimit:'0',paymentMode:'Bank Transfer',bankName:'',accountHolder:'',accountNumber:'',ifsc:'',bankBranch:'',
  openingBalance:'0',openingType:'Credit',attachments:[],notes:''
};

export const vendorSeeds=[
  {...vendorDefaults,id:'ven-1',code:'VEN-00001',name:'Kerala Office Supplies',displayName:'Kerala Office Supplies',type:'Distributor',phone:'+91 98470 11223',email:'accounts@keralaoffice.example',gstRegistered:true,gstin:'32ABCDE1234F1Z5',gstTreatment:'Registered Business',pan:'ABCDE1234F',paymentTerms:'30 Days',creditLimit:'500000',openingBalance:'50000',status:'Active',balance:118000,createdBy:'Admin',createdAt:'2026-09-01T09:30:00.000Z'},
  {...vendorDefaults,id:'ven-2',code:'VEN-00002',name:'Cloudstack Services',displayName:'Cloudstack Services',type:'Service Provider',phone:'+91 98765 41002',email:'billing@cloudstack.example',gstRegistered:true,gstin:'29AAACC1206D1ZQ',gstTreatment:'Registered Business',pan:'AAACC1206D',paymentTerms:'15 Days',openingBalance:'0',status:'Active',balance:25000,createdBy:'Admin',createdAt:'2026-09-02T10:15:00.000Z'},
  {...vendorDefaults,id:'ven-3',code:'VEN-00003',name:'Metro Maintenance Works',displayName:'Metro Maintenance Works',type:'Contractor',phone:'+91 98950 88221',paymentTerms:'Due Immediately',tdsApplicable:true,tdsSection:'194C',tdsRate:'1',status:'Blocked',balance:0,createdBy:'Admin',createdAt:'2026-09-03T12:00:00.000Z'}
];

export function readVendors(storage=globalThis.localStorage){try{const value=JSON.parse(storage.getItem(VENDOR_KEY));return Array.isArray(value)?value:vendorSeeds}catch{return vendorSeeds}}
export function writeVendors(rows,storage=globalThis.localStorage){storage.setItem(VENDOR_KEY,JSON.stringify(rows));return rows}
export function nextVendorCode(rows){const next=Math.max(0,...rows.map(x=>Number(String(x.code||'').match(/\d+/)?.[0]||0)))+1;return `VEN-${String(next).padStart(5,'0')}`}
export function validateVendor(vendor,rows=[]){
  const errors={};
  if(!vendor.name?.trim())errors.name='Vendor name is required.';
  if(rows.some(x=>x.id!==vendor.id&&x.name.trim().toLowerCase()===vendor.name?.trim().toLowerCase()))errors.name='A vendor with this name already exists.';
  if(!vendor.phone?.trim())errors.phone='Phone number is required.';
  else if(!/^\+?[\d\s()-]{7,20}$/.test(vendor.phone))errors.phone='Enter a valid phone number.';
  if(vendor.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vendor.email))errors.email='Enter a valid email address.';
  if(vendor.gstRegistered&&!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(vendor.gstin||''))errors.gstin='Enter a valid 15-character GSTIN.';
  if(vendor.pan&&!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(vendor.pan))errors.pan='Use PAN format ABCDE1234F.';
  if(vendor.tdsApplicable&&(!vendor.tdsSection||Number(vendor.tdsRate)<=0))errors.tds='Select a TDS section and enter a rate.';
  if(!vendor.payableAccountId)errors.payableAccountId='Accounts Payable mapping is required.';
  if(Number(vendor.creditLimit)<0)errors.creditLimit='Credit limit cannot be negative.';
  if(Number(vendor.openingBalance)<0)errors.openingBalance='Opening balance cannot be negative.';
  return errors;
}
