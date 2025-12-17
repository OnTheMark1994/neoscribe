this is an example of a terribly structured comonent. 
1: Redux state being fetched with useSelector and then sent to a child component
2: Auth being handled an manu different ways and places in stead of one authUser variable in global state (it has localstorage, state in multiple comonents, redux for just parts of it, etc)
3: way to many props that are unnecessary, it is often the case that no or very few are needed
4: Many unnecessary values. If ther eis an object with many attributes there is no need to break each attribute off into many variables, jsut use object?.atrribute where its needed. 
5: very long file. A file that could be very small and simple is made very long and complex and error prone with terrible over varables, too many propse, tons of unnecessary logic, etc. 
6: storing variable in state insted of just getting them from the element on button press (like storing email in stae instead of just using a ref on the email input when the submit button is pushed)
7: unnecessary inline styling instead of proper css classes
8: tons of jsx for a component in its parent. It should be like <Settings.js/> not a conditional, then jsx, then a conteinr component, then the component, and definitely not a whole component like the Download info modal, that is way wrong. 

import React, { useState, useEffect } from 'react';
import './Settings.css';
import { createUserAccount, loginUserAccount, buildWebPortalAutoLoginUrl } from '../../utils/aiService';

function AccountAuthSection({
  anonId,
  authId,
  deviceId,
  onAccountUpdated,
  onAuthCleared,
  initialEmail,
  initialPassword,
  subscriptionType,
  nextBillingDate,
}) {
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState('create'); // 'create' or 'login'
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!anonId) {
      setStatus('Anonymous ID not ready yet.');
      return;
    }
    if (!authEmail || !authPassword) {
      setStatus('Email and password are required.');
      return;
    }

    setLoading(true);
    setStatus('');

    try {
      let result;
      if (authMode === 'create') {
        result = await createUserAccount(anonId, {
          name: null,
          email: authEmail,
          password: authPassword,
          deviceId: deviceId || null  // Pass deviceId for abuse prevention
        });
      } else {
        result = await loginUserAccount(anonId, {
          email: authEmail,
          password: authPassword
        });
      }

      const message = result && result.message
        ? result.message
        : authMode === 'create'
          ? 'Account created successfully.'
          : 'Logged in successfully.';

      setStatus(message);

      if (result && result.authUser && result.authUser.email) {
        setAuthEmail(result.authUser.email);
        try {
          localStorage.setItem('userEmail', result.authUser.email);
          if (authPassword) {
            localStorage.setItem('userPassword', authPassword);
          }
        } catch (e) {
          // ignore storage failures
        }
      }

      if (onAccountUpdated) {
        onAccountUpdated(result);
      }
    } catch (error) {
      setStatus(error.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    // Clear local auth state and any saved credentials
    setAuthEmail('');
    setAuthPassword('');
    setStatus('');
    setAuthMode('login');

    try {
      localStorage.removeItem('userEmail');
      localStorage.removeItem('userPassword');
    } catch (e) {
      // ignore storage errors
    }

    if (onAuthCleared) {
      onAuthCleared();
    }
  };

  const handleViewWebpage = () => {
    // Open the main web portal landing page in the user's browser
    openExternalLink('https://scribefold-ai-monorepo.onrender.com');
  };

  const isSignedIn = !!authId;
  const isFreePlan = !subscriptionType || String(subscriptionType).toLowerCase() === 'free';

  const openExternalLink = async (url) => {
    try {
      if (window.electronAPI?.openExternal) {
        await window.electronAPI.openExternal(url);
      } else {
        throw new Error('Electron API not available - cannot open externally');
      }
    } catch (error) {
      console.error('Failed to open URL externally:', error);
    }
  };

  // On mount or when authId appears, try to restore email from localStorage if we don't have one yet
  useEffect(() => {
    if (authId && !authEmail) {
      try {
        const savedEmail = localStorage.getItem('userEmail');
        if (savedEmail) {
          setAuthEmail(savedEmail);
        }
      } catch (e) {
        // ignore
      }
    }
  }, [authId, authEmail]);

  useEffect(() => {
    if (!authEmail && initialEmail) {
      setAuthEmail(initialEmail);
    }
  }, [initialEmail, authEmail]);

  useEffect(() => {
    if (!authPassword && initialPassword) {
      setAuthPassword(initialPassword);
    }
  }, [initialPassword, authPassword]);

  return (
    <>
      {/* Subscription summary (shared for signed-in and signed-out states) */}
      <div className="stat-item">
        <span className="stat-label">Current Plan</span>
        <span className="stat-value">{subscriptionType || 'Free'}</span>
      </div>

      {nextBillingDate && (
        <div className="stat-item">
          <span className="stat-label">Next Billing Date</span>
          <span className="stat-value">
            {new Date(nextBillingDate).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        </div>
      )}
      {/* Helper banners under subscription summary */}
      {/* 1) Anon users: prompt to create a free account */}
      {!isSignedIn && (
        <div className="auth-info-message">
          Create a free one click account for additional free tokens and to see subscription options.
        </div>
      )}
      {/* 2) Signed-in users on Free plan: prompt to open Account Portal for subscription options */}
      {isSignedIn && isFreePlan && (
        <div className="auth-info-message">
          Click Account Portal to view subscription options.
        </div>
      )}

      {isSignedIn ? (
        <>
          <div className="stat-item">
            <span className="stat-label">Signed in as</span>
            <span
              className="stat-value"
              style={{ display: 'block', marginTop: '4px' }}
            >
              {authEmail || 'Authenticated user'}
            </span>
          </div>

          {status && (
            <div
              style={{
                textAlign: 'center',
                marginTop: '10px',
                marginBottom: '10px',
                color: '#4CAF50',
              }}
            >
              {status}
            </div>
          )}

          <div style={{ marginTop: '20px', marginBottom: '20px' }}>
            <button 
              onClick={() => openExternalLink(buildWebPortalAutoLoginUrl(authEmail, authPassword))}
              className="settings-account-portal-btn"
              style={{ 
                padding: '10px 15px',
                backgroundColor: '#4a6da7',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                width: '100%'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span>Account Portal</span>
                <span style={{ fontSize: '12px', color: '#d0d7eb', marginTop: '2px' }}>(Auto Login)</span>
              </div>
            </button>
          </div>

          <div className="auth-button-row">
            <button
              type="button"
              className="btn-secondary auth-button"
              onClick={handleViewWebpage}
              disabled={loading}
            >
              View Webpage
            </button>

            <button
              type="button"
              className="btn-primary auth-button"
              onClick={handleLogout}
              disabled={loading}
            >
              Log Out
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="auth-info-message" style={{ marginTop: '12px' }}>
            Email must be confirmed to receive bonus tokens.
          </div>

          <div className="setting-item">
            <label>Email</label>
            <input
              type="email"
              className="auth-input"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div className="setting-item">
            <label>Password</label>
            <input
              type="password"
              className="auth-input"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="Your password"
            />
          </div>

          <div className="auth-button-row">
            <button
              type="button"
              className="btn-secondary auth-button"
              onClick={() => setAuthMode(authMode === 'create' ? 'login' : 'create')}
              disabled={loading}
            >
              {authMode === 'create' ? 'Switch to Login' : 'Switch to Create Account'}
            </button>

            <button
              type="button"
              className="btn-primary auth-button"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading
                ? (authMode === 'create' ? 'Creating...' : 'Logging in...')
                : (authMode === 'create' ? 'Create Account' : 'Log In')}
            </button>
          </div>
        </>
      )}

      {status && !isSignedIn && (
        <div className="setting-item">
          <span className="stat-value">{status}</span>
        </div>
      )}
    </>
  );
}

export default AccountAuthSection;



import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import './Settings.css';
import { fetchUserAccount, fetchUserTokens, normalizeUserTokenData, devBurnTokens } from '../../utils/aiService';
import AccountAuthSection from './AccountAuthSection';
import RefreshButton from '../UI/RefreshButton';
import TokenUsageLog from './TokenUsageLog';
import { selectAnonId, selectAuthId, selectDeviceId, selectUserData, setAuthId as setReduxAuthId } from '../../store/userSlice';
import { setBackgroundImage, selectShowPreviewBar, selectShowMonacoLineNumbers, selectMonacoStickyTopBar, selectShowArrayLineNumbers, setShowPreviewBar, setShowMonacoLineNumbers, setMonacoStickyTopBar, updateSetting } from '../../store/settingsSlice';
import { selectViewType, setViewType } from '../../store/editorSlice';
import { setBackground } from '../../utils/backgroundHelper';

/**
 * Settings - Settings management UI (refactored per v2 plan)
 * 
 * Now reads anonId, authId, deviceId, userData from Redux.
 * Only onClose and initialTab are passed as props.
 */
function Settings({ onClose, initialTab = 'general' }) {
  const dispatch = useDispatch();
  
  // Read from Redux
  const anonId = useSelector(selectAnonId);
  const authIdFromRedux = useSelector(selectAuthId);
  const deviceId = useSelector(selectDeviceId);
  const userAccount = useSelector(selectUserData);
  const [activeTab, setActiveTab] = useState(initialTab || 'general');
  const [themes, setThemes] = useState([]);
  const [selectedTheme, setSelectedTheme] = useState('');
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiService, setAiService] = useState('deepseek-server');
  const [apiKeys, setApiKeys] = useState({});
  const [authId, setAuthId] = useState(null);
  const [developerMode, setDeveloperMode] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);
  const [tokenStats, setTokenStats] = useState(null);
  const [accountData, setAccountData] = useState(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState(null);
  const [requestedTabLabel, setRequestedTabLabel] = useState('NONE');
  const [settingsSavedMsg, setSettingsSavedMsg] = useState('');
  const [developerToolsStatus, setDeveloperToolsStatus] = useState('');
  const showPreviewBar = useSelector(selectShowPreviewBar);
  const showMonacoLineNumbers = useSelector(selectShowMonacoLineNumbers);
  const monacoStickyTopBar = useSelector(selectMonacoStickyTopBar);
  const showArrayLineNumbers = useSelector(selectShowArrayLineNumbers);
  const currentViewType = useSelector(selectViewType); // 'array' or 'monaco'

  useEffect(() => {
    // Load settings from localStorage
    const savedTheme = localStorage.getItem('backgroundImage') || 'spacedreams.jpg';
    setSelectedTheme(savedTheme);

    const savedAiEnabled = localStorage.getItem('aiEnabled');
    setAiEnabled(savedAiEnabled === null ? true : savedAiEnabled === 'true');

    const savedAiService = localStorage.getItem('aiService') || 'deepseek-server';
    setAiService(savedAiService);

    const savedApiKeys = JSON.parse(localStorage.getItem('apiKeys') || '{}');
    setApiKeys(savedApiKeys);

    const savedAuthId = localStorage.getItem('authId');
    setAuthId(authIdFromRedux || savedAuthId);

    const savedDeveloperMode = localStorage.getItem('developerMode');
    setDeveloperMode(savedDeveloperMode === null ? false : savedDeveloperMode === 'true');

    // Load theme list
    if (window.electronAPI && window.electronAPI.getThemeList) {
      window.electronAPI.getThemeList().then(themeList => {
        setThemes(themeList);
      });
    } else {
      // Web fallback: hardcoded theme list matching public/images folder
      setThemes([
        { name: 'Space Dreams', path: 'spacedreams.jpg' },
        { name: 'Mountains', path: 'Mountains.png' },
        { name: 'Bitter Skies', path: 'bitterskies.jpg' },
        { name: 'Enchantment', path: 'enchantment.jpg' },
        { name: 'Spy Games', path: 'spygames.jpg' },
        { name: 'Tranquility', path: 'tranquility.jpg' },
        { name: 'Writing Desk', path: 'writingdesk.jpg' }
      ]);
    }

    // Ask main process what tab was last requested (handles initial open timing in Electron)
    if (window.electronAPI && window.electronAPI.getInitialSettingsTab) {
      window.electronAPI.getInitialSettingsTab().then((tab) => {
        setRequestedTabLabel(tab || "none found")
        if (tab === 'ai' || tab === 'account' || tab === 'general') {
          setActiveTab(tab === 'general' ? 'general' : tab);
          if (tab === 'ai') {
            setRequestedTabLabel('AI');
          } else if (tab === 'account') {
            setRequestedTabLabel('Account');
          } else {
            setRequestedTabLabel('NONE');
          }
        }
      });
    }

    // Listen for tab requests coming from the main process (for subsequent changes)
    if (window.electronAPI && window.electronAPI.onSettingsTabRequest) {
      window.electronAPI.onSettingsTabRequest((tab) => {
        if (tab === 'ai' || tab === 'account' || tab === 'general') {
          setActiveTab(tab === 'general' ? 'general' : tab);
          if (tab === 'ai') {
            setRequestedTabLabel('AI');
          } else if (tab === 'account') {
            setRequestedTabLabel('Account');
          } else {
            setRequestedTabLabel('NONE');
          }
        }
      });
    }

    // Also honor a dedicated hash for AI settings when first opened (Electron)
    if (window.location.hash === '#settings-ai') {
      setActiveTab('ai');
      setRequestedTabLabel('AI');
    }

    // In web mode, use initialTab prop when there is no Electron API driving tab selection
    if (!window.electronAPI && (initialTab === 'ai' || initialTab === 'account' || initialTab === 'general')) {
      setActiveTab(initialTab);
      if (initialTab === 'ai') {
        setRequestedTabLabel('AI');
      } else if (initialTab === 'account') {
        setRequestedTabLabel('Account');
      } else {
        setRequestedTabLabel('NONE');
      }
    }
  }, []);

  useEffect(() => {
    if (!anonId) return;
    loadAccountData();
  }, [anonId]);

  const handleSave = () => {
    // Save all settings to localStorage
    localStorage.setItem('backgroundImage', selectedTheme);
    localStorage.setItem('aiEnabled', aiEnabled);
    localStorage.setItem('aiService', aiService);
    localStorage.setItem('apiKeys', JSON.stringify(apiKeys));
    localStorage.setItem('developerMode', developerMode ? 'true' : 'false');

    // Notify main window about settings change
    if (window.electronAPI && window.electronAPI.settingsSaved) {
      window.electronAPI.settingsSaved({
        backgroundImage: selectedTheme,
        aiEnabled,
        aiService,
        apiKeys,
        developerMode
      });
    }

    // Update background in DOM and Redux
    setBackground(selectedTheme);
    dispatch(setBackgroundImage(selectedTheme));

    // Show a transient confirmation message
    setSettingsSavedMsg('Settings saved!');
    setTimeout(() => {
      setSettingsSavedMsg('');
    }, 3000);
  };

  const handleCancel = () => {
    if (onClose) {
      onClose();
    } else {
      window.close();
    }
  };

  const handleThemeSelect = (themePath) => {
    setSelectedTheme(themePath);
  };

  const handleCustomTheme = async () => {
    if (!window.electronAPI || !window.electronAPI.selectCustomTheme) {
      // Custom themes are only available in the desktop app.
      return;
    }

    try {
      const result = await window.electronAPI.selectCustomTheme();
      if (!result || result.canceled || !result.filePath) {
        return;
      }

      const filePath = result.filePath;
      setSelectedTheme(filePath);

      // Persist immediately so background updates even before clicking Save
      localStorage.setItem('backgroundImage', filePath);

      if (window.electronAPI && window.electronAPI.settingsSaved) {
        window.electronAPI.settingsSaved({
          backgroundImage: filePath
        });
      }
    } catch (err) {
      console.error('Failed to select custom theme:', err);
    }
  };

  const handleApiKeyChange = (service, value) => {
    setApiKeys(prev => ({
      ...prev,
      [service]: value
    }));
  };

  const togglePasswordVisibility = (inputId) => {
    const input = document.getElementById(inputId);
    if (input) {
      input.type = input.type === 'password' ? 'text' : 'password';
    }
  };

  const loadAccountData = async () => {
    if (!anonId) return;

    setAccountLoading(true);
    setAccountError(null);

    try {
      // Load general account info (email/password/etc.)
      const data = await fetchUserAccount(anonId);
      setAccountData(data || null);

      // Load authoritative token stats from /api/user/tokens so this matches AISidebar and web portal
      try {
        const tokenData = await fetchUserTokens(anonId, authId);
        const normalizedTokens = normalizeUserTokenData(tokenData || {});
        setTokenStats(normalizedTokens);
        setTokenCount(normalizedTokens.availableTokens > 0 ? normalizedTokens.availableTokens : 0);
      } catch (tokenError) {
        console.error('[SETTINGS] Failed to load token stats via fetchUserTokens:', tokenError);
        // Fallback to token fields embedded in account data if present
        const fallbackTokens = normalizeUserTokenData(data || {});
        setTokenStats(fallbackTokens);
        setTokenCount(fallbackTokens.availableTokens > 0 ? fallbackTokens.availableTokens : 0);
      }
    } catch (error) {
      console.error('[SETTINGS] Failed to load account data:', error);
      setAccountError(error.message || 'Failed to load account data');
    } finally {
      setAccountLoading(false);
    }
  };

  const normalizedTokens = tokenStats;
  // New token tracking model fields
  const tokensMonthly = normalizedTokens ? normalizedTokens.tokensMonthly : null;
  const tokensUsed = normalizedTokens ? normalizedTokens.tokensUsed : null;
  const tokensAdded = normalizedTokens ? normalizedTokens.tokensAdded : null;
  const tokensUsedAllTime = normalizedTokens ? normalizedTokens.tokensUsedAllTime : null;
  const availableTokens = normalizedTokens ? normalizedTokens.availableTokens : null;
  const tierName = normalizedTokens ? normalizedTokens.tierName : null;
  const nextBillingDate = normalizedTokens ? normalizedTokens.nextBillingDate : null;
  const accountEmail = accountData && accountData.email ? accountData.email : '';
  const accountPassword = accountData && accountData.password ? accountData.password : '';

  const handleDeveloperResetIds = () => {
    // Developer-only: clear all locally stored IDs and account data so next launch mimics a first-time user
    try {
      localStorage.removeItem('authId');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('userPassword');
    } catch (e) {
      // ignore storage errors
    }

    setAuthId(null);
    setAccountData(null);
    setTokenStats(null);
    setTokenCount(0);

    // Ask main process to clear anon_id so the next launch behaves like first run
    if (window.electronAPI && window.electronAPI.resetAnonId) {
      window.electronAPI.resetAnonId();
    }

    // Notify main window so primary App instance can clear authId immediately
    if (window.electronAPI && window.electronAPI.settingsSaved) {
      window.electronAPI.settingsSaved({ authId: null });
    }

    setDeveloperToolsStatus('Developer Tools: Reset local anon/auth IDs and cleared local account data.');
  };

  const handleDeveloperBurnTokens = async () => {
    console.log("in handleDeveloperBurnTokens")
    if (!anonId && !authId) {
      return;
    }

    console.log('[SETTINGS] -14k tokens button pressed', {
      anonId,
      authId,
      amount: 14000,
      tokenStats,
      tokenCount,
    });

    try {
      const result = await devBurnTokens(anonId, authId, 14000);
      console.log('[SETTINGS] -14k tokens endpoint response', result);
      const newAvailable =
        result && typeof result.availableTokens === 'number'
          ? result.availableTokens
          : 'unknown';
      setDeveloperToolsStatus(
        `Developer Tools: Burned 14,000 tokens. New availableTokens = ${newAvailable}.`
      );
      await loadAccountData();
    } catch (error) {
      console.error('[SETTINGS] Failed to burn tokens:', error);
      setDeveloperToolsStatus(
        `Developer Tools error burning tokens: ${error.message || 'Unknown error'}`
      );
    }
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1>Settings</h1>
        <img
          src="/app-images/scribefold-ai-icon-png.png"
          alt="ScribeFold AI Icon"
          className="settings-logo"
        />
      </div>

      <div className="tabs-container">
        <button 
          className={`tab ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          General
        </button>
        <button 
          className={`tab ${activeTab === 'display' ? 'active' : ''}`}
          onClick={() => setActiveTab('display')}
        >
          Display
        </button>
        <button 
          className={`tab ${activeTab === 'ai' ? 'active' : ''}`}
          onClick={() => setActiveTab('ai')}
        >
          AI
        </button>
        <button 
          className={`tab ${activeTab === 'account' ? 'active' : ''}`}
          onClick={() => setActiveTab('account')}
        >
          Account
        </button>
      </div>

      {/* General Tab */}
      {activeTab === 'general' && (
        <div className="tab-content active">
          <div className="setting-section">
            <h2>Theme</h2>
            <div className="setting-item">
              <label>Background Theme</label>
              <div className="theme-grid">
                <div 
                  className={`theme-option ${selectedTheme === '' ? 'selected' : ''}`}
                  onClick={() => handleThemeSelect('')}
                >
                  None
                </div>
                {themes.map(theme => (
                  <div
                    key={theme.path}
                    className={`theme-option ${selectedTheme === theme.path ? 'selected' : ''}`}
                    onClick={() => handleThemeSelect(theme.path)}
                  >
                    {theme.name}
                  </div>
                ))}
              </div>
            </div>
            <div className="setting-item" style={{ marginTop: '15px' }}>
              <button className="btn-secondary" onClick={handleCustomTheme} style={{ width: '100%' }}>
                Select Custom Image...
              </button>
            </div>
          </div>

          <div className="setting-section">
            <h2>Editor View</h2>
            <div className="setting-item">
              <label>Current View Mode</label>
              <div className="view-mode-selector">
                <button
                  className={`view-mode-btn ${currentViewType === 'array' ? 'active' : ''}`}
                  onClick={() => {
                    localStorage.setItem('editorViewMode', 'array');
                    // Notify Electron main window if available
                    if (window.electronAPI && window.electronAPI.settingsSaved) {
                      window.electronAPI.settingsSaved({ editorViewMode: 'array' });
                    }
                    dispatch(setViewType('array'));
                  }}
                >
                  Array
                </button>
                <button
                  className={`view-mode-btn ${currentViewType === 'monaco' ? 'active' : ''}`}
                  onClick={() => {
                    localStorage.setItem('editorViewMode', 'monaco');
                    if (window.electronAPI && window.electronAPI.settingsSaved) {
                      window.electronAPI.settingsSaved({ editorViewMode: 'monaco' });
                    }
                    dispatch(setViewType('monaco'));
                  }}
                >
                  Monaco
                </button>
              </div>
              <p className="setting-hint">
                {currentViewType === 'array' && 'Array view: Line-by-line editing with folding support'}
                {currentViewType === 'monaco' && 'Monaco view: VS Code-style editor with syntax highlighting'}
              </p>
            </div>
          </div>

          <div className="setting-section">
            <h2>Developer</h2>
            <div className="setting-item">
              <div className="toggle-container">
                <label>Developer Mode</label>
                <div 
                  className={`toggle-switch ${developerMode ? 'active' : ''}`}
                  onClick={() => setDeveloperMode(!developerMode)}
                >
                  <div className="toggle-slider"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Display Tab */}
      {activeTab === 'display' && (
        <div className="tab-content active">
          <div className="setting-section">
            <h2>Array View</h2>
            <details open>
              <summary>Array Display Options</summary>
              <div className="setting-item" style={{ marginTop: '10px' }}>
                <div className="toggle-container">
                  <label>Show Line Indexes (Array)</label>
                  <div
                    className={`toggle-switch ${showArrayLineNumbers ? 'active' : ''}`}
                    onClick={() => {
                      const next = !showArrayLineNumbers;
                      dispatch(updateSetting({ key: 'showArrayLineNumbers', value: next }));
                      if (window.electronAPI && window.electronAPI.settingsSaved) {
                        window.electronAPI.settingsSaved({ showArrayLineNumbers: next });
                      }
                    }}
                  >
                    <div className="toggle-slider"></div>
                  </div>
                </div>
                <p className="setting-hint">
                  {showArrayLineNumbers
                    ? 'Array view shows line index numbers and IDs in the left gutter.'
                    : 'Array view hides line index numbers and IDs for a cleaner page look.'}
                </p>
              </div>
            </details>
          </div>

          <div className="setting-section">
            <h2>Monaco View</h2>
            <details open>
              <summary>Monaco Display Options</summary>
              <div className="setting-item" style={{ marginTop: '10px' }}>
                <div className="toggle-container">
                  <label>Show Sticky Top Bar (Monaco)</label>
                  <div
                    className={`toggle-switch ${monacoStickyTopBar ? 'active' : ''}`}
                    onClick={() => {
                      const next = !monacoStickyTopBar;
                      dispatch(setMonacoStickyTopBar(next));
                      if (window.electronAPI && window.electronAPI.settingsSaved) {
                        window.electronAPI.settingsSaved({ monacoStickyTopBar: next });
                      }
                    }}
                  >
                    <div className="toggle-slider"></div>
                  </div>
                </div>
                <p className="setting-hint">
                  {monacoStickyTopBar
                    ? 'Monaco view pins the current chapter/section header at the top while scrolling.'
                    : 'Monaco view scrolls normally without a sticky top bar.'}
                </p>
              </div>

              <div className="setting-item">
                <div className="toggle-container">
                  <label>Show Line Indexes (Monaco)</label>
                  <div
                    className={`toggle-switch ${showMonacoLineNumbers ? 'active' : ''}`}
                    onClick={() => {
                      const next = !showMonacoLineNumbers;
                      dispatch(setShowMonacoLineNumbers(next));
                      if (window.electronAPI && window.electronAPI.settingsSaved) {
                        window.electronAPI.settingsSaved({ showMonacoLineNumbers: next });
                      }
                    }}
                  >
                    <div className="toggle-slider"></div>
                  </div>
                </div>
                <p className="setting-hint">
                  {showMonacoLineNumbers
                    ? 'Monaco view shows line index numbers on the left.'
                    : 'Monaco view hides line index numbers for a cleaner page look.'}
                </p>
              </div>

              <div className="setting-item">
                <div className="toggle-container">
                  <label>Show Right Preview Bar</label>
                  <div
                    className={`toggle-switch ${showPreviewBar ? 'active' : ''}`}
                    onClick={() => {
                      const next = !showPreviewBar;
                      dispatch(setShowPreviewBar(next));
                      if (window.electronAPI && window.electronAPI.settingsSaved) {
                        window.electronAPI.settingsSaved({ showPreviewBar: next });
                      }
                    }}
                  >
                    <div className="toggle-slider"></div>
                  </div>
                </div>
                <p className="setting-hint">
                  {showPreviewBar
                    ? 'Preview bar is visible on the right side.'
                    : 'Preview bar is hidden. AI tools still work but without the live preview panel.'}
                </p>
              </div>
            </details>
          </div>
        </div>
      )}

      {/* AI Tab */}
      {activeTab === 'ai' && (
        <div className="tab-content active">
          <div className="setting-section">
            <h2>AI Assistant</h2>
            <div className="setting-item">
              <div className="toggle-container">
                <label>Enable AI Assistant</label>
                <div 
                  className={`toggle-switch ${aiEnabled ? 'active' : ''}`}
                  onClick={() => setAiEnabled(!aiEnabled)}
                >
                  <div className="toggle-slider"></div>
                </div>
              </div>
            </div>

            {aiEnabled && (
              <div style={{ marginTop: '20px' }}>
                <div className="setting-item">
                  <label>AI Service</label>
                  <select 
                    className="ai-service-select"
                    value={aiService}
                    onChange={(e) => setAiService(e.target.value)}
                  >
                    <option value="none">None</option>
                    <option value="deepseek">DeepSeek (Direct)</option>
                    <option value="deepseek-server">DeepSeek (Custom Server)</option>
                    <option value="grok">Grok</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic (Claude)</option>
                  </select>
                </div>

                {aiService === 'deepseek' && (
                  <div className="api-key-input">
                    <label>DeepSeek API Key</label>
                    <div className="api-key-input-wrapper">
                      <input
                        id="deepseekKey"
                        type="password"
                        placeholder="Enter DeepSeek API key..."
                        value={apiKeys.deepseek || ''}
                        onChange={(e) => handleApiKeyChange('deepseek', e.target.value)}
                      />
                      <button 
                        className="toggle-visibility-btn"
                        onClick={() => togglePasswordVisibility('deepseekKey')}
                      >
                        👁
                      </button>
                    </div>
                  </div>
                )}

                {aiService === 'grok' && (
                  <div className="api-key-input">
                    <label>Grok API Key</label>
                    <div className="api-key-input-wrapper">
                      <input
                        id="grokKey"
                        type="password"
                        placeholder="Enter Grok API key..."
                        value={apiKeys.grok || ''}
                        onChange={(e) => handleApiKeyChange('grok', e.target.value)}
                      />
                      <button 
                        className="toggle-visibility-btn"
                        onClick={() => togglePasswordVisibility('grokKey')}
                      >
                        👁
                      </button>
                    </div>
                  </div>
                )}

                {aiService === 'openai' && (
                  <div className="api-key-input">
                    <label>OpenAI API Key</label>
                    <div className="api-key-input-wrapper">
                      <input
                        id="openaiKey"
                        type="password"
                        placeholder="Enter OpenAI API key..."
                        value={apiKeys.openai || ''}
                        onChange={(e) => handleApiKeyChange('openai', e.target.value)}
                      />
                      <button 
                        className="toggle-visibility-btn"
                        onClick={() => togglePasswordVisibility('openaiKey')}
                      >
                        👁
                      </button>
                    </div>
                  </div>
                )}

                {aiService === 'anthropic' && (
                  <div className="api-key-input">
                    <label>Anthropic API Key</label>
                    <div className="api-key-input-wrapper">
                      <input
                        id="anthropicKey"
                        type="password"
                        placeholder="Enter Anthropic API key..."
                        value={apiKeys.anthropic || ''}
                        onChange={(e) => handleApiKeyChange('anthropic', e.target.value)}
                      />
                      <button 
                        className="toggle-visibility-btn"
                        onClick={() => togglePasswordVisibility('anthropicKey')}
                      >
                        👁
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Account Tab */}
      {activeTab === 'account' && (
        <div className="tab-content active">
          <div className="setting-section">
            <div className="setting-section-header">
              <h2>Authentication & Subscription</h2>
              <RefreshButton
                onClick={loadAccountData}
                disabled={!anonId}
                loading={accountLoading}
                title="Refresh account from server"
              />
            </div>

            <AccountAuthSection
              anonId={anonId}
              authId={authId}
              deviceId={deviceId}
              onAccountUpdated={(result) => {
                if (result && result.authUser && result.authUser.id) {
                  const newAuthId = result.authUser.id;
                  setAuthId(newAuthId);

                  // Keep Redux authId in sync so other components (like AISidebar) see the change
                  dispatch(setReduxAuthId(newAuthId));

                  // Notify main window so primary App instance can update authId immediately
                  if (window.electronAPI && window.electronAPI.settingsSaved) {
                    window.electronAPI.settingsSaved({ authId: newAuthId });
                  }
                }
                if (result && result.user) {
                  setAccountData(result.user);
                  const normalized = normalizeUserTokenData(result.user || {});
                  setTokenStats(normalized);
                  setTokenCount(normalized.availableTokens > 0 ? normalized.availableTokens : 0);
                } else {
                  loadAccountData();
                }
              }}
              onAuthCleared={() => {
                setAuthId(null);
                localStorage.removeItem('authId');

                // Notify main window so primary App instance can clear authId
                if (window.electronAPI && window.electronAPI.settingsSaved) {
                  window.electronAPI.settingsSaved({ authId: null });
                }

                // Also clear Redux authId so web/electron UI stays in sync
                dispatch(setReduxAuthId(null));
              }}
              initialEmail={accountEmail}
              initialPassword={accountPassword}
              subscriptionType={tierName}
              nextBillingDate={nextBillingDate}
            />

            {developerMode && (
              <>
                <div className="stat-item anon-id-box" style={{ marginTop: '12px' }}>
                  <span className="stat-label">🔑 Anonymous ID</span>
                  <span className="stat-value">{anonId || 'Loading...'}</span>
                </div>

                <div className="stat-item auth-id-box">
                  <span className="stat-label">👤 Auth ID</span>
                  <span className="stat-value">{authId || 'Not logged in'}</span>
                </div>
              </>
            )}
          </div>

          <div className="setting-section">
            <div className="setting-section-header">
              <h2>Token Usage</h2>
              <RefreshButton
                onClick={loadAccountData}
                disabled={!anonId}
                loading={accountLoading}
                title="Refresh token usage from server"
              />
            </div>
            <div className="stat-item">
              <span className="stat-label">Tokens Remaining This Month</span>
              <span className="stat-value token-count">{tokenCount.toLocaleString()}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Monthly Balance</span>
              <span className="stat-value">
                {tokensMonthly != null ? tokensMonthly.toLocaleString() : 'Loading...'}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Tokens Used This Month</span>
              <span className="stat-value">
                {tokensUsed != null ? tokensUsed.toLocaleString() : 'Loading...'}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Tokens Added</span>
              <span className="stat-value">
                {tokensAdded != null ? tokensAdded.toLocaleString() : 'Loading...'}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Tokens Used All Time</span>
              <span className="stat-value">
                {tokensUsedAllTime != null ? tokensUsedAllTime.toLocaleString() : 'Loading...'}
              </span>
            </div>

            <TokenUsageLog anonId={anonId} authId={authId} />
          </div>

          {accountError && (
            <div className="setting-section">
              <h2>Account Load Error</h2>
              <div className="stat-item">
                <span className="stat-label">Error</span>
                <span className="stat-value">{accountError}</span>
              </div>
            </div>
          )}

          {developerMode && (
            <div className="setting-section">
              <div className="setting-section-header">
                <h2>Developer Tools</h2>
                <RefreshButton
                  onClick={loadAccountData}
                  disabled={!anonId}
                  loading={accountLoading}
                  title="Refresh developer data from server"
                />
              </div>

              {developerToolsStatus && (
                <div className="stat-item">
                  <span className="stat-label">{developerToolsStatus}</span>
                </div>
              )}

              <div
                className="stat-item"
                style={{ justifyContent: 'center', gap: '10px' }}
              >
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleDeveloperResetIds}
                >
                  Reset local anon/auth IDs
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleDeveloperBurnTokens}
                >
                  -14k tokens
                </button>
              </div>

              {accountData && (
                <div className="stat-item">
                  <span className="stat-label">Raw User Record</span>
                  <pre className="user-account-json">
                    {JSON.stringify(accountData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {settingsSavedMsg && (
        <div style={{ textAlign: 'center', marginTop: '10px', marginBottom: '10px', color: '#4CAF50' }}>
          {settingsSavedMsg}
        </div>
      )}

      <div className="button-container">
        <button className="btn-secondary" onClick={handleCancel}>Cancel</button>
        <button className="btn-primary" onClick={handleSave}>Save</button>
      </div>
    </div>
  );
}

export default Settings;

in menus.js
This is a mess, just use the <Window in the  settings component. use the isSettingsOpen in the <Settings (SettingsNew now) so it knows when to display. so we can just have <Settings/> in the Menus.js (where this code is)
      {/* Web-only Settings modal */}
      {isSettingsOpen && (
        <Window
          title="Settings"
          onClose={() => dispatch(closeSettings())}
          className="window-large"
        >
          <Settings
            onClose={() => dispatch(closeSettings())}
            initialTab={settingsTab || 'general'}
          />
        </Window>
      )}

Also in Menus.js:
{/* Web-only Download info modal */}
      {isWeb() && showDownloadModal && (
        <Window
          title="Download"
          onClose={() => dispatch(closeDownloadModal())}
          className="window-medium"
        >
          <div style={{ color: '#e0e0e0', fontSize: '14px', lineHeight: 1.5, textAlign: 'center' }}>
            <p style={{ marginBottom: '12px' }}>
              The browser cannot save directly to your file system so to keep your
              work download a text file version of your document or download the
              desktop app so you can save directly.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={handleWebDownloadFile}
              >
                Download Text File
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  window.open('https://scribefold-ai-monorepo.onrender.com/#/downloads', '_blank', 'noopener,noreferrer');
                }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <span>Download Desktop App</span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M14 3h7v7" />
                  <path d="M10 14L21 3" />
                  <path d="M5 5v16h16" />
                </svg>
              </button>
            </div>
          </div>
        </Window>
that is crazy, put this in a new component!

example of bad:
  const [authEmail, setAuthEmail] = useState(authUser?.email || '');
we do not need a seperate state just to put part of an object we already have access to
just authUser?.email where its needed
if you need to get it from <input ref={emailInput}> call getelementbyid(emailInput)?.value 
and if you need to use it just use  authUser.email from redux

  deviceId, is pulled from redux in the parent and sent as a prop, thats bad, just get it in the child from redux. 

nextBillingDate is pulled in the parent, has unnecessary state becasue we can jsut call normalizedTokens?.nextBillingDate if we need it from a redux variable obtained in the component itself, not the child. so we can avoid an unnecessary varialbe in the parent and the prop in the component. 

why are we changing the name of this and sending it as a prop? just call it the same things everywhere 
subscriptionType={tierName}

this is bad:
           style={{
                textAlign: 'center',
                marginTop: '10px',
                marginBottom: '10px',
                color: '#4CAF50',
              }}
we don't need a ton of random inline css that is not standard and has to be changed all over the place
create a css file for this or reuse standard if its a standard class. Like .box may be standard and .infoBox may make changes on that, we do not wan to recreate css or put inline css unless its a small one time thing like a bit of extra padding in one place. 

this state is fine because it is component scope and just changes the display and what function is called in this component
  const [authMode, setAuthMode] = useState('create'); // 'create' or 'login'
same with this one its ok:
  const [loading, setLoading] = useState(false);

create a function for opening this instead of chaning all this together
in that funciton get the email andpassword from the proper place like user data 
              onClick={() => openExternalLink(buildWebPortalAutoLoginUrl(authEmail, authPassword))}

more inlines css:
                <span style={{ fontSize: '12px', color: '#d0d7eb', marginTop: '2px' }}>(Auto Login)</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
really a mess. 


if ther is an unsaved changes window we can just put all of this in there, so not like this:
(This was in Menu.js instead of the ConfirmCloseModal, even though its only used in ConfirmCloseModal)
// Unsaved changes dialog handlers
  const handleUnsavedSave = () => {
    dispatch(closeUnsavedDialog());
    if (window.electronAPI && window.electronAPI.unsavedChangesResponse) {
      window.electronAPI.unsavedChangesResponse('save');
    }
  };


  const handleUnsavedDiscard = () => {
    dispatch(closeUnsavedDialog());
    if (window.electronAPI && window.electronAPI.unsavedChangesResponse) {
      window.electronAPI.unsavedChangesResponse('discard');
    }
  };


  const handleUnsavedCancel = () => {
    dispatch(closeUnsavedDialog());
    if (window.electronAPI && window.electronAPI.unsavedChangesResponse) {
      window.electronAPI.unsavedChangesResponse('cancel');
    }
  };

that modal is still using a bunch of jsx in its parent component:
      {/* Unsaved changes dialog */}
      {showUnsavedDialog && (
        <ConfirmCloseModal
          onSave={handleUnsavedSave}
          onDiscard={handleUnsavedDiscard}
          onCancel={handleUnsavedCancel}
        />
      )}
it should just be <ConfirmCloseModal/>
no props, no conditoinal, no extra jsx (it actually didnt ahe unused jsx in this case) 

why are we getting this just on its own from state and not a settings object in state? and on its own? we should pull all settings into redux from local storage in one loading file, and when settings are updated a redux action is called to update that attribute, in the actoin we would get from local storage, update that atrribugte, and put it back in local storage. This makes it centralized so if we have a settings bug we can always look in one place.     setDeveloperMode(savedDeveloperMode === null ? false : savedDeveloperMode === 'true');
  }, []);


in this case:
      {activeTab === 'account' && (
        <div className="tab-content active">
          <AccountSettings />
        </div>
      )}

this should be:
          <AccountSettings activeTab={activeTab }/>
because it is much more simple and one line, versues 5 lines. 


always check for errors on a final pass and resolve them before responding. 


instead of this:
  const handleClose = () => {
    dispatch(closeSettings());
  };
we can just call dispatch(closeSettings()); directly
this is 3 wasted lines of space that is not adding any value


issue of returning too early:
  const [activeTab, setActiveTab] = useState(normalizedInitialTab);

  if (!isSettingsOpen) {
    return null;
  }

  const handleClose = () => {
    dispatch(closeSettings());
  };

  return (
    <Window...
or
  if (!isSettingsOpen) {
    return null;
  }
  const [activeTab, setActiveTab] = useState(normalizedInitialTab);
...
that will cause an error!
if there is a return like that make sure it is right before the other return that returns the actual jsx 

this is overly complex:
  const settingsTab = useSelector(selectSettingsTab);


  const normalizedInitialTab =
    settingsTab === 'display' || settingsTab === 'ai' || settingsTab === 'account' || settingsTab === 'general'
      ? settingsTab
      : 'general';


  const [activeTab, setActiveTab] = useState(normalizedInitialTab);
this is enough


in other parts of the program we are getting and setting settings with other localstorage
  const handleSaveAI = () => {
    localStorage.setItem('aiEnabled', aiEnabled);
    localStorage.setItem('aiService', aiService);
    localStorage.setItem('apiKeys', JSON.stringify(apiKeys));

    if (window.electronAPI?.settingsSaved) {
      window.electronAPI.settingsSaved({
        aiEnabled,
        aiService,
        apiKeys,
      });
    }
  };
in diffent ways in different places. This is not good. One redux action to load called in one place on start, one redux action to update (updates localstorage and redux settigns object values) called from wherever it updats from. This keeps it simple.   
We should have one initializer file that loads the settings from localStorage into a redux settings slice settingsObject and one action that takes the settings attribute and new value, updates the settingsObject, and saves it in localStorage for the next app load 



the reason this is so long is because this kind of bad code creates very long complicated files that are mostly jsut trash, we are trying to avoid that. We want to keep things simple, short, and well organized so we can code efficiently and withoug bugs.


  Add comments like this:

 // Generic setter for updating any setting in the settings object
    updateSetting(state, action) {
      // Get the key and value from the payload
      const { key, value } = action.payload;

      // Check they are valid because they are necessary for the next steps
      if(!key || !value) {
        // Log and return if they are not
        console.log("updateSetting missing key or value: ", key, value)
        return
      }
      // Get the current settings object (or use a fallback of an empty json)
      const currentSettingsObject = getStorageItem('settingsObject') || {}
      // Update thevalue based on the key and value from the payload
      currentSettingsObject[key] = value

      // Put in redux sate so UI updates or changes in app are made
      state.settingsObject = currentSettingsObject

      // Set the storage for persistant single source of truth for the ap settings
      setStorageItem('settingsObject', currentSettingsObject)

    },


some more dumb code:
// Initial setup on mount
  useEffect(() => {
    // Load all settings from localStorage into Redux
    dispatch(loadAllSettings());

    // Load saved background (todo this should be in the settings object)
    loadSavedBackground();

    // Load saved authId from localStorage (todo his is terribly wrong, and shoul not happen, auth id is only from the supabase auth user)
    try {
      const savedAuthId = localStorage.getItem('authId');
      if (savedAuthId) {
        console.log('[INIT] Loaded authId from localStorage:', savedAuthId);
        dispatch(setAuthId(savedAuthId));
      }
    } catch (e) {
      // Ignore storage errors todo this is wrong, should at least log somehting 
    }

    // Get anon_id from Electron or generate for web todo: wrong, we don't want electron specific code when not necessary 
    if (isElectron()) {
      // Request anonId from Electron
      window.electronAPI.getAnonId().then(id => {
        console.log('[INIT] Received anon_id:', id);
        dispatch(setAnonId(id));
      });

      // Get device_id for per-device token grants (desktop only) (this is ok for electron specific)
      window.electronAPI.getDeviceId().then(id => {
        console.log('[INIT] getDeviceId() resolved with:', id ? '(set)' : '(null)');
        dispatch(setDeviceId(id));
      }).catch(err => {
        console.error('[INIT] getDeviceId() failed:', err);
        dispatch(setDeviceId(null));
      });
    } else {
      // Web mode: generate anon_id from localStorage
      const webAnonId = getWebAnonId();
      console.log('[INIT] Using web anon_id:', webAnonId);
      dispatch(setAnonId(webAnonId));
      // Web mode has no deviceId
      dispatch(setDeviceId(undefined));
    }

    // Load last opened file (Electron only) todo: can we make this work on browser too? 
    const lastFile = localStorage.getItem('lastOpenedFile');
    if (lastFile && isElectron()) {
      fileOps.openFileByPath(lastFile)
        .then(result => {
          if (result && result.success) {
            console.log('[INIT] Loaded last file:', result.filePath);
            dispatch(fileOpened({ filePath: result.filePath, content: result.content }));
            parseText(result.content); // Initialize editorEngine for array view
          } else {
            console.log('[INIT] Failed to load last file');
            localStorage.removeItem('lastOpenedFile');
          }
        })
        .catch(err => {
          console.log('[INIT] Could not load last file:', err);
          localStorage.removeItem('lastOpenedFile');
        });
    }

    // Hide loading screen after initial setup todo: this is rediculous why 500ms???? that is just slowness for now reason! just set not loading when its done! this is super stupid. Also stupid is scalling a useeffect to poll for a ref data value insted of using state which was seen in dumb solutions. 
    // The actual data loading will happen in the next useEffect when anonId is available
    setTimeout(() => {
      dispatch(setLoadingVisible(false));
    }, 500);
  }, [dispatch]);

How it should be:
