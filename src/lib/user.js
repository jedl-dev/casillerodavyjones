const NAME_KEY = 'opq:playerName';
const CLIENT_KEY = 'opq:clientId';

const session = () => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export function getPlayerName() {
  return session()?.getItem(NAME_KEY) || '';
}

export function setPlayerName(name) {
  session()?.setItem(NAME_KEY, name.trim());
}

export function validName(name) {
  const value = name.trim();
  return value.length >= 1 && value.length <= 16;
}

export function resetClientId() {
  const storage = session();
  if (!storage) return 'no-storage';

  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `c_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  storage.setItem(CLIENT_KEY, id);
  return id;
}

export function getClientId() {
  const storage = session();
  if (!storage) return 'no-storage';

  let id = storage.getItem(CLIENT_KEY);
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `c_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    storage.setItem(CLIENT_KEY, id);
  }
  return id;
}

const TAB_KEY = 'opq:tabId';
let tabId = null;

const newTabId = () => (typeof crypto !== 'undefined' && crypto.randomUUID
  ? crypto.randomUUID()
  : `t_${Date.now()}_${Math.random().toString(36).slice(2)}`);

export function getTabId() {
  if (tabId) return tabId;
  try {
    tabId = window.sessionStorage.getItem(TAB_KEY) || newTabId();
    window.sessionStorage.setItem(TAB_KEY, tabId);
  } catch {
    tabId = newTabId();
  }
  return tabId;
}

export function resetTabId() {
  tabId = newTabId();
  try {
    window.sessionStorage.setItem(TAB_KEY, tabId);
  } catch {
    // Sin almacenamiento: el id vive solo en memoria.
  }
  return tabId;
}
