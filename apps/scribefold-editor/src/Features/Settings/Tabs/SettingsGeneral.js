/*
 
 
  */
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateSetting } from '../../../Global/ReduxSlices/SettingsSlice';
import { setShowFileEncryptionWindow } from '../../../Global/ReduxSlices/WindowSlice';
import '../SettingsTabs.css';

export default function SettingsGeneral() {
  const dispatch = useDispatch();

  const backgroundImageUri = useSelector(state => state.settingsSlice.settingsObject?.backgroundImageUri);

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
        <div className="settingsSectionTitle">Security</div>
        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Encrypt file</div>
            <div className="settingsRowLabelSub">
              Encrypts the current file. If you lose the password, it cannot be recovered.
            </div>
          </div>
          <button
            type="button"
            className="settingsButton"
            onClick={() => dispatch(setShowFileEncryptionWindow({ mode: 'encrypt' }))}
          >
            Encrypt
          </button>
        </div>
      </div>
    </div>
  );
}
