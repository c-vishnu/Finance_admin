const fs = require('fs');

// JournalEntriesPro.jsx
let jv_content = fs.readFileSync('src/JournalEntriesPro.jsx', 'utf8');

jv_content = jv_content.replace(/'Wayvida Technologies Pvt Ltd'/g, "'Wayvida Learning'");
jv_content = jv_content.replace(/'Wayvida Retail Pvt Ltd'/g, "'Viskool'");
jv_content = jv_content.replace(/'Kochi \? Head Office'/g, "'Kochi'");
jv_content = jv_content.replace(/'Kochi - Head Office'/g, "'Kochi'");
jv_content = jv_content.replace(/'Kochi – Head Office'/g, "'Kochi'");
jv_content = jv_content.replace(/'Kozhikode'/g, "'Trivandrum'");

fs.writeFileSync('src/JournalEntriesPro.jsx', jv_content, 'utf8');

// period-locking.js
let pl_content = fs.readFileSync('src/period-locking.js', 'utf8');
pl_content = pl_content.replace(/'Wayvida Technologies Pvt Ltd'/g, "'Wayvida Learning'");
pl_content = pl_content.replace(/'Wayvida Retail Pvt Ltd'/g, "'Viskool'");
pl_content = pl_content.replace(/'abc-kozhikode'/g, "'abc-trivandrum'");
pl_content = pl_content.replace(/'northstar-bengaluru'/g, "'northstar-chennai'");
fs.writeFileSync('src/period-locking.js', pl_content, 'utf8');

// budget-store.js
let bs_content = fs.readFileSync('src/budget-store.js', 'utf8');
bs_content = bs_content.replace(/'Kozhikode Branch Budget'/g, "'Trivandrum Branch Budget'");
bs_content = bs_content.replace(/'abc-kozhikode'/g, "'abc-trivandrum'");
fs.writeFileSync('src/budget-store.js', bs_content, 'utf8');
