import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import './AISidebar.css';
import TokenInfoModal from '../Windows/TokenInfoModal';
import RefreshButton from '../UI/RefreshButton';
import { callDeepSeekServerAPI, calculateFullTokenEstimate, fetchUserTokens, fetchUserAccount, buildWebPortalAutoLoginUrl, processChangesForRedux, processChanges, integrateChangesIntoLines } from '../../utils/aiService';
import { getLines, updateLinesFromText, getTextFromLines, setLines } from '../../utils/editorEngine';
import { setProposals } from '../../store/aiSlice';
import { setAIChanges } from '../../store/aiChangesSlice';
import { selectViewType } from '../../store/editorSlice';
import { isWeb } from '../../utils/environment';
import { openSettings } from '../../store/uiSlice';
import { selectAnonId, selectAuthId, selectDeviceId, selectAvailableTokens, setAvailableTokens as setReduxAvailableTokens } from '../../store/userSlice';
import { selectDeveloperMode } from '../../store/settingsSlice';
import { WEB_PORTAL_BASE_URL } from '../../utils/constants';

// Duration to keep the refresh animation visible (ms)
const REFRESH_ANIMATION_DURATION = 800;

/**
 * AISidebar - AI chat and token management sidebar (refactored per v2 plan)
 * 
 * Now reads anonId, authId, developerMode, and availableTokens from Redux.
 * Uses monacoRef to get lines from SimpleMonaco and dispatch proposals to Redux.
 */
