import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import '../Settings/Settings.css';
import GeneralSettings from './GeneralSettings';
import DisplaySettings from './DisplaySettings';
import AISettings from './AISettings';
import AccountSettings from './AccountSettings';
import Window from '../Windows/Window';
import { selectIsSettingsOpen, selectSettingsTab, closeSettings } from '../../store/uiSlice';

// WHAT: Shell for the new settings experience. Owns only the active tab and layout.
// WHY HERE: Top-level entry point so Menus can mount a single component with no props.
// STATE: activeTab string ('general' | 'display' | 'ai' | 'account'); other state lives in tab UIs/Redux.
function SettingsNew() {
  const dispatch = useDispatch();
  const isSettingsOpen = useSelector(selectIsSettingsOpen);
  const tabInitial = useSelector(selectSettingsTab);

  const [activeTab, setActiveTab] = useState(tabInitial || 'general');

  if (!isSettingsOpen) {
    return null;
  }

  return (
    <Window
      title="Settings"
      onClose={() => dispatch(closeSettings())}
      className="window-large"
    >
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

        <GeneralSettings activeTab={activeTab} />
        <DisplaySettings activeTab={activeTab} />
        <AISettings activeTab={activeTab} />
        <AccountSettings activeTab={activeTab} />

        <div className="button-container">
          <button className="btn-secondary" onClick={() => dispatch(closeSettings())}>
            Close
          </button>
          <button className="btn-primary">
            Save
          </button>
        </div>
      </div>
    </Window>
  );
}

export default SettingsNew;
