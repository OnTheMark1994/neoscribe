/*
 
 
  */
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setShowFileEncryptionWindow } from '../../../Global/ReduxSlices/WindowSlice';
import { updateSetting } from '../../../Global/ReduxSlices/SettingsSlice';
import ToggleSwitch from '../../Util/ToggleSwitch';
import './SettingsTabs.css';

export default function SettingsSecurity() {
  const dispatch = useDispatch();
  const settingsObject = useSelector(state => state.settingsSlice.settingsObject);
  const showMiniKeyboard = settingsObject?.showMiniKeyboard === true;

  return (
    <div>
      <div className="settingsSection">
        <div className="settingsSectionTitle">Keyboard</div>
        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Show mini keyboard</div>
            <div className="settingsRowLabelSub">Shows a draggable on-screen keyboard window.</div>
          </div>
          <ToggleSwitch
            on={showMiniKeyboard}
            onClick={() => dispatch(updateSetting({ key: 'showMiniKeyboard', value: !showMiniKeyboard }))}
          />
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
