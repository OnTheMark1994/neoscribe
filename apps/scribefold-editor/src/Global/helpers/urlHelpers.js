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

/**
 * Opens the web portal with auto-login using an encrypted magic link token.
 * This function is reused by the "Get More Tokens" button and developer test tools.
 *
 * @param {Object} supabase - The Supabase client instance
 * @param {Object} authUser - The authenticated user object from Redux state
 * @returns {Promise<boolean>} - Returns true if successful, false otherwise
 */
export async function openWebPortalWithAutoLogin(supabase, authUser) {
  const WEB_PORTAL_URL = process.env.REACT_APP_WEB_PORTAL_URL;
  const API_BASE_URL = process.env.REACT_APP_SCRIBEFOLD_API_BASE_URL;

  // Warn if env variables are missing (no fallback to localhost)
  if (!WEB_PORTAL_URL) {
    console.warn('[openWebPortalWithAutoLogin] REACT_APP_WEB_PORTAL_URL environment variable is missing');
  }
  if (!API_BASE_URL) {
    console.warn('[openWebPortalWithAutoLogin] REACT_APP_SCRIBEFOLD_API_BASE_URL environment variable is missing');
  }

  if (!WEB_PORTAL_URL || !API_BASE_URL) {
    console.error('[openWebPortalWithAutoLogin] Required environment variables are missing');
    return false;
  }

  if (!authUser?.id) {
    console.warn('[openWebPortalWithAutoLogin] No auth user found');
    return false;
  }

  console.log('[openWebPortalWithAutoLogin] Getting current session from Supabase...');

  // Get current session from Supabase client
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    console.error('[openWebPortalWithAutoLogin] No valid session:', sessionError);
    return false;
  }

  const accessToken = session.access_token;
  console.log('[openWebPortalWithAutoLogin] Access token:', accessToken.substring(0, 20) + '...');

  console.log('[openWebPortalWithAutoLogin] Calling /auto/generate-encrypted-login-token...');

  try {
    const response = await fetch(`${API_BASE_URL}/auto/generate-encrypted-login-token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
    });

    const data = await response.json();
    console.log('[openWebPortalWithAutoLogin] API response:', data);

    if (response.status !== 200) {
      const errorText = await response.text();
      console.error('[openWebPortalWithAutoLogin] Failed to generate token:', response.status, errorText);
      return false;
    }

    const { token } = data;
    console.log('[openWebPortalWithAutoLogin] Token generated, length:', token?.length);

    // Normalize base URL to ensure it includes a scheme (http://) to avoid browser launch errors
    const baseUrl = /^https?:\/\//i.test(WEB_PORTAL_URL) ? WEB_PORTAL_URL : `http://${WEB_PORTAL_URL}`;
    const url = `${baseUrl}/#/auto-login-magiclink-enc?token=${token}`;
    console.log('[openWebPortalWithAutoLogin] Opening URL:', url);
    await openUrlInBrowser(url);
    console.log('[openWebPortalWithAutoLogin] Window opened');
    return true;
  } catch (err) {
    console.error('[openWebPortalWithAutoLogin] Error:', err);
    return false;
  }
}
