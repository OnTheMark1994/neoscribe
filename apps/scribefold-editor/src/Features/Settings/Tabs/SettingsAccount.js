/*
 
 
  */
import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { triggerReloadUserData } from '../../../Global/ReduxSlices/UserSlice';
import RefreshButton from '../../Util/RefreshButton';
import '../SettingsTabs.css';

function formatMaybeNumber(value) {
  return typeof value === 'number' ? value.toLocaleString() : '—';
}

export default function SettingsAccount() {
  const dispatch = useDispatch();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const authUser = useSelector(state => state.userSlice.authUser);
  const userData = useSelector(state => state.userSlice.userData) || {};
  const userDataLoading = useSelector(state => state.userSlice.userDataLoading);

  const tokensRemaining = userData?.tokens ?? userData?.token_balance;
  const anonId = userData?.anonId ?? userData?.anon_id;
  const deviceId = userData?.deviceId ?? userData?.device_id;
  const authId = authUser?.id ?? userData?.authId ?? userData?.auth_id;

  return (
    <div>
      <div className="settingsSection">
        <div className="settingsSectionTitle">Login / Create Account</div>

        <div className="settingsAccountGreenMessage">
          Create a free one click account for additional free tokens and to see subscription options.
        </div>

        <div className="settingsFieldLabel">Email</div>
        <input
          className="settingsInput"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />

        <div className="settingsFieldLabel" style={{ marginTop: '10px' }}>Password</div>
        <input
          className="settingsInput"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />

        <div className="settingsButtonRow" style={{ marginTop: '12px' }}>
          <button
            type="button"
            className="settingsButton settingsAccountAuthButton"
            disabled
            title="Auth not wired yet"
          >
            Create Account
          </button>
          <button
            type="button"
            className="settingsButton settingsAccountAuthButton"
            disabled
            title="Auth not wired yet"
          >
            Login
          </button>
        </div>

        <div className="settingsNote">
          Auth wiring is pending in the editor app. Once you point me to the auth module/API, I can connect these buttons.
        </div>
      </div>

      <div className="settingsSection">
        <div className="settingsSectionTitle">Account</div>

        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Refresh account data</div>
            <div className="settingsRowLabelSub">Reload token/account info from the server.</div>
          </div>
          <RefreshButton
            loading={userDataLoading}
            title="Refresh account"
            onClick={() => dispatch(triggerReloadUserData())}
          />
        </div>

        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Tokens available</div>
            <div className="settingsRowLabelSub">Current token balance.</div>
          </div>
          <div className="settingsInlineValue">{formatMaybeNumber(tokensRemaining)}</div>
        </div>
      </div>

      <div className="settingsSection">
        <div className="settingsSectionTitle">Identifiers</div>

        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Auth ID</div>
            <div className="settingsRowLabelSub">Supabase auth user id (if logged in).</div>
          </div>
          <div className="settingsInlineValue">{authId || '—'}</div>
        </div>

        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Anon ID</div>
            <div className="settingsRowLabelSub">Anonymous identifier used for token grants.</div>
          </div>
          <div className="settingsInlineValue">{anonId || '—'}</div>
        </div>

        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Device ID</div>
            <div className="settingsRowLabelSub">Device identifier used for anti-abuse rules.</div>
          </div>
          <div className="settingsInlineValue">{deviceId || '—'}</div>
        </div>
      </div>
    </div>
  );
}
