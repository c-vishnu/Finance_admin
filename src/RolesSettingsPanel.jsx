import React, { useState } from 'react';
import { IconUsers, IconEdit, IconCheck, IconShieldCheck, IconInfoCircle } from '@tabler/icons-react';
import { useExperienceMode } from './ExperienceModeContext.jsx';

export default function RolesSettingsPanel({ notify = () => {} }) {
  const { roleConfigs, updateRoleSetting, activeRole, setActiveRole } = useExperienceMode();
  const [selectedRole, setSelectedRole] = useState(null);
  const [editSetting, setEditSetting] = useState('user_switchable');

  const roleList = Object.keys(roleConfigs).map((roleName) => ({
    name: roleName,
    setting: roleConfigs[roleName]?.experienceSetting || 'user_switchable'
  }));

  const openEdit = (role) => {
    setSelectedRole(role);
    setEditSetting(role.setting);
  };

  const handleSave = () => {
    if (!selectedRole) return;
    updateRoleSetting(selectedRole.name, editSetting);
    notify(`Updated Experience Mode for ${selectedRole.name}`);
    setSelectedRole(null);
  };

  const settingLabel = (s) => {
    if (s === 'easy') return 'Easy';
    if (s === 'accounting') return 'Accounting';
    return 'User can switch';
  };

  return (
    <div className="swRolesPanel">
      <header className="swHead">
        <span>Settings</span>
        <h1>Users & Roles</h1>
        <p>Manage role-level access permissions and presentation Experience Mode.</p>
      </header>

      {/* Active Role Simulator */}
      <section className="swSection" style={{ marginBottom: '24px' }}>
        <header>
          <h2>Active Session Role</h2>
          <p>Simulate how Wayvida Books presents information for different user roles.</p>
        </header>
        <div className="swSectionBody">
          <div className="swGrid" style={{ alignItems: 'center' }}>
            <label className="swField">
              <span>Current User Role</span>
              <select
                value={activeRole}
                onChange={(e) => {
                  setActiveRole(e.target.value);
                  notify(`Active session role set to ${e.target.value}`);
                }}
              >
                {roleList.map((r) => (
                  <option key={r.name} value={r.name}>
                    {r.name} ({settingLabel(r.setting)})
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      {/* Role Configuration List */}
      <section className="swSection">
        <header>
          <h2>Roles & Experience Modes</h2>
          <p>
            Configure default presentation detail per role. Experience Mode is independent of RBAC permissions.
          </p>
        </header>
        <div className="swSectionBody">
          <div className="swRoleTable" style={{ border: '1px solid var(--sw-border, #dce3ee)', borderRadius: '8px', overflow: 'hidden' }}>
            <div className="swRoleHeader" style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', padding: '12px 16px', background: '#f8fafc', fontWeight: '600', fontSize: '13px', borderBottom: '1px solid #dce3ee' }}>
              <span>Role Name</span>
              <span>Experience Mode</span>
              <span style={{ textAlign: 'right' }}>Actions</span>
            </div>
            {roleList.map((role) => (
              <div
                key={role.name}
                className="swRoleRow"
                style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', padding: '14px 16px', alignItems: 'center', borderBottom: '1px solid #edf2f7', background: role.name === activeRole ? '#f4f8ff' : '#fff' }}
              >
                <div>
                  <b style={{ fontSize: '14px', color: '#101828' }}>{role.name}</b>
                  {role.name === activeRole && (
                    <span style={{ marginLeft: '8px', padding: '2px 8px', background: '#dbeafe', color: '#1e40af', borderRadius: '12px', fontSize: '11px', fontWeight: '600' }}>
                      Active
                    </span>
                  )}
                </div>
                <div>
                  <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', background: role.setting === 'easy' ? '#e0f2fe' : role.setting === 'accounting' ? '#fef3c7' : '#f3e8ff', color: role.setting === 'easy' ? '#0369a1' : role.setting === 'accounting' ? '#92400e' : '#6b21a8' }}>
                    {settingLabel(role.setting)}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => openEdit(role)}
                    style={{ padding: '6px 12px', fontSize: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <IconEdit size={14} /> Edit Role
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Edit Role Modal */}
      {selectedRole && (
        <div className="overlay" style={{ zIndex: 1000 }}>
          <div className="card" style={{ maxWidth: '540px', width: '90%', padding: '24px', background: '#fff', borderRadius: '12px' }}>
            <h2 style={{ fontSize: '18px', marginBottom: '6px', color: '#101828' }}>
              Edit Role: {selectedRole.name}
            </h2>
            <p style={{ fontSize: '13px', color: '#667085', marginBottom: '20px' }}>
              Configure presentation mode and workflow detail for users assigned to this role.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#344054', marginBottom: '10px' }}>
                Experience Mode
              </h3>
              <div style={{ display: 'grid', gap: '10px' }}>
                {[
                  { id: 'easy', label: 'EASY', desc: 'Designed for business owners, sales/purchase staff and users without accounting knowledge.' },
                  { id: 'accounting', label: 'ACCOUNTING', desc: 'Designed for accountants, bookkeepers, auditors and finance teams.' },
                  { id: 'user_switchable', label: 'USER CAN SWITCH', desc: 'Allow the user to switch between Easy and Accounting views from their profile/header without changing permissions.' }
                ].map((opt) => (
                  <label
                    key={opt.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '12px 14px',
                      border: editSetting === opt.id ? '2px solid #3478f6' : '1px solid #dce3ee',
                      borderRadius: '8px',
                      background: editSetting === opt.id ? '#f4f8ff' : '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="radio"
                      name="expMode"
                      checked={editSetting === opt.id}
                      onChange={() => setEditSetting(opt.id)}
                      style={{ marginTop: '2px' }}
                    />
                    <div>
                      <b style={{ display: 'block', fontSize: '13px', color: '#101828' }}>{opt.label}</b>
                      <small style={{ color: '#667085', fontSize: '12px' }}>{opt.desc}</small>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #eaecf0', marginBottom: '20px', display: 'flex', gap: '8px' }}>
              <IconInfoCircle size={18} style={{ color: '#3478f6', flexShrink: 0 }} />
              <small style={{ color: '#475467', fontSize: '12px', lineHeight: '1.4' }}>
                Changing Experience Mode only modifies presentation (term labels, account code visibility, and progressive disclosure). Permissions and double-entry accounting data remain untouched.
              </small>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => setSelectedRole(null)}>
                Cancel
              </button>
              <button type="button" className="primary" onClick={handleSave}>
                <IconCheck size={16} /> Save Role Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
