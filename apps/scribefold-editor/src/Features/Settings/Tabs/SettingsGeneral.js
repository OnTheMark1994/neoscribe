/*
 
 
  */
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setShowFileEncryptionWindow } from '../../../Global/ReduxSlices/WindowSlice';
import './SettingsTabs.css';

export default function SettingsSecurity() {
  const dispatch = useDispatch();

  return (
    <div>
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
