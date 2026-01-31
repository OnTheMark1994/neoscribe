import { useDispatch, useSelector } from 'react-redux';
import { triggerReloadUserData } from '../../../Global/ReduxSlices/UserSlice';
import AiChatLoginBox from '../../AI/ChatBar/AiChatLoginBox';
import './SettingsAccount.css';
import { supabase } from '../../../Global/SupabaseClient';
import RefreshButton from '../../Util/RefreshButton';
import { openWebPortalWithAutoLogin } from '../../../Global/helpers/urlHelpers';

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
      return;
    }
    try {
      const { error } = await supabase.auth.signOut();
      // Manually clear localStorage and reload to ensure complete logout avoid 403 magic link errors
      localStorage.removeItem(`sb-${process.env.REACT_APP_SUPABASE_PROJECT_REF}-auth-token`);
      window.location.reload();
      if (error) {
        console.error('Sign out error:', error);
      }
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleViewWebPortal = async () => {
    await openWebPortalWithAutoLogin(supabase, authUser);
  };

  return (
    <div>
      {/* Login / Create Account Section */}
      
      <div className="settingsSection">
        <div className="settingsSectionTitle">Account</div>

          {/* If there is no auth user or a accountCreatedMessage show the new account stuff */}
          {!authUser || accountCreatedMessage ? (
            <AiChatLoginBox />
          ) : (
            // Else show the auth info and logout button
            <>
              <div className="settingsRow">
                <div className="settingsRowLabel">
                  <div className="settingsRowLabelTitle">View web portal</div>
                  <div className="settingsRowLabelSub">Opens web portal with auto-login</div>
                </div>
                <button
                  type="button"
                  className="settingsButton"
                  onClick={handleViewWebPortal}
                  disabled={!authUser}
                >
                  View Web Portal
                  <div className="settingsButtonSub">(auto login)</div>
                </button>
              </div>
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

            </>
          )}
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
