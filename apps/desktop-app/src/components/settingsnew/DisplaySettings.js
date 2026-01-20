import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import '../Settings/Settings.css';
import {
  selectShowPreviewBar,
  selectShowMonacoLineNumbers,
  selectMonacoStickyTopBar,
  selectShowArrayLineNumbers,
  setShowPreviewBar,
  setShowMonacoLineNumbers,
  setMonacoStickyTopBar,
  updateSetting,
} from '../../store/settingsSlice';

// WHAT: Display tab for array/Monaco visual toggles.
// WHY HERE: Keeps view-related options grouped and independent of other tabs.
function DisplaySettings({ activeTab }) {
  const dispatch = useDispatch();
  const showPreviewBar = useSelector(selectShowPreviewBar);
  const showMonacoLineNumbers = useSelector(selectShowMonacoLineNumbers);
  const monacoStickyTopBar = useSelector(selectMonacoStickyTopBar);
  const showArrayLineNumbers = useSelector(selectShowArrayLineNumbers);

  const toggleArrayLineNumbers = () => {
    const next = !showArrayLineNumbers;
    dispatch(updateSetting({ key: 'showArrayLineNumbers', value: next }));
  };

  const toggleMonacoStickyTopBar = () => {
    const next = !monacoStickyTopBar;
    dispatch(setMonacoStickyTopBar(next));
  };

  const toggleMonacoLineNumbers = () => {
    const next = !showMonacoLineNumbers;
    dispatch(setShowMonacoLineNumbers(next));
  };

  const togglePreviewBar = () => {
    const next = !showPreviewBar;
    dispatch(setShowPreviewBar(next));
  };

  const containerClass = activeTab === 'display' ? 'tab-content active' : 'tab-content';

  return (
    <div className={containerClass}>
      <div className="setting-section">
        <h2>Array View</h2>
        <details open>
          <summary>Array Display Options</summary>
          <div className="setting-item" style={{ marginTop: '10px' }}>
            <div className="toggle-container">
              <label>Show Line Indexes (Array)</label>
              <div
                className={`toggle-switch ${showArrayLineNumbers ? 'active' : ''}`}
                onClick={toggleArrayLineNumbers}
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
                onClick={toggleMonacoStickyTopBar}
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
                onClick={toggleMonacoLineNumbers}
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
                onClick={togglePreviewBar}
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
  );
}

export default DisplaySettings;
