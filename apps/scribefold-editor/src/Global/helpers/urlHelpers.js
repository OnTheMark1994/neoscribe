/**
 * Opens a URL in the default system browser when running in Electron,
 * or opens in a new tab when running in a regular browser.
 * @param {string} url - The URL to open
 */
export async function openUrlInBrowser(url) {
  // Use Electron's shell.openExternal if running in Electron, otherwise use window.open
  if (window.electronAPI?.openExternal) {
    try {
      await window.electronAPI.openExternal(url);
    } catch (err) {
      console.error('[openUrlInBrowser] Failed to open with electronAPI:', err);
      window.open(url, '_blank');
    }
  } else {
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

  // Get current session from Supabase client
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    console.error('[openWebPortalWithAutoLogin] No valid session:', sessionError);
    return false;
  }

  const accessToken = session.access_token;

  try {
    const response = await fetch(`${API_BASE_URL}/auto/generate-encrypted-login-token`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
    });

    const data = await response.json();

    if (response.status !== 200) {
      const errorText = await response.text();
      console.error('[openWebPortalWithAutoLogin] Failed to generate token:', response.status, errorText);
      return false;
    }

    const { token } = data;

    // Normalize base URL to ensure it includes a scheme (http://) to avoid browser launch errors
    const baseUrl = /^https?:\/\//i.test(WEB_PORTAL_URL) ? WEB_PORTAL_URL : `http://${WEB_PORTAL_URL}`;
    const url = `${baseUrl}/#/auto-login-magiclink-enc?token=${token}`;
    await openUrlInBrowser(url);
    return true;
  } catch (err) {
    console.error('[openWebPortalWithAutoLogin] Error:', err);
    return false;
  }
}
