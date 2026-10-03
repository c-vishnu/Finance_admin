import AgingReport from './AgingReport.jsx';

/* Customer Aging is the receivable side of the shared aging page: one row per customer, one column per
   aging bucket. The route is its own so the sidebar leaf, the page heading and the export all read
   Customer Aging, and the page body is the ONE component both sides of the ledger share. */
export default function CustomerAging(props){
  return <AgingReport {...props} kind="customer"/>;
}
