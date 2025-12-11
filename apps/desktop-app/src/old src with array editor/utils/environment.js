// Environment detection for ScribeFold AI

/**
 * Check if running in Electron (has electronAPI available)
 */
export const isElectron = () => !!(window.electronAPI);

/**
 * Check if running in web browser (no Electron)
 */
export const isWeb = () => !isElectron();

/**
 * Get or create anonymous ID for web users (stored in localStorage)
 */
export const getWebAnonId = () => {
  const STORAGE_KEY = 'scribefold_anon_id';
  let anonId = localStorage.getItem(STORAGE_KEY);
  
  if (!anonId) {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    const hex = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    anonId = `anon_${hex}`;
    localStorage.setItem(STORAGE_KEY, anonId);
  }
  
  return anonId;
};
