/*
 
 
  */
import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateSetting } from '../../../Global/ReduxSlices/SettingsSlice';
import { toggleShowDiffView } from '../../../Global/ReduxSlices/EditorSlice';
import ToggleSwitch from '../../Util/ToggleSwitch';
import '../SettingsTabs.css';

const API_BASE_URL = process.env.REACT_APP_SCRIBEFOLD_API_BASE_URL || 'http://localhost:8080';

export default function SettingsDeveloper() {
  const dispatch = useDispatch();

  const devMode = useSelector(state => state.settingsSlice.settingsObject?.devMode);
  const showDiffView = useSelector(state => state.editorSlice.showDiffView);
  const authUser = useSelector(state => state.userSlice.authUser);
  const userData = useSelector(state => state.userSlice.userData) || {};
  const [sendTokenEmailStatus, setSendTokenEmailStatus] = useState('');
  const [sendTokenEmailMessage, setSendTokenEmailMessage] = useState('');

  const handleSendTokenEmail = async () => {
    if (!authUser?.id) {
      setSendTokenEmailStatus('error');
      setSendTokenEmailMessage('You must be logged in to send a test token email');
      return;
    }

    setSendTokenEmailStatus('sending');
    setSendTokenEmailMessage('Sending test token email...');

    try {
      const response = await fetch(`${API_BASE_URL}/auth/send-token-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: authUser.id }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setSendTokenEmailStatus('error');
        setSendTokenEmailMessage(data.error || 'Failed to send token email');
        return;
      }

      setSendTokenEmailStatus('success');
      setSendTokenEmailMessage(data.message || 'Token email sent successfully!');
    } catch (error) {
      setSendTokenEmailStatus('error');
      setSendTokenEmailMessage(`Error: ${error.message || 'Failed to send token email'}`);
    }
  };

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

          <div className="settingsRow">
            <div className="settingsRowLabel">
              <div className="settingsRowLabelTitle">Toggle diff view</div>
              <div className="settingsRowLabelSub">Manually toggle diff view mode for debugging.</div>
            </div>
            <ToggleSwitch
              on={Boolean(showDiffView)}
              onClick={() => dispatch(toggleShowDiffView())}
            />
          </div>
        </div>
      ) : null}

      <div className="settingsSection">
        <div className="settingsSectionTitle">Test Token Email</div>

        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Send test token email</div>
            <div className="settingsRowLabelSub">
              Sends a token email to your account for testing without creating a new user.
              Email will be sent to: <strong>{authUser?.email || 'Not logged in'}</strong>
            </div>
          </div>
          <button
            type="button"
            className="settingsButton"
            onClick={handleSendTokenEmail}
            disabled={sendTokenEmailStatus === 'sending' || !authUser?.id}
          >
            {sendTokenEmailStatus === 'sending' ? 'Sending...' : 'Send Test Email'}
          </button>
        </div>

        {sendTokenEmailMessage && (
          <div className={`settingsNote ${
            sendTokenEmailStatus === 'error' ? 'settingsNoteError' : 'settingsNoteSuccess'
          }`}>
            {sendTokenEmailMessage}
          </div>
        )}
      </div>
    </div>
  );
}
