import { useState } from 'react';
import { IconPlus, IconTrash, IconCircleCheck, IconAlertTriangle } from '@tabler/icons-react';
import { readOperations, saveOperations, createIncomeCategory, DEFAULT_INCOME_CATEGORIES } from './operations-store.js';
import { readAccounts } from './account-store.js';
import './journal-entries.css';

export default function IncomeCategories({ onBack }) {
  const [revision, setRevision] = useState(0);
  const [newCat, setNewCat] = useState({ name: '', account: '4100', tax: 'GST 18%' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const accounts = readAccounts();
  const incomeAccounts = (accounts?.accounts || []).filter(a => a.type === 'Income' || a.code?.startsWith('4'));

  const store = readOperations();
  const categories = store?.incomeCategories?.length ? store.incomeCategories : DEFAULT_INCOME_CATEGORIES;

  const handleAddCategory = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      if (!newCat.name?.trim()) {
        throw new Error('Please enter a category name.');
      }
      const out = createIncomeCategory(store, newCat);
      saveOperations(out);
      setNewCat({ name: '', account: '4100', tax: 'GST 18%' });
      setSuccess(`Category "${newCat.name}" added successfully.`);
      setRevision(r => r + 1);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="je-page">
      <div className="je-heading registerHead je-heading-flush">
        <div className="registerHeadText">
          <h2>Income Categories & Ledger Mappings</h2>
          <p>Configure default income categories and mapped Chart of Accounts ledgers.</p>
        </div>
        {onBack && (
          <button type="button" className="rt-btn rt-btn-secondary" onClick={onBack}>
            Back to Income List
          </button>
        )}
      </div>

      {error && <div className="je-error"><IconAlertTriangle size={18} /><span>{error}</span></div>}
      {success && <div style={{ padding: '10px 14px', background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', borderRadius: '6px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><IconCheckCircle size={18} /><span>{success}</span></div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>
        {/* Categories Table */}
        <div className="je-card unified">
          <div className="je-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Category Name</th>
                  <th>Mapped Ledger Account</th>
                  <th>Default Tax Rate</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat, idx) => (
                  <tr key={cat.id || cat.name || idx}>
                    <td><strong>{cat.name}</strong></td>
                    <td>{cat.account} - {incomeAccounts.find(a => a.code === cat.account)?.name || 'Income Account'}</td>
                    <td>{cat.tax || 'GST 18%'}</td>
                    <td><span style={{ fontSize: '0.8rem', padding: '2px 8px', borderRadius: '4px', background: '#f1f5f9', color: '#475569' }}>{cat.isDefault ? 'Default' : 'Custom'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add New Category Form */}
        <div className="je-card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 600 }}>+ Add Income Category</h3>
          <form onSubmit={handleAddCategory} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
              <span>Category Name *</span>
              <input
                type="text"
                required
                placeholder="e.g. Subscriptions / Royalty"
                value={newCat.name}
                onChange={e => setNewCat({ ...newCat, name: e.target.value })}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
              <span>Ledger Account *</span>
              <select
                value={newCat.account}
                onChange={e => setNewCat({ ...newCat, account: e.target.value })}
              >
                <option value="4100">4100 - Service Income</option>
                <option value="4000">4000 - Sales Revenue</option>
                <option value="4150">4150 - Rental Income</option>
                <option value="4200">4200 - Interest Income</option>
                <option value="4300">4300 - Commission Income</option>
                <option value="4400">4400 - Consultancy Income</option>
                <option value="4900">4900 - Other Income</option>
                {incomeAccounts.filter(a => !['4000','4100','4150','4200','4300','4400','4900'].includes(a.code)).map(a => (
                  <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
              <span>Default Tax Rate</span>
              <select
                value={newCat.tax}
                onChange={e => setNewCat({ ...newCat, tax: e.target.value })}
              >
                <option value="GST 18%">GST 18%</option>
                <option value="GST 12%">GST 12%</option>
                <option value="GST 5%">GST 5%</option>
                <option value="GST 28%">GST 28%</option>
                <option value="GST 0%">GST 0%</option>
                <option value="No tax">No tax</option>
              </select>
            </label>

            <button type="submit" className="rt-btn rt-btn-primary" style={{ marginTop: '8px', background: '#3478f6', color: '#fff' }}>
              Add Category
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
