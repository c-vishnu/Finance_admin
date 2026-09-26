/* The shared searchable picker (src/SearchSelect.jsx).

   It was extracted from the Create / Edit Customer form so a screen that picks a VALUE and a screen
   that picks a RECORD shared one control instead of two hand-rolled dropdowns. These assertions pin
   the parts its remaining hosts depend on: one combobox trigger, a search field inside the popover,
   string OR object options, keyboard navigation, and a root that is a div so label activation can
   never re-fire it.

   The Sales Order left this control on 2026-09-25: its customer field is a plain search box with the
   matches listed under it (CustomerSearch in src/SalesDocumentFields.jsx), which is one gesture
   rather than open-then-search. The last test pins both sides of that split. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const picker=readFileSync('src/SearchSelect.jsx','utf8');
const styles=readFileSync('src/search-select.css','utf8');
const customerForm=readFileSync('src/Customers.jsx','utf8');
const salesFields=readFileSync('src/SalesDocumentFields.jsx','utf8');

test('the picker is one accessible combobox with a search field',()=>{
 assert.match(picker,/<div className=\{'customerSelect'\+\(open\?' open':''\)\} ref=\{rootRef\}>/,'the root is a div, never a label, so an option row cannot re-fire the trigger');
 assert.match(picker,/role="combobox" aria-haspopup="listbox" aria-expanded=\{open\} aria-controls="customer-select-listbox"/,'the trigger is a real combobox');
 assert.match(picker,/onClick=\{\(\)=>open\?close\(\):openList\(\)\}/,'clicking the trigger opens and closes the list');
 assert.match(picker,/<div className="customerSelectSearch"><IconSearch size=\{15\}\/><input ref=\{inputRef\} aria-label=\{searchLabel\} placeholder="Type to search"/,'the popover holds the search field with its own search icon');
 assert.match(picker,/role="listbox" aria-label=\{listLabel\}/,'the options are a labelled listbox');
 assert.match(picker,/role="option" aria-selected=\{item\.value===value\}/,'and each row is an option');
 assert.match(picker,/onPointerDown=\{event=>\{event\.preventDefault\(\);commit\(item\)\}\}/,'an option commits on pointerdown, before a blur can close the list first');
 assert.match(picker,/focus\(\)/,'opening moves focus into the search field so typing filters straight away');
});

test('the trigger states what it is before anything is chosen',()=>{
 assert.match(picker,/<span className="customerSelectPrompt"><IconSearch size=\{15\}\/><span className="customerSelectPlaceholder">\{placeholder\}<\/span><\/span>/,'an empty trigger shows the search icon beside the placeholder');
 assert.match(picker,/aria-label=\{selected\?selected\.label:placeholder\}/,'and names itself from the selection or the placeholder');
 assert.match(styles,/\.customerSelect \.customerSelectPrompt\{display:flex;align-items:center;gap:8px;min-width:0\}/,'the icon and the placeholder sit together, with the chevron pushed to the right');
});

test('options may be plain strings or records, and onChange always receives the value',()=>{
 assert.match(picker,/const items=useMemo\(\(\)=>options\.map\(option=>typeof option==='string'\?\{value:option,label:option\}:option\),\[options\]\);/,'a string option is normalised to the same shape as a record option');
 assert.match(picker,/const selected=items\.find\(item=>item\.value===value\)\|\|null;/,'the trigger reads the label of the selected value');
 assert.match(picker,/const commit=item=>\{onChange\(item\.value\);close\(\)\};/,'and the caller is handed the value, never the label');
 assert.match(picker,/const matches=useMemo\(\(\)=>\{const needle=query\.trim\(\)\.toLowerCase\(\);return needle\?items\.filter\(item=>\(item\.label\+' '\+\(item\.hint\|\|''\)\)\.toLowerCase\(\)\.includes\(needle\)\):items\},\[items,query\]\);/,'typing searches the label and the hint, so a customer can be found by name or code');
 assert.match(picker,/\{item\.label\}\{item\.hint&&<small>\{item\.hint\}<\/small>\}/,'a record option prints its second line under the label');
});

test('the picker is keyboard and pointer driven',()=>{
 assert.match(picker,/if\(event\.key==='Escape'\)\{event\.preventDefault\(\);close\(\);return\}/,'Escape closes');
 assert.match(picker,/if\(event\.key==='Enter'\)\{event\.preventDefault\(\);if\(matches\[active\]\)commit\(matches\[active\]\);return\}/,'Enter commits the active row');
 assert.match(picker,/if\(event\.key!=='ArrowDown'&&event\.key!=='ArrowUp'\)return;/,'the arrows move the active row');
 assert.match(picker,/document\.addEventListener\('pointerdown',away\)/,'and a pointerdown outside closes the list');
});

test('its styles travel with it and outrank the host page element rules',()=>{
 assert.match(picker,/import '\.\/search-select\.css';/,'the component imports its own sheet, so any page that mounts it gets the styling');
 assert.match(styles,/\.customerSelect \.customerSelectTrigger\{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;min-height:40px;padding:7px 10px;border:1px solid #d7e0eb;border-radius:7px/,'the rules are scoped to the component root');
 assert.match(readFileSync('src/invoice-workspace.css','utf8'),/\.invoiceWorkspace button\{border:1px solid #dce3ee/,'which is required because the sales order page styles every bare button at class-plus-element specificity');
 assert.ok(!/\.customersPage \.customerSelect/.test(readFileSync('src/customers.css','utf8')),'and they no longer live under the customers page scope');
 assert.match(styles,/\.customerSelect \.customerSelectOptionLabel small\{margin-top:0;/,'the option hint resets the host sheet small rule');
});

test('the customer form picks through the shared picker, and the sales order types straight into its own',()=>{
 assert.match(customerForm,/import SearchSelect from '\.\/SearchSelect\.jsx';/,'the customer form imports the shared picker');
 assert.match(customerForm,/<SearchSelect value=\{form\.state\} options=\{customerStates\}/,'and still uses it for the place of supply over the plain string list');
 assert.ok(!salesFields.includes("import SearchSelect"),'the sales order no longer mounts it: a search box with its matches under it is one gesture, where a trigger into a popover is two');
 assert.match(salesFields,/function CustomerSearch\(\{customers,value,onSelect,onEditCustomer\}\)\{/,'so the sales order carries its own search box');
 assert.match(salesFields,/role="listbox" aria-label="Customers"/,'keeping the listbox and option roles, so the keyboard and a screen reader behave the same');
 assert.match(salesFields,/<input role="combobox" aria-label="Search customers" aria-expanded=\{open\} aria-autocomplete="list" aria-controls="so-customer-list"/,'and the same combobox contract on the field itself');
});
