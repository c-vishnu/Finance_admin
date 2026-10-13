const fs = require('fs');
let code = fs.readFileSync('Finance_admin/src/Customers.jsx', 'utf8');

if (code.includes("if (!form.firstName.trim()) err.firstName")) {
  code = code.replace(
    "if (!form.firstName.trim()) err.firstName = 'Enter the first name.';\n      const compiledName = [form.salutation, form.firstName, form.lastName].filter(Boolean).join(' ').trim();\n      if (!compiledName) err.name = 'Enter the customer name.';",
    "const compiledName = (form.contact || form.firstName || [form.salutation, form.firstName, form.lastName].filter(Boolean).join(' ')).trim();\n      if (!compiledName) { err.contact = 'Enter the primary contact name.'; err.firstName = 'Enter the primary contact name.'; }"
  );
}

code = code.replace("if(placeOfSupplyApplicable(form.gstTreatment)){if(!form.state.trim())err.state='Select the place of supply.';}\n", "");

code = code.replace(
  "const finalName=(individual ? [form.salutation, form.firstName, form.lastName].filter(Boolean).join(' ') : form.name).trim();",
  "const finalName=(individual ? (form.contact || [form.salutation, form.firstName, form.lastName].filter(Boolean).join(' ')) : form.name).trim();"
);

const oldRow2Marker = "/* Row 2: Salutation, First name, Last name, Customer Email, Customer Phone */";
if (code.includes(oldRow2Marker)) {
  const start = code.indexOf(oldRow2Marker);
  const end = code.indexOf("</section>", start);
  const newRow2Section = `/* Row 2: Primary Contact Name, Customer Email, Customer Phone */
          <div className="itemFormGrid customerFormRow2">
            {field('contact', 'Primary Contact Name' + (form.type === 'Individual' ? ' *' : ''))}
            {field('email', 'Customer Email', { type: 'email' })}
            {field('phone', 'Customer Phone', { type: 'tel' })}
          </div>
        `;
  code = code.substring(0, start) + newRow2Section + code.substring(end);
}

const sec2Start = code.indexOf("/* Section 2 — Tax & Financial Details */");
if (sec2Start !== -1) {
  const gridIdx = code.indexOf('<div className="itemFormGrid">', sec2Start);
  if (gridIdx !== -1) {
    code = code.substring(0, gridIdx) + '<div className="itemFormGrid itemFormGrid4">' + code.substring(gridIdx + '<div className="itemFormGrid">'.length);
  }
}

code = code.replace(/\{showPlaceOfSupply && \([\s\S]*?\)\}\n?/g, '');
code = code.replace(/\{field\('status', 'Status', \{ options: CUSTOMER_STATUSES \}\)\}\n?/g, '');

fs.writeFileSync('Finance_admin/src/Customers.jsx', code, 'utf8');
console.log('Successfully updated Customers.jsx');
