import React, { useState, useEffect } from 'react';
import './Settings.css';
import { fetchUserAccount, fetchUserTokens, normalizeUserTokenData, devBurnTokens } from '../utils/aiService';
import AccountAuthSection from './AccountAuthSection';
import RefreshButton from './RefreshButton';
import TokenUsageLog from './TokenUsageLog';

function Settings({ anonId, authId: authIdProp, deviceId, userAccount, onClose, onThemeChanged, initialTab = 'general' }) {
  const [activeTab, setActiveTab] = useState(initialTab || 'general');
  const [themes, setThemes] = useState([]);
  const [selectedTheme, setSelectedTheme] = useState('');
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiService, setAiService] = useState('deepseek-server');
  const [apiKeys, setApiKeys] = useState({});
  const [authId, setAuthId] = useState(null);
  const [developerMode, setDeveloperMode] = useState(true);
  const [tokenCount, setTokenCount] = useState(0);
  const [tokenStats, setTokenStats] = useState(null);
  const [accountData, setAccountData] = useState(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState(null);
  const [requestedTabLabel, setRequestedTabLabel] = useState('NONE');
  const [settingsSavedMsg, setSettingsSavedMsg] = useState('');
  const [developerToolsStatus, setDeveloperToolsStatus] = useState('');

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
    setAuthId(authIdProp || savedAuthId);

    const savedDeveloperMode = localStorage.getItem('developerMode');
    setDeveloperMode(savedDeveloperMode === null ? true : savedDeveloperMode === 'true');

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

    if (onThemeChanged) {
      onThemeChanged(selectedTheme);
    }

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
