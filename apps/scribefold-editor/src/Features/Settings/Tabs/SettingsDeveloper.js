/*
 
 
  */
import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateSetting } from '../../../Global/ReduxSlices/SettingsSlice';
import { toggleShowDiffView } from '../../../Global/ReduxSlices/EditorSlice';
import { supabase } from '../../../Global/SupabaseClient';
import ToggleSwitch from '../../Util/ToggleSwitch';
import '../SettingsTabs.css';

const API_BASE_URL = process.env.REACT_APP_SCRIBEFOLD_API_BASE_URL || 'http://localhost:8080';
const WEB_PORTAL_URL = process.env.REACT_APP_WEB_PORTAL_URL || 'http://localhost:3001';

export default function SettingsDeveloper() {
  const dispatch = useDispatch();

  const devMode = useSelector(state => state.settingsSlice.settingsObject?.devMode);
  const showDiffView = useSelector(state => state.editorSlice.showDiffView);
  const authUser = useSelector(state => state.userSlice.authUser);
  const userData = useSelector(state => state.userSlice.userData) || {};
  const [sendTokenEmailStatus, setSendTokenEmailStatus] = useState('');
  const [sendTokenEmailMessage, setSendTokenEmailMessage] = useState('');
  const [devAccountEmail, setDevAccountEmail] = useState('');
  const [createDevAccountStatus, setCreateDevAccountStatus] = useState('');
  const [createDevAccountMessage, setCreateDevAccountMessage] = useState('');
  const [encryptionKey, setEncryptionKey] = useState('');

  const handleGenerateEncryptionKey = () => {
    const key = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    console.log('ENCRYPTION KEY:', key);
    console.log('Add to .env: ENCRYPTION_KEY=' + key);
    setEncryptionKey(key);
  };

  const handleTestAutoLogin = async (method) => {
    console.log('[AutoLogin Test] BUTTON CLICKED for method:', method);
    console.log('[AutoLogin Test] Auth user:', authUser?.id);

    if (!authUser?.id) {
      console.error('[AutoLogin Test] You must be logged in to test auto-login');
      return;
    }

    try {
      console.log('[AutoLogin Test] ENV API_BASE_URL:', API_BASE_URL);
      console.log('[AutoLogin Test] ENV WEB_PORTAL_URL:', WEB_PORTAL_URL);
      console.log('[AutoLogin Test] Getting session...');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not logged in');
      }

      let autoLoginPath = '';
      let apiEndpoint = '/api/generate-login-token';

      if (method === 'password') {
        autoLoginPath = '/auto-login-password';
      } else if (method === 'jwt') {
        autoLoginPath = '/auto-login-jwt';
      } else if (method === 'magiclink') {
        autoLoginPath = '/auto-login-magiclink';
      } else if (method === 'encrypted-magiclink') {
        autoLoginPath = '/auto-login-magiclink-enc';
        apiEndpoint = '/api/generate-encrypted-login-token';
      }

      console.log('[AutoLogin Test] Calling API endpoint:', `${API_BASE_URL}${apiEndpoint}`);
      const response = await fetch(`${API_BASE_URL}${apiEndpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      console.log('[AutoLogin Test] Response status:', response.status);
      const cloned1 = response.clone();
      try { console.log('[AutoLogin Test] Raw response text:', await cloned1.text()); } catch {}

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AutoLogin Test] Failed to generate login token:', response.status, errorText);
        throw new Error('Failed to generate login token');
      }

      const data = await response.json();
      console.log('[AutoLogin Test] API response data (parsed JSON):', JSON.stringify(data, null, 2));
      console.log('[AutoLogin Test] API response keys:', Object.keys(data));
      console.log('[AutoLogin Test] API response token:', data.token);

      const { token } = data;

      if (!token) {
        console.error('[AutoLogin Test] No token in response:', data);
        return;
      }

      console.log('[AutoLogin Test] Token generated, length:', token.length);

      // Normalize base URL to ensure it includes a scheme (http://) to avoid browser launch errors
      const baseUrl = /^https?:\/\//i.test(WEB_PORTAL_URL) ? WEB_PORTAL_URL : `http://${WEB_PORTAL_URL}`;
      const url = `${baseUrl}/#${autoLoginPath}?token=${token}`;
      console.log('[AutoLogin Test] Opening URL:', url);

      window.open(url, '_blank');
      console.log('[AutoLogin Test] Window opened');
    } catch (error) {
      console.error('[AutoLogin Test] Error:', error.message);
    }
  };

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

  const handleCreateDevAccount = async () => {
    if (!devAccountEmail || !devAccountEmail.includes('@')) {
      setCreateDevAccountStatus('error');
      setCreateDevAccountMessage('Please enter a valid email address');
      return;
    }

    setCreateDevAccountStatus('sending');
    setCreateDevAccountMessage('Creating dev account...');

    try {
      const response = await fetch(`${API_BASE_URL}/api/create-account-dev`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: devAccountEmail }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setCreateDevAccountStatus('error');
        setCreateDevAccountMessage(data.error || 'Failed to create dev account');
        return;
      }

      setCreateDevAccountStatus('success');
      setCreateDevAccountMessage(data.message || 'Dev account created successfully!');
      setDevAccountEmail('');
    } catch (error) {
      setCreateDevAccountStatus('error');
      setCreateDevAccountMessage(`Error: ${error.message || 'Failed to create dev account'}`);
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

      <div className="settingsSection">
        <div className="settingsSectionTitle">Create Dev Account</div>

        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Test account creation</div>
            <div className="settingsRowLabelSub">
              Creates a test account with just an email (no password) and sends confirmation email.
              Useful for testing email verification flow without manually managing Supabase accounts.
            </div>
          </div>
          <input
            type="email"
            className="settingsInput"
            placeholder="Enter email address"
            value={devAccountEmail}
            onChange={(e) => setDevAccountEmail(e.target.value)}
            disabled={createDevAccountStatus === 'sending'}
          />
        </div>

        <div className="settingsRow">
          <div className="settingsRowLabel"></div>
          <button
            type="button"
            className="settingsButton"
            onClick={handleCreateDevAccount}
            disabled={createDevAccountStatus === 'sending' || !devAccountEmail}
          >
            {createDevAccountStatus === 'sending' ? 'Creating...' : 'Create Dev Account'}
          </button>
        </div>

        {createDevAccountMessage && (
          <div className={`settingsNote ${
            createDevAccountStatus === 'error' ? 'settingsNoteError' : 'settingsNoteSuccess'
          }`}>
            {createDevAccountMessage}
          </div>
        )}
      </div>

      <div className="settingsSection">
        <div className="settingsSectionTitle">Auto-Login Testing</div>

        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Test Password Method</div>
            <div className="settingsRowLabelSub">
              Tests auto-login using stored password and signInWithPassword.
            </div>
          </div>
          <button
            type="button"
            className="settingsButton"
            onClick={() => handleTestAutoLogin('password')}
          >
            Test Password
          </button>
        </div>

        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Test JWT Method</div>
            <div className="settingsRowLabelSub">
              Tests auto-login using custom JWT signed with SUPABASE_JWT_SECRET.
            </div>
          </div>
          <button
            type="button"
            className="settingsButton"
            onClick={() => handleTestAutoLogin('jwt')}
          >
            Test JWT
          </button>
        </div>

        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Test Magic Link Method</div>
            <div className="settingsRowLabelSub">
              Tests auto-login using Supabase magic link and verifyOtp.
            </div>
          </div>
          <button
            type="button"
            className="settingsButton"
            onClick={() => handleTestAutoLogin('magiclink')}
          >
            Test Magic Link
          </button>
        </div>

        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Test Encrypted Magic Link</div>
            <div className="settingsRowLabelSub">
              Tests auto-login using encrypted session_builders table (more secure).
            </div>
          </div>
          <button
            type="button"
            className="settingsButton"
            onClick={() => handleTestAutoLogin('encrypted-magiclink')}
          >
            Test Encrypted Magic Link
          </button>
        </div>
      </div>

      <div className="settingsSection">
        <div className="settingsSectionTitle">Encryption Key Generation</div>

        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Generate Encryption Key</div>
            <div className="settingsRowLabelSub">
              Generates a 64-character hex string for AES-256 encryption.
            </div>
          </div>
          <button
            type="button"
            className="settingsButton"
            onClick={handleGenerateEncryptionKey}
          >
            Generate Key
          </button>
        </div>

        {encryptionKey && (
          <div className="settingsRow">
            <div className="settingsRowLabel">
              <div className="settingsRowLabelTitle">Generated Key</div>
              <div className="settingsRowLabelSub">
                Add this to your .env file as ENCRYPTION_KEY
              </div>
            </div>
            <div className="settingsValue">
              <code style={{ fontSize: '12px', wordBreak: 'break-all' }}>{encryptionKey}</code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
