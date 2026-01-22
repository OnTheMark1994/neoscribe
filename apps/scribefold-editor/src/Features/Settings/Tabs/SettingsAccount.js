/*
  SettingsAccount

  Account settings page with login/create account and logout functionality.
*/
import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { triggerReloadUserData } from '../../../Global/ReduxSlices/UserSlice';
import { supabase } from '../../../Global/SupabaseClient';
import AiChatLoginBox from '../../AI/ChatBar/AiChatLoginBox';
import RefreshButton from '../../Util/RefreshButton';
import '../SettingsTabs.css';

function formatMaybeNumber(value) {
  return typeof value === 'number' ? value.toLocaleString() : '—';
}

export default function SettingsAccount() {
  const dispatch = useDispatch();
  const [logoutStatus, setLogoutStatus] = useState('');

  const authUser = useSelector(state => state.userSlice.authUser);
  const userData = useSelector(state => state.userSlice.userData) || {};
  const userDataLoading = useSelector(state => state.userSlice.userDataLoading);
  const accountCreatedMessage = useSelector(state => state.userSlice.accountCreatedMessage);

  const tokensRemaining = userData?.tokens ?? userData?.token_balance;
  const anonId = userData?.anonId ?? userData?.anon_id;
  const deviceId = userData?.deviceId ?? userData?.device_id;
  const authId = authUser?.id ?? userData?.authId ?? userData?.auth_id;

  const handleLogout = async () => {
    setLogoutStatus('Logging out...');
    
    try {
      if (!supabase) {
        setLogoutStatus('Supabase client not configured');
        return;
      }

      const { error } = await supabase.auth.signOut();

      if (error) {
        setLogoutStatus(`Error: ${error.message}`);
        return;
      }

      setLogoutStatus('Logged out successfully');
      
      // Clear status after 2 seconds
      setTimeout(() => setLogoutStatus(''), 2000);
    } catch (error) {
      setLogoutStatus(`Error: ${error.message || 'Failed to logout'}`);
    }
  };

  return (
    <div>
      {/* Login / Create Account Section */}
      
      <div className="settingsSection">
        <div className="settingsSectionTitle">Account</div>

          {/* If there is no auth user or a accountCreatedMessage show the new account stuff */}
          {!authUser || accountCreatedMessage ?
            <AiChatLoginBox />
            :
            // Else show the auth info and logout button
            <div className="settingsRow">
              <div className="settingsRowLabel">
                <div className="settingsRowLabelTitle">Logged in as</div>
                <div className="settingsRowLabelSub">{authUser?.email || 'Unknown'}</div>
              </div>
              <button
                type="button"
                className="settingsButton"
                onClick={handleLogout}
                disabled={logoutStatus === 'Logging out...'}
              >
                {logoutStatus || 'Logout'}
              </button>

              {/* For telling user they logged out? */}
              {logoutStatus && (
                <div className={`settingsNote ${
                  logoutStatus.includes('Error') ? 'settingsNoteError' : 'settingsNoteSuccess'
                }`}>
                  {logoutStatus}
                </div>
              )}
            </div>
          }

      </div>
    

      {/* Account Data Section */}
      <div className="settingsSection">
        <div className="settingsSectionTitle">Account Data</div>

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

      {/* Identifiers Section */}
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
