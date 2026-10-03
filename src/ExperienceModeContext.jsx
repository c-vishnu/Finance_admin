import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';

const STORAGE_KEY_PREFERENCE = 'wayvida-experience-mode';
const STORAGE_KEY_ROLES = 'wayvida-role-experience-config';
const STORAGE_KEY_ACTIVE_ROLE = 'wayvida-active-role';

export const DEFAULT_ROLE_CONFIGS = {
  'Business Owner': { experienceSetting: 'user_switchable', defaultMode: 'easy' },
  'Sales Staff': { experienceSetting: 'easy', defaultMode: 'easy' },
  'Purchase Staff': { experienceSetting: 'easy', defaultMode: 'easy' },
  'Operations Staff': { experienceSetting: 'easy', defaultMode: 'easy' },
  'Accountant': { experienceSetting: 'accounting', defaultMode: 'accounting' },
  'Finance Manager': { experienceSetting: 'accounting', defaultMode: 'accounting' },
  'Auditor': { experienceSetting: 'accounting', defaultMode: 'accounting' },
  'Super Admin': { experienceSetting: 'user_switchable', defaultMode: 'easy' }
};

const ExperienceModeContext = createContext(null);

export function ExperienceModeProvider({ children, notify = () => {} }) {
  const [roleConfigs, setRoleConfigs] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ROLES);
      return saved ? { ...DEFAULT_ROLE_CONFIGS, ...JSON.parse(saved) } : DEFAULT_ROLE_CONFIGS;
    } catch {
      return DEFAULT_ROLE_CONFIGS;
    }
  });

  const [activeRole, setActiveRoleState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_ACTIVE_ROLE) || 'Super Admin';
    } catch {
      return 'Super Admin';
    }
  });

  const [userPreference, setUserPreference] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFERENCE);
      if (saved === 'easy' || saved === 'accounting') return saved;
      // Backward compatibility with legacy terminology keys
      const legacy = localStorage.getItem('wayvida-terminology-view');
      if (legacy === 'business') return 'easy';
      if (legacy === 'accountant') return 'accounting';
      return 'easy';
    } catch {
      return 'easy';
    }
  });

  const activeConfig = roleConfigs[activeRole] || { experienceSetting: 'user_switchable', defaultMode: 'easy' };
  const roleExperienceSetting = activeConfig.experienceSetting || 'user_switchable';
  const canSwitch = roleExperienceSetting === 'user_switchable';

  const mode = useMemo(() => {
    if (roleExperienceSetting === 'easy') return 'easy';
    if (roleExperienceSetting === 'accounting') return 'accounting';
    return userPreference;
  }, [roleExperienceSetting, userPreference]);

  const setMode = (nextMode) => {
    const normalized = nextMode === 'business' ? 'easy' : nextMode === 'accountant' ? 'accounting' : nextMode;
    if (normalized !== 'easy' && normalized !== 'accounting') return;

    setUserPreference(normalized);
    try {
      localStorage.setItem(STORAGE_KEY_PREFERENCE, normalized);
      localStorage.setItem('wayvida-terminology-view', normalized === 'easy' ? 'business' : 'accountant');
    } catch {}

    const label = normalized === 'easy' ? 'Easy view' : 'Accounting view';
    notify(`Switched to ${label}`);
    window.dispatchEvent(new CustomEvent('wayvida-experience-mode-change', { detail: normalized }));
  };

  const setActiveRole = (roleName) => {
    setActiveRoleState(roleName);
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_ROLE, roleName);
    } catch {}
  };

  const updateRoleSetting = (roleName, newSetting) => {
    setRoleConfigs((prev) => {
      const updated = {
        ...prev,
        [roleName]: {
          ...(prev[roleName] || { defaultMode: newSetting === 'accounting' ? 'accounting' : 'easy' }),
          experienceSetting: newSetting
        }
      };
      try {
        localStorage.setItem(STORAGE_KEY_ROLES, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const value = useMemo(
    () => ({
      mode,
      isEasy: mode === 'easy',
      isAccounting: mode === 'accounting',
      roleExperienceSetting,
      canSwitch,
      activeRole,
      roleConfigs,
      setMode,
      setActiveRole,
      updateRoleSetting
    }),
    [mode, roleExperienceSetting, canSwitch, activeRole, roleConfigs]
  );

  return <ExperienceModeContext.Provider value={value}>{children}</ExperienceModeContext.Provider>;
}

export function useExperienceMode() {
  const context = useContext(ExperienceModeContext);
  if (context) return context;
  return {
    mode: 'easy',
    isEasy: true,
    isAccounting: false,
    roleExperienceSetting: 'user_switchable',
    canSwitch: true,
    activeRole: 'Super Admin',
    roleConfigs: DEFAULT_ROLE_CONFIGS,
    setMode: () => {},
    setActiveRole: () => {},
    updateRoleSetting: () => {}
  };
}

export function EasyOnly({ children }) {
  const { isEasy } = useExperienceMode();
  return isEasy ? <>{children}</> : null;
}

export function AccountingOnly({ children }) {
  const { isAccounting } = useExperienceMode();
  return isAccounting ? <>{children}</> : null;
}
