/*
  SettingsAccount

  Account settings page with login/create account and logout functionality.
*/
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setAuthUser, setUserData, triggerReloadUserData } from '../../../Global/ReduxSlices/UserSlice';
import AiChatLoginBox from '../../AI/ChatBar/AiChatLoginBox';
import './SettingsAccount.css';
import { supabase } from '../../../Global/SupabaseClient';
import RefreshButton from '../../Util/RefreshButton';

function formatMaybeNumber(value) {
  return typeof value === 'number' ? value.toLocaleString() : '—';
}

export default function SettingsAccount() {
  const dispatch = useDispatch();

  const authUser = useSelector(state => state.userSlice.authUser);
  const userData = useSelector(state => state.userSlice.userData) || {};
  // For the refresh button
  const userDataLoading = useSelector(state => state.userSlice.userDataLoading);
  // If this message is there show the account creation box even when the user is logged in (for email confirmation message) 
  const accountCreatedMessage = useSelector(state => state.userSlice.accountCreatedMessage);

  const tokensRemaining = userData?.tokens ?? userData?.token_balance;

  const handleLogout = async () => {
    
    if (!supabase) {
      console.log("sign out error: !supabase")
      return;
    }
    try {
      const { error } = await supabase.auth.signOut();
      // This is to resolve a supabase bug related to magic link token generation causing sign out return a 403 error  
      if (error) {
              localStorage.removeItem(`sb-${process.env.REACT_APP_SUPABASE_PROJECT_REF}-auth-token`);
      dispatch(triggerReloadUserData())

        console.log("sign out error: ", error)
        return;
      }
      
      // Clear status after 2 seconds
    } catch (error) {
        console.log("sign out error: ", error)
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
      handleTokenLogin(token);
    }
  }, []);

  const handleTokenLogin = async (token) => {
    try {
      const response = await fetch('/auth/token-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      const data = await response.json();

      if (data.success && data.session) {
        // Store session and reload user data
        localStorage.setItem('supabase.auth.token', JSON.stringify(data.session));
        dispatch(triggerReloadUserData());
        
        // Remove token from URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        console.error('Token login failed:', data.error);
      }
    } catch (error) {
      console.error('Error in token login:', error);
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
              >
                Logout
              </button>
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

        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Tokens added</div>
            <div className="settingsRowLabelSub">One-time tokens from grants.</div>
          </div>
          <div className="settingsInlineValue">{formatMaybeNumber(userData?.tokens_added)}</div>
        </div>

        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Monthly tokens</div>
            <div className="settingsRowLabelSub">Tokens from subscription.</div>
          </div>
          <div className="settingsInlineValue">{formatMaybeNumber(userData?.tokens_monthly)}</div>
        </div>

        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Used this month</div>
            <div className="settingsRowLabelSub">Tokens used this month.</div>
          </div>
          <div className="settingsInlineValue">{formatMaybeNumber(userData?.tokens_used_this_month)}</div>
        </div>

        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Used all time</div>
            <div className="settingsRowLabelSub">Total tokens used ever.</div>
          </div>
          <div className="settingsInlineValue">{formatMaybeNumber(userData?.tokens_used_all_time)}</div>
        </div>
      </div>

    </div>
  );
}
