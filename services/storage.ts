/**
 * Local persistence (IndexedDB through localforage). Nothing is sent to a server.
 */
import localforage from 'localforage';

export const scansStore = localforage.createInstance({ name: 'profscanner', storeName: 'scans' });
export const appStore = localforage.createInstance({ name: 'profscanner', storeName: 'app' });

/** Deletes every scan, the profile and all settings stored on this device. */
export const clearAllLocalData = async () => {
  await Promise.all([scansStore.clear(), appStore.clear()]);
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith('profscanner.') || key === 'saveHistory' || key === 'theme')
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore
  }
};
