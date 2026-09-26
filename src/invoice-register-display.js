/* The register states an invoice lifecycle in three words - Draft, Pending, Published - the same
   vocabulary the Journal Entries register uses, because the stored status carries detail (Sent,
   Partially Paid, Overdue) that a list column cannot explain and a reader does not need there.
   POSTED is what makes a document Published: the invoice reaches the ledger only when it is posted,
   so Approved, Sent, Partially Paid, Paid and Overdue all read as Published here. Cancelled is kept
   as its own word rather than folded into Published, because a cancelled invoice never posted and
   calling it Published would be a lie. Presentation only - nothing here changes a stored status. */
export function invoiceDisplayStatus(invoice={}){
 const status=String(invoice.status||'');
 if(status==='Cancelled')return 'Cancelled';
 if(invoice.posted)return 'Published';
 if(status==='Pending Approval')return 'Pending';
 return 'Draft';
}
export const INVOICE_DISPLAY_TONES={Draft:'neutral',Pending:'warn',Published:'info',Cancelled:'danger'};
export function invoiceDisplayTone(invoice){
 return INVOICE_DISPLAY_TONES[invoiceDisplayStatus(invoice)]||'neutral';
}
