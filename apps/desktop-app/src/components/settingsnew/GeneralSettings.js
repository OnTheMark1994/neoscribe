import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import '../Settings/Settings.css';
import { setBackgroundImage, selectDeveloperMode, selectBackgroundImage, setDeveloperMode } from '../../store/settingsSlice';
import { setBackground } from '../../utils/backgroundHelper';

// WHAT: General tab for background theme and simple developer toggle.
// WHY HERE: Isolated so SettingsNew stays tiny; this tab owns only its UI concerns.
function GeneralSettings({ activeTab }) {
  const dispatch = useDispatch();
  const developerMode = useSelector(selectDeveloperMode);
  const backgroundImage = useSelector(selectBackgroundImage);
  const [themes, setThemes] = useState([]);
  const [selectedTheme, setSelectedTheme] = useState('');

  // why setting themes with setThemes on every backgroun image change??
  useEffect(() => {
    setSelectedTheme(backgroundImage || 'spacedreams.jpg');

    setThemes([
      { name: 'Space Dreams', path: 'spacedreams.jpg' },
      { name: 'Mountains', path: 'Mountains.png' },
      { name: 'Bitter Skies', path: 'bitterskies.jpg' },
      { name: 'Enchantment', path: 'enchantment.jpg' },
      { name: 'Spy Games', path: 'spygames.jpg' },
      { name: 'Tranquility', path: 'tranquility.jpg' },
      { name: 'Writing Desk', path: 'writingdesk.jpg' },
    ]);
  }, [backgroundImage]);

  const handleThemeSelect = (themePath) => {
    setSelectedTheme(themePath);
    setBackground(themePath || '');
    dispatch(setBackgroundImage(themePath || ''));
  };

  const handleCustomTheme = async () => {
    if (!window.electronAPI?.selectCustomTheme) return;

    try {
      const result = await window.electronAPI.selectCustomTheme();
      if (!result || result.canceled || !result.filePath) return;

      const filePath = result.filePath;
      setSelectedTheme(filePath);
      setBackground(filePath);
      dispatch(setBackgroundImage(filePath));
    } catch (err) {
      console.error('Failed to select custom theme:', err);
    }
  };

  const containerClass = activeTab === 'general' ? 'tab-content active' : 'tab-content';

  return (
    <div className={containerClass}>
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
            {themes.map((theme) => (
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
              onClick={() => dispatch(setDeveloperMode(!developerMode))}
            >
              <div className="toggle-slider"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GeneralSettings;
