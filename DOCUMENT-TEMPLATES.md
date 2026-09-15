# Customer document previews

Receipts, invoices, credit notes and sales orders use the shared `DocumentPreview` and `DocumentSheet` components.

## Using templates

Saving a document no longer opens a preview automatically. Click **Print preview** to open the saved/default template with Print, Share, Customize and Close actions. The supplied Wayvida logo is shown by default; previously uploaded custom logos are retained.

Preview is embedded in the dashboard content area. The existing navigation sidebar and header remain visible and usable; the document page's other content is temporarily hidden until Close. Customize opens a right-hand panel within the preview. Only the customer document and its logo print; dashboard chrome and customization controls are excluded.

**Customize** opens a right-side drawer without leaving the document. Business/branding and footer/signature settings are collapsed by default. Save changes applies the layout and closes the drawer. The drawer also offers a default for future documents of that type. Closing the preview returns to the document page. Print excludes all controls and the drawer while retaining the logo. Share invokes native text sharing or copies the document summary; it does not upload a document or create a public link. To send the printout, save a PDF through Print and attach it.

Choose Classic, Modern or Minimal. Customize the business name/address/contact, logo, accent colour, footer, terms and signature label. Shipping address and signature line can be switched off. The issuer name must be entered before printing; the application brand is not assumed to be the legal issuing business. Logos accept PNG/JPEG/WebP, up to 500 KB.

**Save template** saves settings for this document. **Use as default** also changes the default for new documents of this type. A first preview pins the current default; subsequently changing the default does not overwrite an existing saved layout. Changes after opening remain unsaved until Save, Use as default, or Print is pressed.

**Print / Save PDF** prints the customer document only. Choose Save as PDF in the browser/system dialog for a PDF. Use A4 and disable the browser's own headers/footers. This is browser printing, not a server-generated PDF download.

## Data integrity

- Settings are browser-local under `wayvida-print-templates-v1`, separate from accounting and sales order storage.
- Totals and calculated line amounts come from saved document snapshots, never from editable template text.
- Receipts show actual allocations; voided applications remain identified. Draft receipt plans are not presented as applied payments.
- Draft/unposted and cancelled/reversed statuses remain visible. Sales orders are identified as neither invoices nor proof of payment.
- Legacy sales order totals are converted from their saved rupee unit for display; missing historical tax detail is not fabricated.
- No journal, ledger, approval or transaction-state changes occur when selecting or printing templates.
- These templates do not certify statutory invoice completeness; they show the fields already recorded.

## Verification

Automated tests cover separate defaults, document-specific persistence, invalid image sources, unchanged transaction storage, exact totals, all four document types across all three layouts, status labels and escaping of customer text. The full app is compiled, alongside existing receipt/invoice/credit/order regression tests. Browser print pagination remains dependent on the chosen printer and browser settings.
