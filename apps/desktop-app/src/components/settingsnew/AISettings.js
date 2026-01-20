import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import '../Settings/Settings.css';
import {
  selectIsAIEnabled,
  selectAiService,
  selectApiKeys,
  setIsAIEnabled,
  setAiService,
  setApiKeys,
} from '../../store/settingsSlice';

// WHAT: AI tab for enabling AI and configuring service + keys.
// WHY HERE: Keeps AI-specific options isolated from general settings.
function AISettings({ activeTab }) {
  const dispatch = useDispatch();
  const isAIEnabledGlobal = useSelector(selectIsAIEnabled);
  const aiServiceGlobal = useSelector(selectAiService);
  const apiKeysGlobal = useSelector(selectApiKeys);

  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiService, setAiServiceLocal] = useState('deepseek-server');
  const [apiKeys, setApiKeysLocal] = useState({});

  useEffect(() => {
    setAiEnabled(isAIEnabledGlobal);
    setAiServiceLocal(aiServiceGlobal || 'deepseek-server');
    setApiKeysLocal(apiKeysGlobal || {});
  }, [isAIEnabledGlobal, aiServiceGlobal, apiKeysGlobal]);

  const handleApiKeyChange = (service, value) => {
    setApiKeysLocal((prev) => ({ ...prev, [service]: value }));
  };

  const togglePasswordVisibility = (inputId) => {
    const input = document.getElementById(inputId);
    if (input) {
      input.type = input.type === 'password' ? 'text' : 'password';
    }
  };

  const handleSaveAI = () => {
    dispatch(setIsAIEnabled(aiEnabled));
    dispatch(setAiService(aiService));
    dispatch(setApiKeys(apiKeys));
  };

  const containerClass = activeTab === 'ai' ? 'tab-content active' : 'tab-content';

  return (
    <div className={containerClass}>
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
                onChange={(e) => setAiServiceLocal(e.target.value)}
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
  );
}

export default AISettings;
