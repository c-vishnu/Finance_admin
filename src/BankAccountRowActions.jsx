import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  IconArrowsExchange,
  IconCheck,
  IconDotsVertical,
  IconEdit
} from '@tabler/icons-react';
import './sales-order-actions.css';

export default function BankAccountRowActions({
  account,
  onEdit,
  onTransactions,
  onReconcile
}) {
  const [menu, setMenu] = useState(null);
  const trigger = useRef(null);
  const root = useRef(null);

  useEffect(() => {
    if (!menu) return;
    const close = event => {
      if (!root.current?.contains(event.target) && !trigger.current?.contains(event.target)) {
        setMenu(null);
      }
    };
    const escape = event => {
      if (event.key === 'Escape') {
        setMenu(null);
        trigger.current?.focus();
      }
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', escape);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', escape);
      window.removeEventListener('resize', close);
    };
  }, [menu]);

  const items = [
    { key: 'edit', label: 'Edit', icon: IconEdit, run: onEdit },
    { key: 'transactions', label: 'Transactions', icon: IconArrowsExchange, run: onTransactions },
    { key: 'reconcile', label: 'Reconcile', icon: IconCheck, run: onReconcile }
  ];

  const open = () => {
    if (menu) {
      setMenu(null);
      return;
    }
    const r = trigger.current.getBoundingClientRect();
    setMenu({
      top: Math.max(8, Math.min(r.bottom + 5, window.innerHeight - 200)),
      left: Math.max(8, Math.min(r.right - 185, window.innerWidth - 195))
    });
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="soMoreButton"
        aria-label={'More actions for ' + (account?.accountName || 'bank account')}
        title="More actions"
        aria-haspopup="menu"
        aria-expanded={!!menu}
        onClick={open}
      >
        <IconDotsVertical size={18} />
      </button>
      {menu &&
        createPortal(
          <div
            ref={root}
            className="soActionMenu"
            role="menu"
            aria-label={'More actions for ' + (account?.accountName || 'bank account')}
            style={{ ...menu, width: '185px' }}
          >
            {items.map(entry => {
              const Icon = entry.icon;
              return (
                <button
                  key={entry.key}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenu(null);
                    entry.run();
                  }}
                >
                  <Icon size={17} aria-hidden="true" />
                  <span>{entry.label}</span>
                </button>
              );
            })}
          </div>,
          window.document.body
        )}
    </>
  );
}
