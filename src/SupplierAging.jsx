import AgingReport from './AgingReport.jsx';

/* Supplier Aging is the payable side of the shared aging page: one row per supplier, one column per
   aging bucket. The route is its own so the sidebar leaf, the page heading and the export all read
   Supplier Aging, and the page body is the ONE component both sides of the ledger share. */
export default function SupplierAging(props){
  return <AgingReport {...props} kind="supplier"/>;
}
