import {outstanding} from './invoice-engine.js';

const matches=(value,options)=>options.filter(Boolean).includes(value);

export function documentMatchesScope(document,organisation,branch){
 if(!document||!organisation||!branch)return false;
 const organisationValue=document.organizationId||document.companyId||document.organizationName;
 const branchValue=document.branchId||document.branchName||document.branch;
 return matches(organisationValue,[organisation.id,organisation.code,organisation.name])&&matches(branchValue,[branch.id,branch.name]);
}

/* A document that predates scope tagging carries neither an organisation nor a
   branch, so it belongs to whatever scope is reading it. A document that names
   one must match. */
export function documentInScope(document,organisation,branch){
 if(!document)return false;
 const organisationValue=document.organizationId||document.companyId||document.organizationName;
 const branchValue=document.branchId||document.branchName||document.branch;
 if(!organisationValue&&!branchValue)return true;
 return documentMatchesScope(document,organisation,branch);
}

export function accountMatchesScope(account,organisation,branch){
 if(!account?.active||account.isGroup||!organisation||!branch)return false;
 const organisations=account.organizationIds?.length?account.organizationIds:[account.organizationId].filter(Boolean);
 if(organisations.length&&!organisations.some(value=>matches(value,[organisation.id,organisation.code,organisation.name,'default'])))return false;
 if(account.scope!=='Branch Specific Account')return true;
 const branches=account.applicableBranches?.length?account.applicableBranches:[account.branchId].filter(Boolean);
 return branches.some(value=>matches(value,[branch.id,branch.name]));
}

export function invoiceBalance(state,invoice){return outstanding(state,invoice)}
export function billBalance(bill){return bill.total-(bill.paidAmount||0)-(bill.creditApplied||0)}

export function eligibleInvoices(state,customerId,organisation,branch,date){
 return (state?.invoices||[]).filter(invoice=>invoice.customerId===customerId&&invoice.posted&&invoice.status!=='Cancelled'&&invoice.date<=date&&documentInScope(invoice,organisation,branch)&&invoiceBalance(state,invoice)>0);
}

export function eligibleBills(state,vendorId,organisation,branch,date){
 return (state?.purchaseBills||state?.bills||[]).filter(bill=>bill.vendorId===vendorId&&bill.posted&&bill.status!=='Cancelled'&&bill.date<=date&&documentInScope(bill,organisation,branch)&&billBalance(bill)>0);
}
