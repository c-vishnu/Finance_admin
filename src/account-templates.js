// Suggestions only. Applying a template is an explicit, validated import.
export const ACCOUNT_TEMPLATES={
 'Service Business':[['Service Income','Income'],['Professional Fees','Expenses'],['Office Rent Expense','Expenses']],
 Retail:[['Product Sales','Income'],['Inventory','Assets'],['Purchase','Expenses'],['Store Rent Expense','Expenses']],
 Manufacturing:[['Product Sales','Income'],['Raw Materials','Assets'],['Work in Progress','Assets'],['Factory Equipment','Assets'],['Factory Utilities','Expenses']],
 Startup:[['Sales Revenue','Income'],['Salary','Expenses'],['Office Rent Expense','Expenses'],['Software Subscriptions','Expenses'],['Marketing','Expenses']],
};
export function templateRows(name,accounts){return (ACCOUNT_TEMPLATES[name]||[]).filter(([name])=>!accounts.some(a=>a.name.trim().toLowerCase()===name.toLowerCase())).map(([name,type])=>({name,type,code:'',description:''}));}
export function nameSuggestion(name,type){const text=name.trim().toLowerCase();if(type==='Expenses'){if(text==='internet')return 'Internet Expense';if(text==='office rent'||text==='rent')return 'Office Rent Expense';if(text==='software')return 'Software Subscriptions';}if(type==='Income'&&text==='service')return 'Service Income';return '';}
