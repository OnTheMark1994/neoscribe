/*
 
 
  */
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateSetting } from '../../../Global/ReduxSlices/SettingsSlice';
import { toggleFullscreenActive } from '../../../Global/ReduxSlices/MenuSlice';
import ToggleSwitch from '../../Util/ToggleSwitch';
import './SettingsTabs.css';

export default function SettingsDisplay() {
  const dispatch = useDispatch();

  const settingsObject = useSelector(state => state.settingsSlice.settingsObject);
  const backgroundImageUri = settingsObject?.backgroundImageUri;
  const spellcheckEnabled = settingsObject?.spellcheckEnabled !== false;
  const lineWrapEnabled = settingsObject?.lineWrapEnabled === true;
  const fullscreenActive = useSelector(state => state.menuSlice.fullscreenActive);

  const themes = [
    { label: 'Space Dreams', value: '/theme-images/spacedreams.jpg' },
    { label: 'Mountains', value: '/theme-images/Mountains.png' },
    { label: 'Bitter Skies', value: '/theme-images/bitterskies.jpg' },
    { label: 'Enchantment', value: '/theme-images/enchantment.jpg' },
    { label: 'Spy Games', value: '/theme-images/spygames.jpg' },
    { label: 'Tranquility', value: '/theme-images/tranquility.jpg' },
    { label: 'Writing Desk', value: '/theme-images/writingdesk.jpg' },
  ];

  return (
    <div>
      <div className="settingsSection">
        <div className="settingsSectionTitle">Theme</div>
        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Background</div>
            <div className="settingsRowLabelSub">Choose a background theme for the editor.</div>
          </div>
        </div>

        <div className="settingsPillRow">
          {themes.map(theme => (
            <button
              key={theme.value}
              type="button"
              className={`settingsPill ${backgroundImageUri === theme.value ? 'settingsPillSelected' : ''}`}
              onClick={() => dispatch(updateSetting({ key: 'backgroundImageUri', value: theme.value }))}
            >
              {theme.label}
            </button>
          ))}
        </div>
      </div>

      <div className="settingsSection">
        <div className="settingsSectionTitle">Editor</div>

        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Line wrap</div>
            <div className="settingsRowLabelSub">Wrap long lines instead of scrolling horizontally</div>
          </div>
          <ToggleSwitch
            on={lineWrapEnabled}
            onClick={() => dispatch(updateSetting({ key: 'lineWrapEnabled', value: !lineWrapEnabled }))}
          />
        </div>

        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Full screen</div>
            <div className="settingsRowLabelSub">Toggle full screen mode (F11)</div>
          </div>
          <ToggleSwitch
            on={fullscreenActive}
            onClick={() => dispatch(toggleFullscreenActive())}
          />
        </div>

        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Enable spellcheck</div>
            <div className="settingsRowLabelSub">Underline misspelled words in the editor.</div>
          </div>
          <ToggleSwitch
            on={spellcheckEnabled}
            onClick={() => dispatch(updateSetting({ key: 'spellcheckEnabled', value: !spellcheckEnabled }))}
          />
        </div>
      </div>
    </div>
  );
}