function AISidebar({ onAIResponse, monacoRef }) {
  const dispatch = useDispatch();
  
  // Read from Redux instead of props
  const anonId = useSelector(selectAnonId);
  const authId = useSelector(selectAuthId);
  const deviceId = useSelector(selectDeviceId);
  const developerMode = useSelector(selectDeveloperMode);
  const reduxAvailableTokens = useSelector(selectAvailableTokens);
  const viewType = useSelector(selectViewType); // 'array' or 'monaco'
  
  const [messages, setMessages] = useState([]);
  // Always start with a sample prompt that asks the AI to make multiple edits for testing
  const [prompt, setPrompt] = useState('please add content of your choosing in various places ');
  const [tokenCount, setTokenCount] = useState(0);
  const [isThinking, setIsThinking] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenEstimate, setTokenEstimate] = useState(null);
  const [availableTokens, setAvailableTokens] = useState(reduxAvailableTokens);
  const messagesEndRef = useRef(null);
  const aiDebugDataRef = useRef([]);
  const [isRefreshingTokens, setIsRefreshingTokens] = useState(false);

  useEffect(() => {
    // Update token count when component mounts
    updateTokenCount();
  }, []);

  // When auth state changes (e.g., user logs in), auto-refresh token info
  useEffect(() => {
    if (!anonId || !authId) return;
    updateTokenCount();
  }, [anonId, authId, deviceId]);

  // Sync availableTokens from Redux when it changes
  useEffect(() => {
    if (reduxAvailableTokens != null) {
      setAvailableTokens(reduxAvailableTokens);
    }
  }, [reduxAvailableTokens]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Debug what's available
    console.log('Electron API available:', !!window.electronAPI);
    console.log('electronAPI object:', window.electronAPI);
    console.log('openExternal function:', window.electronAPI?.openExternal);
  }, []);

  const updateTokenCount = async () => {
    // Start refresh animation
    setIsRefreshingTokens(true);

    const lines = getLines();
    const estimate = calculateFullTokenEstimate(lines);
    setTokenCount(estimate.total);
    setTokenEstimate(estimate);

    // Also refresh available tokens from backend when the refresh button is clicked
    try {
      if (anonId) {
        console.log('[AI] Refresh button calling fetchUserTokens with ids:', { anonId, authId, deviceId });
        const data = await fetchUserTokens(anonId, authId, deviceId);
        if (data) {
          let effectiveAvailable;
          if (typeof data.availableTokens === 'number') {
            effectiveAvailable = data.availableTokens;
          } else {
            // New formula: available = tokens_monthly + tokens_added
            const monthly = data.tokensMonthly ?? data.tokens_monthly ?? 0;
            const added = data.tokensAdded ?? data.tokens_added ?? 0;
            effectiveAvailable = monthly + added;
          }
          console.log('[AI] Refresh updated availableTokens to:', effectiveAvailable, 'raw data:', data);
          setAvailableTokens(effectiveAvailable);
        }
      }
    } catch (err) {
      console.error('[AI] Failed to refresh available tokens from refresh button:', err);
    } finally {
      // Ensure the animation is visible for at least a short duration
      setTimeout(() => {
        setIsRefreshingTokens(false);
      }, REFRESH_ANIMATION_DURATION);
    }
  };

  const handleTokenInfoClick = () => {
    const lines = getLines();
    const estimate = calculateFullTokenEstimate(lines);
    setTokenEstimate(estimate);
    setShowTokenModal(true);
  };

  const addMessage = (role, content, debugData = null, button = null) => {
    const message = { role, content, timestamp: new Date().toISOString() };
    if (button) {
      message.button = button;
    }
    if (debugData) {
      message.debugIndex = aiDebugDataRef.current.length;
      aiDebugDataRef.current.push(debugData);
    }
    setMessages(prev => [...prev, message]);
  };

  const openDebugWindow = (debugIndex) => {
    const debugData = aiDebugDataRef.current[debugIndex];
    if (!debugData) return;

    try {
      const debugWindow = window.open('', 'AI_Debug_Info', 'width=800,height=600,scrollbars=yes');
      if (debugWindow && debugWindow.document) {
        const userMessage = debugData.userMessage || 'N/A';
        const aiMessage = debugData.message || 'N/A';
        const timestamp = debugData.timestamp || 'N/A';
        const rawRequestBody = JSON.stringify(debugData.requestBody, null, 2);
        const rawResponse = debugData.raw || 'N/A';
        const parsedResponse = JSON.stringify(debugData.parsed, null, 2);

        const reportText = [
          'User Message:',
          userMessage,
          '',
          'AI Response Message:',
          aiMessage,
          '',
          'Timestamp:',
          timestamp,
          '',
          'Raw Request Body:',
          rawRequestBody,
          '',
          'Raw Response:',
          rawResponse,
          '',
          'Parsed Response:',
          parsedResponse
        ].join('\n');

        debugWindow.document.open();
        debugWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>AI Debug Information</title>
            <style>
              body {
                font-family: 'Consolas', 'Monaco', monospace;
                background: #1a1a1a;
                color: #e0e0e0;
                padding: 20px;
              }
              .header-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
              }
              .copy-btn {
                background: #4a6da7;
                color: white;
                border: none;
                padding: 6px 10px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
              }
              .copy-btn:hover {
                background: #5b7fca;
              }
              .section { 
                border: 1px solid #444;
                margin-bottom: 15px;
                border-radius: 4px;
              }
              .section-header {
                padding: 10px 15px;
                background: #2a2a2a;
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
              }
              .section-header::after {
                content: '▼';
                font-size: 12px;
              }
              .section.expanded .section-header::after {
                content: '▲';
              }
              .section-content {
                padding: 0;
                display: none;
              }
              .section.expanded .section-content {
                display: block;
              }
              pre {
                margin: 0;
                padding: 15px;
                background: #1a1a1a;
                border-top: 1px solid #444;
                overflow-x: auto;
                white-space: pre-wrap;
              }
            </style>
          </head>
          <body>
            <div class="header-row">
              <h2>AI Debug Information</h2>
              <button class="copy-btn" title="Copy full debug report">⎘ Copy</button>
            </div>

            <div class="section expanded">
              <div class="section-header">User Message</div>
              <div class="section-content">
                <pre>${userMessage}</pre>
              </div>
            </div>

            <div class="section expanded">
              <div class="section-header">AI Response Message</div>
              <div class="section-content">
                <pre>${aiMessage}</pre>
              </div>
            </div>

            <div class="section">
              <div class="section-header">Timestamp</div>
              <div class="section-content">
                <pre>${timestamp}</pre>
              </div>
            </div>

            <div class="section">
              <div class="section-header">Raw Request Body</div>
              <div class="section-content">
                <pre>${rawRequestBody}</pre>
              </div>
            </div>

            <div class="section">
              <div class="section-header">Raw Response</div>
              <div class="section-content">
                <pre>${rawResponse}</pre>
              </div>
            </div>

            <div class="section">
              <div class="section-header">Parsed Response</div>
              <div class="section-content">
                <pre>${parsedResponse}</pre>
              </div>
            </div>

            <script>
              document.querySelectorAll('.section-header').forEach(header => {
                header.addEventListener('click', () => {
                  header.parentElement.classList.toggle('expanded');
                });
              });

              const reportText = ${JSON.stringify(reportText)};
              document.querySelector('.copy-btn').addEventListener('click', () => {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  navigator.clipboard.writeText(reportText)
                    .then(() => {
                      console.log('Debug report copied to clipboard');
                    })
                    .catch(err => {
                      console.error('Copy failed:', err);
                    });
                } else {
                  const textarea = document.createElement('textarea');
                  textarea.value = reportText;
                  document.body.appendChild(textarea);
                  textarea.select();
                  try {
                    document.execCommand('copy');
                  } catch (e) {
                    console.error('Fallback copy failed:', e);
                  }
                  document.body.removeChild(textarea);
                }
              });
            </script>
          </body>
          </html>
        `);
        debugWindow.document.close();
      }
    } catch (error) {
      console.error('Failed to open debug window:', error);
    }
  };

  const handleSend = async () => {
    if (!prompt.trim() || isThinking) return;

    const userPrompt = prompt.trim();
    addMessage('user', userPrompt);
    setPrompt('');
    await sendPrompt(userPrompt);
  };

  const sendPrompt = async (userPrompt) => {
    if (!userPrompt.trim() || isThinking) return;

    setIsThinking(true);

    try {
      let aiService = localStorage.getItem('aiService');
      
      // If no service is set or set to 'none', default to deepseek-server
      if (!aiService || aiService === 'none') {
        aiService = 'deepseek-server';
        localStorage.setItem('aiService', 'deepseek-server');
      }
      
      // Get lines from SimpleMonaco via ref (with hidden IDs)
      let lines;
      if (monacoRef && monacoRef.current && monacoRef.current.prepareForAI) {
        lines = monacoRef.current.prepareForAI();
      } else {
        // Fallback to editorEngine if ref not available
        lines = getLines();
      }
      
      console.log('[AI] Sending request to:', aiService);
      console.log('[AI] Lines count:', lines.length);
      console.log('[AI] User ID:', anonId);
      
      let response;
      
      if (aiService === 'deepseek-server') {
        response = await callDeepSeekServerAPI(userPrompt, lines, anonId, authId, deviceId);
        console.log('[AI] Received response:', response);
      } else if (aiService === 'deepseek') {
        throw new Error('DeepSeek Direct API not yet implemented. Please use DeepSeek (Custom Server) in settings.');
      } else {
        throw new Error(`${aiService} not yet implemented. Please select DeepSeek (Custom Server) in settings.`);
      }

      setIsThinking(false);

      // Process AI changes differently based on viewType
      console.log('🎯 [AI Response] Parsed:', response.parsed);
      console.log('📋 [AI] Current viewType:', viewType);
      console.log('🧵 [AI] Original lines snapshot length:', lines.length);
      
      if (viewType === 'array') {
        // ARRAY EDITOR: Integrate changes directly into lines
        // processChanges expects the full parsed response object (with .changes property)
        const processedChanges = processChanges(response.parsed);
        console.log('🧩 [AI/Array] processChanges result:', processedChanges);
        
        // Check if processChanges returned an error
        if (processedChanges.error) {
          console.warn('⚠️ [AI/Array] processChanges error:', processedChanges.error);
          // No changes to integrate, skip
        } else {
          const newLines = integrateChangesIntoLines(processedChanges, lines);
          console.log('🧬 [AI/Array] integrateChangesIntoLines produced lines:', newLines.length);
          
          // Build list of all change IDs
          const allChangeIds = [];
          newLines.forEach(line => {
            if (line.proposedChangeId) {
              allChangeIds.push(line.proposedChangeId);
            }
          });
          console.log('🧭 [AI/Array] All change IDs for array editor:', allChangeIds);
          
          // Update lines in editorEngine
          console.log('💾 [AI/Array] Writing newLines into editorEngine via setLines');
          setLines(newLines);
          
          // Store changes in Redux (aiChangesSlice)
          console.log('📥 [Redux] Dispatching setAIChanges with allChangeIds + processedChanges');
          dispatch(setAIChanges({ allChangeIds, processedChanges }));
          console.log('✅ [Redux] AI changes stored in aiChangesSlice');
          
          // Notify editor to re-render
          if (monacoRef && monacoRef.current && monacoRef.current.updateLinesFromAI) {
            console.log('🔄 [AI/Array] Calling editorRef.updateLinesFromAI(newLines)');
            monacoRef.current.updateLinesFromAI(newLines);
          } else {
            console.log('ℹ️ [AI/Array] editorRef.updateLinesFromAI not available');
          }
        }
      } else {
        // MONACO EDITOR: Shape AI changes for Redux proposals (original vs proposed text)
        const proposalsByLineId = processChangesForRedux(response.parsed, lines);
        console.log('📦 [Redux] Storing AI proposals map in ai.aiProposals ...');
        dispatch(setProposals(proposalsByLineId));
        console.log('✅ [Redux] AI proposals stored');
      }

      // Create debug data for chat display (also used in debug popup window)
      const debugData = {
        userMessage: userPrompt,
        raw: response.raw,
        parsed: response.parsed,
        message: response.parsed.message,
        requestBody: response.requestBody,
        timestamp: new Date().toISOString(),
        // NOTE: For array view, additional details about processedChanges/newLines
        // are logged to the console. If needed later, we can plumb them in via
        // Redux or a higher-scope variable instead of referencing block-scoped
        // variables here.
      };

      const buttonFlag = response.parsed.button || null;
      addMessage('assistant', response.parsed.message, debugData, buttonFlag);

      // Log change count if present
      const changeCount = Array.isArray(response.parsed.changes)
        ? response.parsed.changes.length
        : 0;
      if (changeCount > 0) {
        console.log(`📝 [AI] ${changeCount} changes received`);
      }

      // Refresh available tokens after a successful AI response
      try {
        if (anonId) {
          const tokenData = await fetchUserTokens(anonId, authId, deviceId);
          if (tokenData) {
            if (typeof tokenData.availableTokens === 'number') {
              setAvailableTokens(tokenData.availableTokens);
            } else {
              // New formula: available = tokens_monthly + tokens_added
              const monthly = tokenData.tokensMonthly ?? tokenData.tokens_monthly ?? 0;
              const added = tokenData.tokensAdded ?? tokenData.tokens_added ?? 0;
              setAvailableTokens(monthly + added);
            }
          }
        }
      } catch (tokenErr) {
        console.error('[AI] Failed to refresh user tokens after response:', tokenErr);
      }

    } catch (error) {
      console.error('AI API error:', error);
      setIsThinking(false);
      
      const errorDebugData = {
        error: error.message,
        debugInfo: error.debugInfo || { error: 'No debug info available' },
        timestamp: new Date().toISOString()
      };
      
      addMessage('assistant', `Error: ${error.message}`, errorDebugData);
    }
  };

  const handleKeyDown = (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const openAiSettings = () => {
    // In web mode, open shared Settings modal directly to AI tab
    if (isWeb()) {
      dispatch(openSettings({ tab: 'ai' }));
      return;
    }
    // Electron desktop behavior
    if (window.electronAPI && window.electronAPI.openAISettings) {
      window.electronAPI.openAISettings();
    }
  };
  const openAccountSettings = () => {
    // In web mode, open shared Settings modal directly to Account tab
    if (isWeb()) {
      dispatch(openSettings({ tab: 'account' }));
      return;
    }
    // Electron desktop behavior
    if (window.electronAPI && window.electronAPI.openAccountSettings) {
      window.electronAPI.openAccountSettings();
    }
  };

  const openExternalLink = async (url) => {
    try {
      if (window.electronAPI?.openExternal) {
        await window.electronAPI.openExternal(url);
      } else {
        // Web fallback: open in a new tab
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      console.error('Failed to open URL externally:', error);
      // No fallback - we WANT this to fail if it can't open externally
    }
  };

  const handleOpenAccountPortalFromChat = async () => {
    let email = '';
    let password = '';

    // First try localStorage in this window
    try {
      email = localStorage.getItem('userEmail') || '';
      password = localStorage.getItem('userPassword') || '';
    } catch (e) {
      // ignore
    }

    // If not available locally, fall back to backend user account data
    if ((!email || !password) && anonId) {
      try {
        const account = await fetchUserAccount(anonId);
        if (account) {
          email = account.email || email;
          password = account.password || password;
          try {
            if (email) localStorage.setItem('userEmail', email);
            if (password) localStorage.setItem('userPassword', password);
          } catch (e) {
            // ignore storage failures
          }
        }
      } catch (e) {
        console.error('[AI] Failed to fetch user account for auto-login link:', e);
      }
    }

    const url = buildWebPortalAutoLoginUrl(email, password);
    await openExternalLink(url);
  };

  return (
    <div id="aiSidebar" className="ai-sidebar">
      <div className="ai-sidebar-header">
        <div className="ai-header-inner">
          <div className="ai-header-icon-box">
            <img
              src="/app-images/scribefold-ai-icon-png.png"
              alt="ScribeFold AI Icon"
              className="ai-sidebar-icon"
            />
          </div>
          <div className="ai-header-title-box">
            <div className="ai-sidebar-title">AI Assistant</div>
          </div>
        </div>
      </div>

      <div className="token-counter-row">
        {/* Row 1: Available tokens label + value */}
        <div className="token-row-line">
          <div className="token-row-line-left">
            <span className="stat-label">Available Tokens</span>
          </div>
          <div className="token-row-line-right">
            <span className="token-row-available">
              {availableTokens != null ? availableTokens.toLocaleString() : 'Loading...'}
            </span>
            <RefreshButton
              onClick={updateTokenCount}
              loading={isRefreshingTokens}
              title="Refresh tokens and estimate"
              size="small"
            />
          </div>
        </div>

        {/* Row 2: Estimated used / prompt + boxed estimate/info/refresh on the right */}
        <div className="token-row-line">
          <div className="token-row-line-left token-row-line-left-sub">
            Estimated used / prompt
          </div>
          <div className="token-row-line-right">
            {tokenCount > 10000 && (
              <div className="token-alert-inline" title="Large Token Usage!">
                <span className="token-alert-triangle">▼</span>
                <span className="token-alert-text">Large Token Usage!</span>
              </div>
            )}
            <div className="token-counter token-row-token-count">
              <span id="tokenCount">~{tokenCount.toLocaleString()}</span>
            </div>
            <button
              id="tokenInfoBtn"
              className="token-info-btn"
              onClick={handleTokenInfoClick}
              title="View token usage breakdown"
            >
              ℹ️
            </button>
          </div>
        </div>
      </div>
      
      {developerMode && (
        <div className="id-display-section">
          <div className="id-display-row anon-id-row">
            <div className="id-label">Anon ID:</div>
            <div className="id-value">{anonId || 'Loading...'}</div>
          </div>
          <div className="id-display-row auth-id-row">
            <div className="id-label">Auth ID:</div>
            <div className="id-value">{authId || 'Not logged in'}</div>
          </div>
        </div>
      )}
      
      <div className="ai-sidebar-content" id="aiMessages">
        {/* Banner for non-authenticated web users explaining free token requirements */}
        {isWeb() && !authId && (
          <div className="ai-web-auth-banner">
            <div className="ai-web-auth-banner-content">
              <p><strong>Get free tokens</strong></p>
              <p>Free tokens awarded on:</p>
              <ul>
                <li>Creating a free account, <strong>or</strong></li>
                <li>Downloading the desktop app</li>
              </ul>
              <div className="ai-web-auth-banner-buttons">
                <button
                  className="ai-settings-btn"
                  onClick={openAccountSettings}
                >
                  Create Free Account
                </button>
                <a
                  href={`${WEB_PORTAL_BASE_URL}/#/downloads`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ai-download-link"
                >
                  Download Desktop App
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '4px' }}>
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        )}
        {messages.length === 0 ? (
          <p className="ai-placeholder">AI Assistant is ready. Type a prompt below to get started.</p>
        ) : (
          <>
            {messages.map((msg, idx) => (
              <div key={idx} className={`ai-message ai-message-${msg.role}`}>
                <div className="ai-message-header">
                  <div className="ai-message-label">
                    {msg.role === 'user' ? 'You' : 'AI Assistant'}
                  </div>
                  {developerMode && msg.role === 'assistant' && msg.debugIndex !== undefined && (
                    <button 
                      className="ai-debug-btn" 
                      onClick={() => openDebugWindow(msg.debugIndex)}
                      title="View debug info"
                    >
                      +
                    </button>
                  )}
                </div>
                <div className="message-content">
                  {msg.content}
                  {msg.role === 'assistant' && 
                   authId && 
                   availableTokens <= 0 && 
                   msg.button === 'account-settings' && (
                    <div style={{ marginTop: '10px', textAlign: 'center' }}>
                      <button
                        onClick={handleOpenAccountPortalFromChat}
                        style={{
                          padding: '10px 15px',
                          backgroundColor: '#4a6da7',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          width: '100%',
                          maxWidth: '200px',
                          display: 'block',
                          margin: '0 auto'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span>Account Portal</span>
                          <span style={{ fontSize: '12px', color: '#d0d7eb', marginTop: '2px' }}>(Auto Login)</span>
                        </div>
                      </button>
                    </div>
                  )}
                  {msg.role === 'assistant' && msg.button === 'account-settings' && (
                    <div style={{ marginTop: '10px', textAlign: 'center' }}>
                      <button
                        className="ai-settings-btn"
                        onClick={openAccountSettings}
                        style={{
                          width: '100%',
                          maxWidth: '200px',
                          display: 'block',
                          margin: '0 auto'
                        }}
                      >
                        Account Settings
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="ai-message ai-message-assistant thinking">
                <div className="message-content">
                  <div className="typing-indicator">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
      
      <div className="ai-sidebar-input">
        <textarea
          id="aiPromptInput"
          className="ai-prompt-input"
          placeholder="Type your prompt here... (Ctrl+Enter to send)"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={true}
          // Keep input editable even while AI is thinking; only disable the Send button
          disabled={false}
        />
        <div className="ai-input-buttons">
          <button id="aiSettingsBtn" className="ai-settings-btn" onClick={openAiSettings}>⚙️ Settings</button>
          <button id="aiSendBtn" className="ai-send-btn" onClick={handleSend} disabled={isThinking}>
            {isThinking ? 'Thinking...' : 'Send'}
          </button>
        </div>
      </div>
      
      {showTokenModal && (
        <TokenInfoModal 
          estimate={tokenEstimate}
          onClose={() => setShowTokenModal(false)}
        />
      )}
    </div>
  );
}

export default AISidebar;
