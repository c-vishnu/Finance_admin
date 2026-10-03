import React, { useEffect } from 'react';
import { pageLabel, useTerminology } from './terminology.jsx';
import {
  IconChevronLeft,
  IconListDetails,
  IconBook,
  IconCalculator,
  IconChartHistogram,
  IconFileText,
  IconScale,
  IconTrendingUp,
  IconChartPie,
  IconCashBanknote,
  IconUsers,
  IconTruck,
  IconBuildingBank,
  IconShieldCheck,
  IconReceipt,
  IconPercentage,
  IconShoppingCart,
  IconPackage,
  IconReceiptTax,
  IconBuilding
} from '@tabler/icons-react';
import './reports-secondary-nav.css';

export const REPORT_GROUPS = [
  {
    heading: 'TRANSACTION REPORTS',
    items: [
      { label: 'Transaction Register', page: 'Transaction Register', icon: IconListDetails },
      { label: 'Journal Report', page: 'Journal Report', icon: IconCalculator }
    ]
  },
  {
    heading: 'ACCOUNTING REPORTS',
    items: [
      { label: 'General Ledger', page: 'General Ledger', icon: IconChartHistogram },
      { label: 'Trial Balance', page: 'Trial Balance', icon: IconScale }
    ]
  },
  {
    heading: 'FINANCIAL STATEMENTS',
    items: [
      { label: 'Profit & Loss', page: 'Profit & Loss', icon: IconTrendingUp },
      { label: 'Balance Sheet', page: 'Balance Sheet', icon: IconChartPie },
      { label: 'Cash Flow Statement', page: 'Cash Flow Statement', icon: IconCashBanknote }
    ]
  },
  {
    heading: 'RECEIVABLES & PAYABLES',
    items: [
      { label: 'Customer Outstanding', page: 'Customer Outstanding', icon: IconUsers },
      { label: 'Supplier Outstanding', page: 'Supplier Outstanding', icon: IconTruck }
    ]
  },
  {
    heading: 'CASH & BANKING',
    items: [
      { label: 'Cash & Bank Book', page: 'Cash & Bank Book', icon: IconBuildingBank },
      { label: 'Bank Reconciliation', page: 'Bank Reconciliation Report', icon: IconShieldCheck }
    ]
  },
  {
    heading: 'TAX & COMPLIANCE',
    items: [
      { label: 'GST / Tax Reports', page: 'GST Reports', icon: IconReceipt },
      { label: 'TDS Reports', page: 'TDS Reports', icon: IconPercentage }
    ]
  },
  {
    heading: 'BUSINESS REPORTS',
    items: [
      { label: 'Sales Report', page: 'Sales Report', icon: IconShoppingCart },
      { label: 'Purchase Report', page: 'Purchase Report', icon: IconPackage },
      { label: 'Expense Report', page: 'Expense Report', icon: IconReceiptTax },
      { label: 'Fixed Asset Report', page: 'Asset Register', icon: IconBuilding }
    ]
  },
  {
    heading: 'AUDIT',
    items: [
      { label: 'Audit Log', page: 'Audit Log', icon: IconShieldCheck }
    ]
  }
];

export const REPORT_PAGES = [
  ...REPORT_GROUPS.flatMap(group => group.items.map(item => item.page)),
  'Customer Aging',
  'Supplier Aging'
];

export function isReportPage(page) {
  return REPORT_PAGES.includes(page);
}

export default function ReportsSecondaryNav({ active, onNavigate, onToggleNav = () => document.body.classList.toggle('navCollapsed') }) {
  const { t } = useTerminology();

  useEffect(() => {
    document.body.classList.add('hasReportsNav');
    return () => {
      document.body.classList.remove('hasReportsNav');
    };
  }, []);

  return (
    <aside className="reportsSecondarySidebar" aria-label="Reports secondary navigation">
      <div className="reportsSecondaryHeader">
        <button
          type="button"
          className="reportsCollapseToggle"
          aria-label="Collapse navigation"
          title="Collapse navigation"
          onClick={onToggleNav}
        >
          <IconChevronLeft size={14} />
        </button>
        <span className="reportsSecondaryTitle">Reports</span>
      </div>
      <div className="reportsSecondaryNavInner">
        {REPORT_GROUPS.map((group, groupIdx) => (
          <div key={group.heading} className="reportsNavGroup">
            {groupIdx > 0 && <div className="reportsNavDivider" />}
            <div className="reportsNavHeading">{group.heading}</div>
            <div className="reportsNavItems">
              {group.items.map(item => {
                const isSelected = active === item.page;
                const displayLabel = pageLabel(item.label, t);
                return (
                  <button
                    key={item.page}
                    type="button"
                    className={`reportsNavItem ${isSelected ? 'selected' : ''}`}
                    aria-current={isSelected ? 'page' : undefined}
                    onClick={() => onNavigate(item.page)}
                  >
                    <span>{displayLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
