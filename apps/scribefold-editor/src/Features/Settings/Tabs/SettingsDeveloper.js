/*
 
 
  */
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateSetting } from '../../../Global/ReduxSlices/SettingsSlice';
import ToggleSwitch from '../../Util/ToggleSwitch';
import '../SettingsTabs.css';

export default function SettingsDeveloper() {
  const dispatch = useDispatch();

  const devMode = useSelector(state => state.settingsSlice.settingsObject?.devMode);
  const authUser = useSelector(state => state.userSlice.authUser);
  const userData = useSelector(state => state.userSlice.userData) || {};

  return (
    <div>
      <div className="settingsSection">
        <div className="settingsSectionTitle">Developer Mode</div>

        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Enable developer features</div>
            <div className="settingsRowLabelSub">Shows debug buttons and developer-only windows.</div>
          </div>
          <ToggleSwitch
            on={Boolean(devMode)}
            onClick={() => dispatch(updateSetting({ key: 'devMode', value: !devMode }))}
          />
        </div>
      </div>

      {devMode ? (
        <div className="settingsSection">
          <div className="settingsSectionTitle">Debug Info</div>

          <div className="settingsRow">
            <div className="settingsRowLabel">
              <div className="settingsRowLabelTitle">Auth user</div>
              <div className="settingsRowLabelSub">Raw supabase auth object (id only shown).</div>
            </div>
            <div className="settingsInlineValue">{authUser?.id || '—'}</div>
          </div>

          <div className="settingsRow">
            <div className="settingsRowLabel">
              <div className="settingsRowLabelTitle">User data keys</div>
              <div className="settingsRowLabelSub">Helps confirm userData shape from backend.</div>
            </div>
            <div className="settingsInlineValue">{Object.keys(userData || {}).join(', ') || '—'}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
