/**
 * Opens a URL in the default system browser when running in Electron,
 * or opens in a new tab when running in a regular browser.
 * @param {string} url - The URL to open
 */
export async function openUrlInBrowser(url) {
  console.log('[openUrlInBrowser] Opening URL:', url);
  console.log('[openUrlInBrowser] window.electronAPI available:', !!window.electronAPI);
  console.log('[openUrlInBrowser] openExternal available:', !!window.electronAPI?.openExternal);

  // Use Electron's shell.openExternal if running in Electron, otherwise use window.open
  if (window.electronAPI?.openExternal) {
    console.log('[openUrlInBrowser] Using electronAPI.openExternal to open in system browser');
    try {
      await window.electronAPI.openExternal(url);
      console.log('[openUrlInBrowser] Successfully opened in system browser');
    } catch (err) {
      console.error('[openUrlInBrowser] Failed to open with electronAPI:', err);
      window.open(url, '_blank');
    }
  } else {
    console.log('[openUrlInBrowser] electronAPI.openExternal not available, using window.open');
    window.open(url, '_blank');
  }
}
