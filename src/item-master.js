export const ITEM_CATEGORIES=['General','Products','Raw Materials','Finished Goods','Services','Professional Services'];
export const ITEM_TAX_RATES=['0','5','12','18','28'];
export const ITEM_CESS_RATES=['0','1','5','12'];
export const ITEM_TAX_TREATMENTS=['Non-taxable','Exempt','Zero Rated','Non-GST'];
export const gstSplit=rate=>{const value=Math.max(0,Number(rate)||0);return {rate:value,cgst:value/2,sgst:value/2,igst:value}};
export const ITEM_UNITS=['box','cm','dz','ft','g','kg','km','lb','pcs','m','mm','L','ml','pack','pair','set','hour','day'];
export const blankItem=(defaults={})=>({name:'',type:'Goods',unit:'pcs',sku:'',category:'General',hsnSac:'',description:'',image:'',sales:false,purchase:false,price:'',cost:'',salesAccount:defaults.salesAccount||'',purchaseAccount:defaults.purchaseAccount||'',trackInventory:false,inventoryAccount:defaults.inventoryAccount||'',cogsAccount:defaults.cogsAccount||'',openingQuantity:'',openingRate:'',openingDate:'2026-09-05',warehouseId:defaults.warehouseId||'',taxPreference:'Non-taxable',taxApplicable:false,taxRate:String(defaults.taxRate||'18'),interStateTaxRate:String(defaults.interStateTaxRate||defaults.taxRate||'18'),cessRate:'0',priceTaxMode:'exclusive',organizationId:defaults.organizationId||'abc',currency:defaults.currency||'INR'});
export const generateSku=(items,organizationId)=>{let number=1;while(items.some(item=>item.organizationId===organizationId&&item.sku===`ITEM-${String(number).padStart(4,'0')}`))number++;return `ITEM-${String(number).padStart(4,'0')}`};
export const openingValue=form=>Number(form.openingQuantity||0)*Number(form.openingRate||0);
export function validateItem(form,items,accounts){
 const errors={},exists=(type,code)=>Boolean((accounts[type]||[]).some(account=>account[0]===code));
 if(!form.name?.trim())errors.name='Enter an item name.';
 if(items.some(item=>item.id!==form.id&&item.organizationId===form.organizationId&&item.name.toLowerCase()===form.name.trim().toLowerCase()))errors.name='An item with this name already exists in this organisation.';
 if(form.sku&&items.some(item=>item.id!==form.id&&item.organizationId===form.organizationId&&String(item.sku).toLowerCase()===form.sku.trim().toLowerCase()))errors.sku='This SKU is already used in this organisation.';
 if(!['Goods','Service'].includes(form.type))errors.type='Select Goods or Service.';
 if(!form.unit)errors.unit='Select a unit.';
 if(form.hsnSac&&!/^\d{4,8}$/.test(form.hsnSac))errors.hsnSac=`Enter a valid ${form.type==='Goods'?'HSN':'SAC'} code (4–8 digits).`;
 if(form.sales){if(form.price===''||!Number.isFinite(Number(form.price))||Number(form.price)<0)errors.price='Enter a valid, non-negative selling price.';if(!exists('Income',form.salesAccount))errors.salesAccount='Select an Income account.'}
 if(form.purchase){if(form.cost!==''&&(!Number.isFinite(Number(form.cost))||Number(form.cost)<0))errors.cost='Enter a valid, non-negative purchase price.';if(!exists('Expenses',form.purchaseAccount))errors.purchaseAccount='Select a purchase account.'}
 if(form.type==='Goods'&&form.trackInventory){if(!exists('Assets',form.inventoryAccount))errors.inventoryAccount='Select an inventory asset account.';if(!exists('Expenses',form.cogsAccount))errors.cogsAccount='Select a cost of goods sold account.';if(form.openingQuantity!==''&&(!Number.isFinite(Number(form.openingQuantity))||Number(form.openingQuantity)<0))errors.openingQuantity='Opening quantity cannot be negative.';if(form.openingRate!==''&&(!Number.isFinite(Number(form.openingRate))||Number(form.openingRate)<0))errors.openingRate='Opening rate cannot be negative.';if(Number(form.openingQuantity)>0&&!form.warehouseId)errors.warehouseId='Select a branch or warehouse.'}
 if(form.taxPreference==='Taxable'){if(!Number.isFinite(Number(form.taxRate))||Number(form.taxRate)<0||Number(form.taxRate)>100)errors.taxRate='Select a valid GST rate.';if(!Number.isFinite(Number(form.interStateTaxRate))||Number(form.interStateTaxRate)<0||Number(form.interStateTaxRate)>100)errors.interStateTaxRate='Select a valid GST rate.'}
 return errors;
}
